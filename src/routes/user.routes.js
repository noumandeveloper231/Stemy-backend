import express from "express";
import bcrypt from "bcrypt";
import multer from "multer";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";
import { uploadBuffer } from "../services/storage.service.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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
    const { displayName, firstName, lastName } = req.body;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        displayName,
        firstName,
        lastName,
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

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user.password) {
      return res.status(400).json({ message: "Cannot change password without existing credential password" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Hash new password
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
    const avatarUrl = await uploadBuffer({
      key,
      body: req.file.buffer,
      contentType: req.file.mimetype,
    });

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });
    return res.json({ message: "Avatar uploaded", user });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return res.status(500).json({ message: "Failed to upload avatar" });
  }
});

export default router;
