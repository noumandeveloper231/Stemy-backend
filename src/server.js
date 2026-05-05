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
const PORT = env.PORT || 3000;
app.set("trust proxy", 1);

// Middleware
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
  // Browsers send only `origin` (scheme + host + port), never a path — required for CORS match.
  allowedOriginsSet.add(u.origin);
  if (u.hostname === "localhost" && u.port) {
    allowedOriginsSet.add(`${u.protocol}//127.0.0.1:${u.port}`);
  }
} catch {
  /* ignore */
}
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
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
  }),
  webhookRoutes,
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "110mb" }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
  }),
);

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Stemy API is running..." });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/masters", masterRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error: env.NODE_ENV === "development" ? err.message : undefined,
  });
});

export const startServer = async () => {
  await startPythonServer();
  
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API URL: http://localhost:${PORT}`);
    startTrialReminderCron();
  });

  const shutdown = () => {
    console.log("Shutting down gracefully...");
    stopPythonServer();
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
};

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  startServer();
}

export default app;
