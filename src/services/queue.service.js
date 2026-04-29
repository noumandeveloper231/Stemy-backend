import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { sendEmail } from "../utils/email.js";

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

      await prisma.master.update({
        where: { id: masterId },
        data: { status: "PROCESSING" },
      });

      // Placeholder processing while DSP/mastering engine is intentionally skipped.
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await prisma.master.update({
        where: { id: masterId },
        data: {
          status: "COMPLETE",
          outputUrl: master.sourceUrl,
          completedAt: new Date(),
          lufs: -14,
          dbtp: -1,
        },
      });

      await sendEmail({
        to: master.user.email,
        subject: "Your Stemy master is ready",
        html: `<p>Your file is ready to download from your dashboard.</p>`,
      });
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
