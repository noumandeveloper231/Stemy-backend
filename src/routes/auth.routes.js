import express from "express";
import {
  signup,
  login,
  googleCallback,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  verifyResetOtp,
  logout,
  getMe,
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// Email/password auth
router.post("/signup", signup);
router.post("/login", login);

// Google OAuth
router.post("/google", googleCallback);

// Email verification
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);

// Password reset
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/logout", logout);

// Get current user (protected)
router.get("/me", authMiddleware, getMe);

export default router;
