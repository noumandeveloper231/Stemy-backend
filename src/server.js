import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";
import { env, assertRequiredEnvForProd } from "./config/env.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import masterRoutes from "./routes/master.routes.js";

import { startTrialReminderCron } from "./cron/trial-reminder.js";
import { startPythonServer, stopPythonServer } from "./services/python-server.js";

assertRequiredEnvForProd();

const app = express();
const PORT = env.PORT || 5500;
app.set("trust proxy", 1);

const allowedOriginsSet = new Set([
  "http://localhost:8080",
  "http://localhost:5500",
  "http://localhost:5501",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501",
  "http://127.0.0.1:8080",
]);
try {
  const u = new URL(env.FRONTEND_URL);
  allowedOriginsSet.add(u.origin);
  if (u.hostname === "localhost" && u.port) {
    allowedOriginsSet.add(`${u.protocol}//127.0.0.1:${u.port}`);
  }
} catch { /* ignore */ }
const allowedOrigins = [...allowedOriginsSet].filter(Boolean);

app.use((req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api/users") || req.path.includes("/avatar")) {
      console.log(
        `[http] ${req.method} ${req.originalUrl} origin=${req.headers.origin || "n/a"} status=${res.statusCode} ${Date.now() - started}ms`,
      );
    }
  });
  next();
});

app.use(
  "/api/webhooks",
  rateLimit({ windowMs: 60 * 1000, max: 120 }),
  webhookRoutes,
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "110mb" }));
app.use(
  rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }),
);

app.get("/", (req, res) => {
  res.json({ message: "Stemy API is running...", timestamp: Date.now() });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", python: !!env.PYTHON_ENGINE_URL });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/masters", masterRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error: env.NODE_ENV === "development" ? err.message : undefined,
  });
});

let server = null;
let keepAliveInterval = null;

export const startServer = async () => {
  try {
    await startPythonServer();
    
    server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
      startTrialReminderCron();
    });

    if (env.NODE_ENV === "production") {
      keepAliveInterval = setInterval(() => {
        console.log("[KeepAlive] Server heartbeat");
      }, 25000);
    }
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  startServer();
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

export default app;