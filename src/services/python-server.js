import { env } from "../config/env.js";

const defaultUrl = env.NODE_ENV === "production" 
  ? "https://stemy-python.onrender.com" 
  : "http://localhost:5050";

export const startPythonServer = async () => {
  const url = env.PYTHON_ENGINE_URL || defaultUrl;
  console.log("[Python] Using engine:", url);
};

export const stopPythonServer = () => {};