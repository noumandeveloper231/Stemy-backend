import express from "express";
import multer from "multer";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  createQuickMaster,
  listMasters,
  getMasterById,
  getMasterDownload,
} from "../controllers/master.controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/quick", authMiddleware, upload.single("audio"), createQuickMaster);
router.get("/", authMiddleware, listMasters);
router.get("/:id", authMiddleware, getMasterById);
router.get("/:id/download", authMiddleware, getMasterDownload);

export default router;
