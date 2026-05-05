import { spawn } from "child_process";
import { env } from "../config/env.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

let pythonProcess = null;

export const startPythonServer = async () => {
  if (env.PYTHON_ENGINE_URL) {
    console.log("[Python] Using external:", env.PYTHON_ENGINE_URL);
    return;
  }

  if (env.NODE_ENV === "test") {
    console.log("[Python] Skipping (test mode)");
    return;
  }

  const pythonPort = env.PYTHON_PORT || 5050;
  const pythonUrl = `http://127.0.0.1:${pythonPort}`;
  
  console.log("[Python] Starting on port", pythonPort);

  try {
    const pythonScript = path.join(projectRoot, "mastering_engine", "app.py");
    
    pythonProcess = spawn("python3", [pythonScript], {
      cwd: projectRoot,
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        PORT: pythonPort,
        FLASK_ENV: env.NODE_ENV === "production" ? "production" : "development",
      },
    });

    pythonProcess.on("error", (err) => {
      console.error("[Python] Process error:", err.message);
    });

    pythonProcess.on("exit", (code, signal) => {
      console.log("[Python] Process exited with code", code, "signal:", signal);
    });

    pythonProcess.unref();

    await new Promise(resolve => setTimeout(resolve, 2000));

    process.env.PYTHON_ENGINE_URL = pythonUrl;
    console.log("[Python] Ready at", pythonUrl);
  } catch (err) {
    console.error("[Python] Failed to start:", err.message);
  }
};

export const stopPythonServer = () => {
  if (pythonProcess) {
    try {
      process.kill(-pythonProcess.pid, "SIGTERM");
    } catch (e) {}
  }
};