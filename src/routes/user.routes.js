import express from "express";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { uploadBuffer } from "../services/storage.service.js";
import { env } from "../config/env.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const LOCAL_AVATARS_DIR = path.join(process.cwd(), "uploads", "avatars");

// Serve local avatar files
router.get("/me/avatar/:userId/:fileName", async (req, res) => {
  try {
    const filePath = path.join(LOCAL_AVATARS_DIR, req.params.userId, req.params.fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Avatar not found" });
    }
    const ext = path.extname(req.params.fileName).toLowerCase();
    const mimeTypes = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
    res.setHeader("Content-Type", mimeTypes[ext] || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(filePath);
  } catch (err) {
    console.error("[AVATAR] Serve error:", err);
    res.status(500).json({ message: "Failed to serve avatar" });
  }
});

// Get current user profile
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        plan: true,
        wantsConsoleEarlyAccess: true,
      },
    });

    res.json({ user });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ message: "Failed to get profile" });
  }
});

// Update user profile
router.patch("/me", authMiddleware, async (req, res) => {
  try {
    const { displayName, firstName, lastName, wantsConsoleEarlyAccess } = req.body;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(wantsConsoleEarlyAccess !== undefined && { wantsConsoleEarlyAccess }),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        plan: true,
        wantsConsoleEarlyAccess: true,
      },
    });

    res.json({ message: "Profile updated", user });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// Change password
router.put("/password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user.password) {
      return res.status(400).json({ message: "Cannot change password without existing credential password" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashedPassword },
    });

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Failed to change password" });
  }
});

// Upload avatar
router.post("/me/avatar", authMiddleware, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Avatar file is required" });
    }

    if (!req.file.mimetype?.startsWith("image/")) {
      return res.status(400).json({ message: "Avatar must be an image file" });
    }

    const safeName = String(req.file.originalname || "avatar")
      .replace(/[^\w.\-]/g, "_")
      .replace(/_{2,}/g, "_");

    const key = `avatars/${req.userId}/${Date.now()}-${safeName}`;
    console.log("[AVATAR] Uploading:", key, "type:", req.file.mimetype, "size:", req.file.buffer.length);

    let avatarUrl = await uploadBuffer({
      key,
      body: req.file.buffer,
      contentType: req.file.mimetype,
    });

    console.log("[AVATAR] uploadBuffer returned:", avatarUrl);

    // Fallback: if uploadBuffer returned null/undefined/falsy, save locally
    if (!avatarUrl) {
      console.warn("[AVATAR] uploadBuffer returned falsy, falling back to local disk");
      const userDir = path.join(LOCAL_AVATARS_DIR, req.userId);
      if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
      const fileName = path.basename(key);
      const filePath = path.join(userDir, fileName);
      fs.writeFileSync(filePath, req.file.buffer);
      avatarUrl = `${env.FRONTEND_URL || "http://localhost:5500"}/api/users/me/avatar/${req.userId}/${fileName}`;
      console.log("[AVATAR] Local fallback URL:", avatarUrl);
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });
    console.log("[AVATAR] DB updated, user.avatarUrl:", user.avatarUrl);
    return res.json({ message: "Avatar uploaded", user });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return res.status(500).json({ message: "Failed to upload avatar" });
  }
});

export default router;
