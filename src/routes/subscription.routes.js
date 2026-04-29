import express from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  createCheckoutSession,
  createPortalSession,
  getCurrentSubscription,
} from "../controllers/subscription.controller.js";

const router = express.Router();

router.post("/checkout", authMiddleware, createCheckoutSession);
router.post("/portal", authMiddleware, createPortalSession);
router.get("/current", authMiddleware, getCurrentSubscription);

export default router;
