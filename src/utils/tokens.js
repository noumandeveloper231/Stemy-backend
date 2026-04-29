import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const createAccessToken = (userId) =>
  jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_SECRET);

export const randomToken = () => crypto.randomBytes(32).toString("hex");
