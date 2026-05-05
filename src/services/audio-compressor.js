import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { Readable } from "stream";
import path from "path";
import os from "os";

ffmpeg.setFfmpegPath(ffmpegStatic);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB - compress if larger

export const compressAudioIfNeeded = async (inputBuffer, mimeType, filename) => {
  const fileSize = inputBuffer.byteLength;
  
  console.log("[COMPRESS] Input file size:", fileSize, "bytes, type:", mimeType);
  
  // Only compress if file is larger than 50MB
  if (fileSize <= MAX_FILE_SIZE) {
    console.log("[COMPRESS] File within size limit, skipping compression");
    return { buffer: inputBuffer, wasCompressed: false };
  }
  
  console.log("[COMPRESS] File too large, compressing...");
  
  return new Promise((resolve, reject) => {
    const tempInput = path.join(os.tmpdir(), `input_${Date.now()}.mp3`);
    const tempOutput = path.join(os.tmpdir(), `output_${Date.now()}.mp3`);
    
    // Write input buffer to temp file
    require("fs").writeFileSync(tempInput, Buffer.from(inputBuffer));
    
    ffmpeg(tempInput)
      .audioCodec("libmp3lame")
      .audioBitrate("192k") // Good quality, smaller file
      .output(tempOutput)
      .on("progress", (progress) => {
        console.log("[COMPRESS] Progress:", Math.round(progress.percent || 0), "%");
      })
      .on("end", () => {
        console.log("[COMPRESS] Compression complete");
        const outputBuffer = require("fs").readFileSync(tempOutput);
        
        // Clean up temp files
        try {
          require("fs").unlinkSync(tempInput);
          require("fs").unlinkSync(tempOutput);
        } catch (e) {}
        
        console.log("[COMPRESS] Output size:", outputBuffer.byteLength, "bytes");
        console.log("[COMPRESS] Reduction:", Math.round((1 - outputBuffer.byteLength / fileSize) * 100), "%");
        
        resolve({ buffer: outputBuffer, wasCompressed: true });
      })
      .on("error", (err) => {
        console.error("[COMPRESS] Error:", err.message);
        // Clean up and return original if compression fails
        try {
          require("fs").unlinkSync(tempInput);
          require("fs").unlinkSync(tempOutput);
        } catch (e) {}
        resolve({ buffer: inputBuffer, wasCompressed: false });
      })
      .run();
  });
};

export const compressAudioStream = async (readableStream, mimeType) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on("data", (chunk) => chunks.push(chunk));
    readableStream.on("end", async () => {
      const buffer = Buffer.concat(chunks);
      const result = await compressAudioIfNeeded(buffer, mimeType, "stream");
      resolve(result);
    });
    readableStream.on("error", reject);
  });
};