import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { sendEmail } from "../utils/email.js";
import { getDownloadUrl, uploadBuffer } from "./storage.service.js";

const redisConnection = env.REDIS_URL ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }) : null;

export const masteringQueue = redisConnection
  ? new Queue("mastering", { connection: redisConnection })
  : null;

if (redisConnection) {
  const worker = new Worker(
    "mastering",
    async (job) => {
      const { masterId } = job.data;
      const master = await prisma.master.findUnique({
        where: { id: masterId },
        include: { user: true },
      });
      if (!master) return;

      try {
        await prisma.master.update({
          where: { id: masterId },
          data: { status: "PROCESSING" },
        });

        // 1. Get a pre-signed download URL for the original file
        const sourceDownloadUrl = await getDownloadUrl(master.sourceUrl);

        // 2. Download the original audio buffer from storage
        const sourceResponse = await fetch(sourceDownloadUrl);
        if (!sourceResponse.ok) throw new Error("Failed to download source audio");
        const sourceBuffer = await sourceResponse.arrayBuffer();

        // 3. Send to Python Mastering Engine API
        const pythonApiUrl = process.env.PYTHON_ENGINE_URL || "http://localhost:5050";
        
        const formData = new FormData();
        formData.append("file", new Blob([sourceBuffer], { type: master.sourceMime }), master.sourceName);
        formData.append("genre", master.genre);

        const pythonResponse = await fetch(`${pythonApiUrl}/master`, {
          method: "POST",
          body: formData,
        });

        if (!pythonResponse.ok) {
          throw new Error(`Python Engine Error: ${pythonResponse.statusText}`);
        }

        // Read processing metadata
        const lufs = parseFloat(pythonResponse.headers.get("X-Lufs-Target")) || -14;
        const dbtp = parseFloat(pythonResponse.headers.get("X-Tp-Target")) || -1;
        
        const outputBuffer = await pythonResponse.arrayBuffer();

        // 4. Upload the mastered output back to storage
        const outputKey = `masters/${master.userId}/${Date.now()}-mastered-${master.sourceName}`;
        const outputUrl = await uploadBuffer({
          key: outputKey,
          body: Buffer.from(outputBuffer),
          contentType: "audio/wav",
        });

        // 5. Update DB with completion status
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

        // 6. Notify user
        if (master.user?.email) {
          await sendEmail({
            to: master.user.email,
            subject: "Your Stemy master is ready",
            html: `<p>Your mastered track <strong>${master.sourceName}</strong> is ready to download from your dashboard.</p>`,
          });
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
        outputUrl: (await prisma.master.findUnique({ where: { id: masterId } }))?.sourceUrl,
        completedAt: new Date(),
      },
    });
    return;
  }

  await masteringQueue.add("process", { masterId });
};
