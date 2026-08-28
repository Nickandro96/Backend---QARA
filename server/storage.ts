import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const SIGNED_URL_TTL_SECONDS = 15 * 60;

/**
 * Required: AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID and
 * AWS_SECRET_ACCESS_KEY. S3_ENDPOINT is optional and enables S3-compatible
 * providers such as Cloudflare R2. The AWS SDK reads credentials from its
 * standard provider chain.
 */
function getS3Config() {
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION;
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  if (!bucket || !region) {
    const suffix = process.env.NODE_ENV === "production" ? " in production" : "";
    throw new Error(`S3 not configured — cannot store report${suffix}`);
  }
  return { bucket, region, endpoint };
}

function createS3Client(region: string, endpoint?: string): S3Client {
  return new S3Client({
    region,
    endpoint,
    // Path-style addressing is supported by R2 and avoids generating a
    // bucket-prefixed hostname from the account-specific endpoint.
    forcePathStyle: Boolean(endpoint),
  });
}

export function buildStoredObjectReference(bucket: string, key: string): string {
  return `s3://${bucket}/${key}`;
}

export function parseStoredObjectReference(reference: string, expectedBucket: string): string {
  const prefix = `s3://${expectedBucket}/`;
  if (reference.startsWith(prefix)) return reference.slice(prefix.length);

  const globalPrefix = `https://${expectedBucket}.s3.amazonaws.com/`;
  if (reference.startsWith(globalPrefix)) return decodeURIComponent(reference.slice(globalPrefix.length));

  const regionalPrefix = `https://${expectedBucket}.s3.`;
  if (reference.startsWith(regionalPrefix)) {
    const pathStart = reference.indexOf("/", regionalPrefix.length);
    if (pathStart >= 0) return decodeURIComponent(reference.slice(pathStart + 1));
  }
  throw new Error("Unsupported report storage reference");
}

export async function storagePut(
  key: string,
  body: Buffer,
  contentType: string
): Promise<{ storageReference: string }> {
  const { bucket, region, endpoint } = getS3Config();
  const client = createS3Client(region, endpoint);
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  return { storageReference: buildStoredObjectReference(bucket, key) };
}

export async function storageGetSignedUrl(reference: string): Promise<string> {
  const { bucket, region, endpoint } = getS3Config();
  const key = parseStoredObjectReference(reference, bucket);
  const client = createS3Client(region, endpoint);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: SIGNED_URL_TTL_SECONDS,
  });
}
