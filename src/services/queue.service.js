import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { sendEmail } from "../utils/email.js";
import { getDownloadUrl, uploadBuffer } from "./storage.service.js";

const redisConnection = env.REDIS_URL
  ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
  : null;

export const masteringQueue = redisConnection
  ? new Queue("mastering", { connection: redisConnection })
  : null;

if (redisConnection) {
  const worker = new Worker(
    "mastering",
    async (job) => {
      const { masterId } = job.data;
      console.log(
        "[QUICK MASTER] Processing mastering job for master ID:",
        masterId,
      );

      const master = await prisma.master.findUnique({
        where: { id: masterId },
        include: { user: true },
      });
      if (!master) {
        console.error("[QUICK MASTER] Master not found:", masterId);
        return;
      }

      console.log("[QUICK MASTER] Found master record:", {
        id: master.id,
        sourceName: master.sourceName,
        genre: master.genre,
        sourceUrl: master.sourceUrl,
      });

      try {
        console.log("[QUICK MASTER] Updating status to PROCESSING...");
        await prisma.master.update({
          where: { id: masterId },
          data: { status: "PROCESSING" },
        });

        // 1. Get a pre-signed download URL for the original file
        console.log(
          "[QUICK MASTER] Getting download URL for:",
          master.sourceUrl,
        );
        const sourceDownloadUrl = await getDownloadUrl(master.sourceUrl);
        console.log(
          "[QUICK MASTER] Download URL generated:",
          sourceDownloadUrl,
        );

        // 2. Download the original audio from storage
        console.log("[QUICK MASTER] Downloading source audio...");
        const sourceResponse = await fetch(sourceDownloadUrl);
        if (!sourceResponse.ok) {
          console.error(
            "[QUICK MASTER] Failed to download source audio. Status:",
            sourceResponse.status,
          );
          throw new Error("Failed to download source audio");
        }
        const sourceBuffer = await sourceResponse.arrayBuffer();
        
        // Check file size (150MB limit)
        if (sourceBuffer.byteLength > 150 * 1024 * 1024) {
          throw new Error("File too large. Maximum size is 150MB");
        }
        
        console.log(
          "[QUICK MASTER] Successfully downloaded audio. Size:",
          sourceBuffer.byteLength,
          "bytes",
        );

        // 3. Send to Python Mastering Engine API
        const pythonApiUrl = env.PYTHON_ENGINE_URL;
        console.log(
          "[QUICK MASTER] Sending to Python engine at:",
          pythonApiUrl,
        );

        const formData = new FormData();
        formData.append(
          "file",
          new Blob([sourceBuffer], { type: master.sourceMime }),
          master.sourceName,
        );
        formData.append("genre", master.genre);
        console.log(
          "[QUICK MASTER] FormData prepared - file size:",
          sourceBuffer.byteLength,
          "genre:",
          master.genre,
        );

        console.log(
          "[QUICK MASTER] Sending request to Python mastering engine...",
        );

        // Extended timeout for large files (5 minutes)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000);

        try {
          var pythonResponse = await fetch(`${pythonApiUrl}/master`, {
            method: "POST",
            body: formData,
            signal: controller.signal,
          });
        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.error("[QUICK MASTER] Fetch error:", fetchError.message);
          if (fetchError.name === "AbortError") {
            throw new Error("Python engine request timed out after 2 minutes");
          }
          throw new Error(`Cannot connect to Python engine: ${fetchError.message}`);
        }
        clearTimeout(timeoutId);

        console.log(
          "[QUICK MASTER] Python engine response status:",
          pythonResponse.status,
        );
        console.log(
          "[QUICK MASTER] Python engine response headers:",
          Object.fromEntries(pythonResponse.headers.entries()),
        );

        if (!pythonResponse.ok) {
          const errorText = await pythonResponse.text();
          console.error(
            "[QUICK MASTER] Python engine error response:",
            errorText,
          );
          throw new Error(
            `Python Engine Error: ${pythonResponse.statusText} - ${errorText}`,
          );
        }

        // Read processing metadata
        const lufs =
          parseFloat(pythonResponse.headers.get("X-Lufs-Target")) || -14;
        const dbtp =
          parseFloat(pythonResponse.headers.get("X-Tp-Target")) || -1;
        const processingTime = pythonResponse.headers.get(
          "X-Processing-Time-Ms",
        );
        console.log(
          "[QUICK MASTER] Processing metadata - LUFS:",
          lufs,
          "dBTP:",
          dbtp,
          "Time:",
          processingTime,
          "ms",
        );

        const outputBuffer = await pythonResponse.arrayBuffer();
        console.log(
          "[QUICK MASTER] Received mastered audio. Size:",
          outputBuffer.byteLength,
          "bytes",
        );

        // 4. Upload the mastered output back to storage
        const outputKey = `masters/${master.userId}/${Date.now()}-mastered-${master.sourceName}`;
        console.log(
          "[QUICK MASTER] Uploading mastered audio with key:",
          outputKey,
        );

        const outputUrl = await uploadBuffer({
          key: outputKey,
          body: Buffer.from(outputBuffer),
          contentType: "audio/wav",
        });
        console.log("[QUICK MASTER] Mastered audio uploaded to:", outputUrl);

        // 5. Update DB with completion status
        console.log(
          "[QUICK MASTER] Updating database with completion status...",
        );
        await prisma.master.update({
          where: { id: masterId },
          data: {
            status: "COMPLETE",
            outputUrl: outputUrl,
            completedAt: new Date(),
            lufs,
            dbtp,
          },
        });
        console.log("[QUICK MASTER] Mastering job completed successfully!");

        // 6. Notify user
        if (master.user?.email) {
          console.log(
            "[QUICK MASTER] Sending completion email to:",
            master.user.email,
          );
          await sendEmail({
            to: master.user.email,
            subject: "Your Stemy master is ready",
            html: `<p>Your mastered track <strong>${master.sourceName}</strong> is ready to download from your dashboard.</p>`,
          });
          console.log("[QUICK MASTER] Completion email sent");
        }
      } catch (error) {
        console.error(`Mastering Job Failed for ${masterId}:`, error);
        throw error; // Let the BullMQ worker "failed" event handle the DB update
      }
    },
    { connection: redisConnection },
  );

  worker.on("failed", async (job, error) => {
    if (!job) return;
    await prisma.master.update({
      where: { id: job.data.masterId },
      data: { status: "FAILED", error: error.message },
    });
  });
}

export const enqueueMasteringJob = async (masterId) => {
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
