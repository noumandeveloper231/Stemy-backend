import { spawn } from "child_process";
import { env } from "../config/env.js";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

let pythonProcess = null;
let pythonReady = false;

async function waitForPython(port, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
          resolve(res.statusCode === 200);
        });
        req.on("error", reject);
        req.setTimeout(2000, () => req.destroy());
      });
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return false;
}

export const startPythonServer = async () => {
  // If external URL provided, use that
  if (env.PYTHON_ENGINE_URL && !env.PYTHON_ENGINE_URL.includes("localhost")) {
    console.log("[Python] Using external:", env.PYTHON_ENGINE_URL);
    return;
  }

  if (env.NODE_ENV === "test") {
    console.log("[Python] Skipping (test mode)");
    return;
  }

  // Skip Python if using external or in development
  if (env.NODE_ENV === "development" && !env.START_PYTHON) {
    console.log("[Python] Skipping in development (set START_PYTHON=1 to enable)");
    return;
  }

  const port = env.PYTHON_PORT || 5050;
  const url = `http://127.0.0.1:${port}`;
  
  console.log("[Python] Starting mastering engine on port", port);

  try {
    const scriptPath = path.join(projectRoot, "mastering_engine", "app.py");
    
    // Start Python completely detached
    pythonProcess = spawn("python3", [scriptPath], {
      cwd: projectRoot,
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        PORT: String(port),
        HOST: "127.0.0.1",
        FLASK_ENV: env.NODE_ENV === "production" ? "production" : "development",
      },
    });

    // Unref so Node doesn't wait for it
    pythonProcess.unref();

    // Wait for Python to be ready
    console.log("[Python] Waiting for server...");
    pythonReady = await waitForPython(port, 30000);

    if (pythonReady) {
      process.env.PYTHON_ENGINE_URL = url;
      console.log("[Python] Ready at", url);
    } else {
      console.warn("[Python] Server did not respond - may still be starting");
      process.env.PYTHON_ENGINE_URL = url;
    }
  } catch (err) {
    console.error("[Python] Failed to start:", err.message);
    process.env.PYTHON_ENGINE_URL = url;
  }
};

export const stopPythonServer = () => {
  if (pythonProcess) {
    try {
      process.kill(-pythonProcess.pid, "SIGTERM");
    } catch (e) {
      // Process may have already exited
    }
  }
};

export const isPythonReady = () => pythonReady;