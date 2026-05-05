import { spawn } from "child_process";
import { env } from "../config/env.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

let pythonProcess = null;

export const startPythonServer = async () => {
  if (env.PYTHON_ENGINE_URL) {
    console.log("[Python Server] Using external Python engine:", env.PYTHON_ENGINE_URL);
    return;
  }

  if (env.NODE_ENV === "test") {
    console.log("[Python Server] Skipping (test mode)");
    return;
  }

  const pythonPort = env.PYTHON_PORT || 5050;
  const pythonUrl = `http://localhost:${pythonPort}`;
  
  console.log("[Python Server] Starting Python mastering engine on port", pythonPort);

  if (env.NODE_ENV === "production") {
    pythonProcess = spawn("gunicorn", [
      "-w", "1",
      "-b", `127.0.0.1:${pythonPort}`,
      "--timeout", "300",
      "--log-level", "info",
      "app:app"
    ], {
      cwd: path.join(projectRoot, "mastering_engine"),
      detached: true,
      stdio: "ignore",
    });
    pythonProcess.unref();
  } else {
    pythonProcess = spawn("python3", ["mastering_engine/app.py"], {
      cwd: projectRoot,
      env: {
        ...process.env,
        PORT: pythonPort,
        FLASK_ENV: "development",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    pythonProcess.stdout.on("data", (data) => {
      console.log("[Python Server]", data.toString().trim());
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error("[Python Server Error]", data.toString().trim());
    });
  }

  pythonProcess.on("error", (err) => {
    console.error("[Python Server] Failed to start:", err.message);
  });

  pythonProcess.on("close", (code) => {
    if (code !== null) {
      console.log("[Python Server] Process exited with code", code);
    }
  });

  await new Promise(resolve => setTimeout(resolve, 2000));
  
  process.env.PYTHON_ENGINE_URL = pythonUrl;
  console.log("[Python Server] Python engine URL set to:", pythonUrl);
};

export const stopPythonServer = () => {
  if (pythonProcess && !pythonProcess.killed) {
    pythonProcess.kill("SIGTERM");
    console.log("[Python Server] Stopped");
  }
};