import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { sendEmail } from "../utils/email.js";
import { Readable } from "stream";
import { getDownloadUrl, uploadBuffer, uploadStream } from "./storage.service.js";
import fs from "fs";
import path from "path";
import os from "os";

const TMP_DIR = path.join(os.tmpdir(), "stemy-masters");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const redisConnection = env.REDIS_URL
  ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
  : null;

export const masteringQueue = redisConnection
  ? new Queue("mastering", { connection: redisConnection })
  : null;

// In-memory buffer cache — avoids R2 round-trip for recently uploaded files
const bufferCache = new Map();

// Download cache — maps masterId to local temp file path for fast serving
const downloadCache = new Map();

if (redisConnection) {
  const worker = new Worker(
    "mastering",
    async (job) => {
      const { masterId } = job.data;
      console.log("[QUICK MASTER] Processing mastering job for master ID:", masterId);

      const master = await prisma.master.findUnique({
        where: { id: masterId },
        include: { user: true },
      });
      if (!master) {
        console.error("[QUICK MASTER] Master not found:", masterId);
        return;
      }

      try {
        const T = (label) => { const t = Date.now(); return [t, label]; };
        let marks = [];
        marks.push(T("start"));
        await prisma.master.update({
          where: { id: masterId },
          data: { status: "PROCESSING" },
        });

        // ── Get source buffer (cache first, fallback R2) ────────
        let srcBuf = bufferCache.get(masterId);
        if (srcBuf) bufferCache.delete(masterId);

        if (!srcBuf) {
          const sourceDownloadUrl = await getDownloadUrl(master.sourceUrl);
          marks.push(T("signed_url"));
          const sourceResponse = await fetch(sourceDownloadUrl);
          if (!sourceResponse.ok) throw new Error("Failed to download source audio");
          srcBuf = await sourceResponse.arrayBuffer();
        }
        marks.push(T("get_src"));

        if (srcBuf.byteLength > 150 * 1024 * 1024)
          throw new Error("File too large. Maximum size is 150MB");

        // ── Upload source to R2 for persistence ────────────────
        const sourceKey = `masters/${master.userId}/${Date.now()}-${master.sourceName}`;
        const realSourceUrl = await uploadBuffer({
          key: sourceKey,
          body: Buffer.from(srcBuf),
          contentType: master.sourceMime,
        });
        await prisma.master.update({
          where: { id: masterId },
          data: { sourceUrl: realSourceUrl },
        });
        marks.push(T("upload_src"));

        // ── Send to Python Mastering Engine ────────────────────
        const formData = new FormData();
        formData.append("file", new Blob([srcBuf], { type: master.sourceMime }), master.sourceName);
        formData.append("genre", master.genre);
        if (master.metadata) {
          formData.append("metadata", typeof master.metadata === "string" ? master.metadata : JSON.stringify(master.metadata));
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000);
        let pythonResponse;
        try {
          pythonResponse = await fetch(`${env.PYTHON_ENGINE_URL}/master`, {
            method: "POST", body: formData, signal: controller.signal,
          });
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw new Error(fetchError.name === "AbortError"
            ? "Python engine request timed out after 5 minutes"
            : `Cannot connect to Python engine: ${fetchError.message}`);
        }
        clearTimeout(timeoutId);
        marks.push(T("python_done"));

        if (!pythonResponse.ok) {
          const errorText = await pythonResponse.text();
          throw new Error(`Python Engine Error: ${pythonResponse.statusText} - ${errorText}`);
        }

        // Read loudness from response headers (available immediately)
        const lufs = parseFloat(pythonResponse.headers.get("X-Lufs-Actual")) || -14;
        const dbtp = parseFloat(pythonResponse.headers.get("X-Tp-Actual")) || -1;
        const pyTime = pythonResponse.headers.get("X-Processing-Time-Ms");

        // ── Write mastered audio to temp file + tee to R2 ──────
        const outputKey = `masters/${master.userId}/${Date.now()}-mastered-${master.sourceName}`;
        const tmpPath = path.join(TMP_DIR, `${masterId}.wav`);
        const outputLength = parseInt(pythonResponse.headers.get("content-length"), 10) || undefined;

        // Write local file (fast) while also uploading to R2 in background
        const webStream = pythonResponse.body;
        const nodeStream = Readable.fromWeb(webStream);

        // Split: write to file + upload to R2 simultaneously
        const fileStream = fs.createWriteStream(tmpPath);
        nodeStream.pipe(fileStream);

        // Read the stream for R2 upload (tee: read from temp file after it's written)
        await new Promise((resolve, reject) => {
          fileStream.on("finish", resolve);
          fileStream.on("error", reject);
        });
        marks.push(T("write_local"));

        // Store in download cache for instant serving
        downloadCache.set(masterId, tmpPath);

        // Mark complete immediately — user can download NOW
        await prisma.master.update({
          where: { id: masterId },
          data: { status: "COMPLETE", completedAt: new Date(), lufs, dbtp },
        });
        marks.push(T("db_update"));

        // ── Upload to R2 in background (don't await) ───────────
        const outputUrlPromise = (async () => {
          const fileBuf = fs.readFileSync(tmpPath);
          const result = await uploadBuffer({
            key: outputKey,
            body: fileBuf,
            contentType: "audio/wav",
          });
          await prisma.master.update({
            where: { id: masterId },
            data: { outputUrl: result },
          });
          // Keep temp file for 5 min, then clean up
          setTimeout(() => {
            downloadCache.delete(masterId);
            fs.unlink(tmpPath, () => {});
          }, 300000);
          return result;
        })();

        // Notify user
        if (master.user?.email) {
          await sendEmail({
            to: master.user.email,
            subject: "Your Stemy master is ready",
            html: `<p>Your mastered track <strong>${master.sourceName}</strong> is ready to download from your dashboard.</p>`,
          });
        }

        // ── Timing summary ─────────────────────────────────────
        const fmt = (a, b) => `${((b[0] - a[0]) / 1000).toFixed(1)}s`;
        const srcMB = (srcBuf.byteLength / 1024 / 1024).toFixed(1);
        const outMB = outputLength ? (outputLength / 1024 / 1024).toFixed(1) : "?";
        console.log(`\n═══ MASTER TIMINGS ═══`);
        console.log(`  Get source     ${fmt(marks[0], marks[1])}  (${srcMB} MB)`);
        console.log(`  Upload src R2  ${fmt(marks[1], marks[2])}`);
        console.log(`  Python engine  ${fmt(marks[2], marks[3])}  (py=${(parseInt(pyTime||0)/1000).toFixed(1)}s)`);
        console.log(`  Write local    ${fmt(marks[3], marks[4])}  (${outMB} MB)`);
        console.log(`  DB update      ${fmt(marks[4], marks[5])}`);
        console.log(`  ─────────────────────────────`);
        console.log(`  USER READY     ${fmt(marks[0], marks[5])}`);
        console.log(`  ─────────────────────────────`);
        console.log(`  R2 upload runs in background (avg ~${Math.round((outputLength||0) / 1024 / 1024 / 2)}s for ${outMB} MB)`);
        console.log(`═══════════════════════════════\n`);
      } catch (error) {
        console.error(`Mastering Job Failed for ${masterId}:`, error);
        throw error;
      }
    },
    { connection: redisConnection, drainDelay: 200 },
  );

  worker.on("failed", async (job, error) => {
    if (!job) return;
    await prisma.master.update({
      where: { id: job.data.masterId },
      data: { status: "FAILED", error: error.message },
    });
  });
}

export const enqueueMasteringJob = async (masterId, sourceBuffer) => {
  if (sourceBuffer) bufferCache.set(masterId, sourceBuffer);

  if (!masteringQueue) {
    await prisma.master.update({
      where: { id: masterId },
      data: {
        status: "COMPLETE",
        outputUrl: (await prisma.master.findUnique({ where: { id: masterId } }))
          ?.sourceUrl,
        completedAt: new Date(),
      },
    });
    return;
  }

  await masteringQueue.add("process", { masterId });
};

// Export for download endpoint to serve local files
export const getLocalDownloadPath = (masterId) => downloadCache.get(masterId);
