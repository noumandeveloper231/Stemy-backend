import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";

const useR2 =
  !!env.R2_ENDPOINT &&
  !!env.R2_ACCESS_KEY_ID &&
  !!env.R2_SECRET_ACCESS_KEY &&
  !!env.R2_BUCKET;

const s3 = useR2
  ? new S3Client({
      region: env.R2_REGION || "auto",
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    })
  : null;

const toPublicUrl = (key) => {
  const normalizedKey = String(key || "").replace(/^\/+/, "");
  const base = env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (base) {
    return `${base}/${normalizedKey}`;
  }
  const endpointHost = env.R2_ENDPOINT?.replace(/^https?:\/\//, "").replace(
    /\/+$/,
    "",
  );
  if (endpointHost && env.R2_BUCKET) {
    return `https://${env.R2_BUCKET}.${endpointHost}/${normalizedKey}`;
  }
  return null;
};

export const uploadBuffer = async ({ key, body, contentType }) => {
  if (!s3) {
    return `local://${key}`;
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
    }),
  );

  return toPublicUrl(key) || `r2://${env.R2_BUCKET}/${key}`;
};

export const uploadStream = async ({ key, stream, contentType, contentLength }) => {
  if (!s3) {
    return `local://${key}`;
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: stream,
      ContentType: contentType || "application/octet-stream",
      ContentLength: contentLength,
    }),
  );

  return toPublicUrl(key) || `r2://${env.R2_BUCKET}/${key}`;
};

export const getDownloadUrl = async (storageUrl, expiresIn = 900) => {
  if (storageUrl.startsWith("local://")) {
    return storageUrl;
  }

  let key;

  // Handle r2:// format (internal)
  if (storageUrl.startsWith(`r2://${env.R2_BUCKET}/`)) {
    key = storageUrl.replace(`r2://${env.R2_BUCKET}/`, "");
  }
  // Handle public R2 URLs (.cloudflarestorage.com)
  else if (storageUrl.includes(env.R2_PUBLIC_BASE_URL)) {
    key = storageUrl.replace(env.R2_PUBLIC_BASE_URL + "/", "");
  }
  // Handle R2.dev URLs
  else if (storageUrl.includes(".r2.dev")) {
    const url = new URL(storageUrl);
    key = url.pathname.replace(/^\//, "");
  }
  // Handle direct bucket URLs
  else if (storageUrl.includes(`${env.R2_BUCKET}.`)) {
    const url = new URL(storageUrl);
    key = url.pathname.replace(/^\//, "");
  }
  // Handle any other URL format
  else {
    console.error("[STORAGE] Cannot extract key from storage URL:", storageUrl);
    throw new Error("Invalid storage URL format");
  }

  console.log("[STORAGE] Extracted key:", key);
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: key,
  });

  const signedUrl = await getSignedUrl(s3, command, { expiresIn });
  console.log("[STORAGE] Generated signed URL:", signedUrl);
  return signedUrl;
};
