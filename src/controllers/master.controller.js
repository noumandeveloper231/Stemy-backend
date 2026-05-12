import { prisma } from "../lib/prisma.js";
import { uploadBuffer, getDownloadUrl } from "../services/storage.service.js";
import { enqueueMasteringJob } from "../services/queue.service.js";
import https from "https";
import http from "http";

const ALLOWED_PLANS = ["BASIC", "PRO"];

const checkUserPlan = async (userId) => {
  const subscription = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  
  if (!subscription) return false;
  
  const isActive = ["ACTIVE", "TRIALING"].includes(subscription.status);
  return isActive && ALLOWED_PLANS.includes(subscription.plan);
};

const ALLOWED_MIME = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/flac",
  "audio/x-flac",
  "audio/aiff",
  "audio/x-aiff",
]);

export const createQuickMaster = async (req, res) => {
  try {
    const hasValidPlan = await checkUserPlan(req.userId);
    if (!hasValidPlan) {
      return res.status(403).json({ 
        message: "Quick Master requires a Basic or Pro subscription" 
      });
    }

    console.log("[QUICK MASTER] New Quick Master request received");
    console.log("[QUICK MASTER] Request user ID:", req.userId);
    console.log("[QUICK MASTER] Request body keys:", Object.keys(req.body));
    console.log(
      "[QUICK MASTER] Request file info:",
      req.file
        ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
          }
        : "No file",
    );

    const file = req.files?.audio?.[0] || req.file;
    const { genre, metadata: metadataRaw } = req.body;
    const artwork = req.files?.artwork?.[0] || null;

    if (!file) {
      console.error("[QUICK MASTER] No file provided");
      return res.status(400).json({ message: "Audio file is required" });
    }
    if (!genre) {
      console.error("[QUICK MASTER] No genre provided");
      return res.status(400).json({ message: "Genre is required" });
    }
    if (file.size > 100 * 1024 * 1024) {
      console.error("[QUICK MASTER] File too large:", file.size, "bytes");
      return res.status(400).json({ message: "File exceeds 100MB limit" });
    }
    if (file.mimetype && !ALLOWED_MIME.has(file.mimetype)) {
      console.error("[QUICK MASTER] Unsupported MIME type:", file.mimetype);
      return res.status(400).json({ message: "Unsupported audio format" });
    }

    // Parse metadata and handle artwork
    let parsedMetadata = metadataRaw ? JSON.parse(metadataRaw) : null;

    // Upload artwork if provided
    if (artwork) {
      const artKey = `artwork/${req.userId}/${Date.now()}-${artwork.originalname}`;
      const artUrl = await uploadBuffer({
        key: artKey,
        body: artwork.buffer,
        contentType: artwork.mimetype,
      });
      parsedMetadata = { ...parsedMetadata, artworkUrl: artUrl };
      console.log("[QUICK MASTER] Artwork uploaded to:", artUrl);
    }

    const sourceKey = `masters/${req.userId}/${Date.now()}-${file.originalname}`;
    console.log("[QUICK MASTER] Uploading to storage with key:", sourceKey);

    const sourceUrl = await uploadBuffer({
      key: sourceKey,
      body: file.buffer,
      contentType: file.mimetype,
    });
    console.log("[QUICK MASTER] File uploaded successfully to:", sourceUrl);

    console.log("[QUICK MASTER] Creating database record...");
    const master = await prisma.master.create({
      data: {
        userId: req.userId,
        genre,
        type: "QUICK",
        sourceName: file.originalname,
        sourceMime: file.mimetype || "application/octet-stream",
        sourceSize: file.size,
        sourceUrl,
        metadata: parsedMetadata,
      },
    });
    console.log("[QUICK MASTER] Database record created with ID:", master.id);

    console.log("[QUICK MASTER] Enqueuing mastering job...");
    await enqueueMasteringJob(master.id);
    console.log("[QUICK MASTER] Mastering job enqueued successfully");

    return res.status(201).json({ master });
  } catch (error) {
    console.error("Create quick master error:", error);
    return res
      .status(500)
      .json({ message: "Failed to create quick master job" });
  }
};

export const listMasters = async (req, res) => {
  const masters = await prisma.master.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ masters });
};

export const getMasterById = async (req, res) => {
  const master = await prisma.master.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!master) {
    return res.status(404).json({ message: "Master not found" });
  }
  return res.json({ master });
};

export const getMasterDownload = async (req, res) => {
  const master = await prisma.master.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!master) {
    return res.status(404).json({ message: "Master not found" });
  }
  if (master.status !== "COMPLETE" || !master.outputUrl) {
    return res.status(409).json({ message: "Master output is not ready" });
  }

  // Generate signed URL for storage
  const signedUrl = await getDownloadUrl(master.outputUrl);
  
  // Extract filename from URL
  const urlObj = new URL(master.outputUrl);
  const filename = urlObj.pathname.split("/").pop() || "mastered-track.wav";
  
  // Set headers for file download
  res.setHeader("Content-Type", "audio/wav");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  
  // Create proxy request to storage
  const proxyUrl = new URL(signedUrl);
  const protocol = proxyUrl.protocol === "https:" ? https : http;
  
  const proxyReq = protocol.request(proxyUrl, (proxyRes) => {
    if (proxyRes.statusCode !== 200) {
      res.status(proxyRes.statusCode || 500).json({ message: "Failed to fetch file from storage" });
      return;
    }
    
    // Pipe the response directly
    proxyRes.pipe(res);
  });
  
  proxyReq.on("error", (err) => {
    console.error("[DOWNLOAD] Proxy error:", err.message);
    res.status(500).json({ message: "Failed to download file" });
  });
  
  proxyReq.end();
};
