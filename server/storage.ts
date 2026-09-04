import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required storage variable: ${name}`);
  return value;
}

export async function storagePut(key: string, body: Buffer, contentType: string) {
  const bucket = required("S3_BUCKET");
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const client = new S3Client({
    region: process.env.S3_REGION?.trim() || "auto",
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
      : undefined,
  });
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const publicBase = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
  const url = publicBase
    ? `${publicBase}/${encodedKey}`
    : endpoint
      ? `${endpoint.replace(/\/$/, "")}/${encodeURIComponent(bucket)}/${encodedKey}`
      : `https://${bucket}.s3.${process.env.S3_REGION || "us-east-1"}.amazonaws.com/${encodedKey}`;
  return { key, url };
}
