import { env } from "../config/env.js";

export const startPythonServer = async () => {
  const url = env.PYTHON_ENGINE_URL;
  console.log("[Python] Using external engine:", url);
};

export const stopPythonServer = () => {};