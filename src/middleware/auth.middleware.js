import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../utils/tokens.js";

export const authMiddleware = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: "Access denied. No token provided." });
    }

    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, emailVerified: true, plan: true },
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.userId = decoded.userId;
    req.user = user;

    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }

    console.error("Auth middleware error:", err);
    res.status(500).json({ message: "Authentication failed" });
  }
};
