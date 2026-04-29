import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
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

  return `r2://${env.R2_BUCKET}/${key}`;
};

export const getDownloadUrl = async (storageUrl, expiresIn = 900) => {
  if (storageUrl.startsWith("local://")) {
    return storageUrl;
  }

  const key = storageUrl.replace(`r2://${env.R2_BUCKET}/`, "");
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn });
};
