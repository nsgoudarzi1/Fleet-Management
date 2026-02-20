import { GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAppConfig } from "@/lib/config";

const localRoot = path.join(process.cwd(), ".generated-files");

function getS3Client() {
  const config = getAppConfig();
  return new S3Client({
    region: config.S3_REGION,
    endpoint: config.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: config.S3_SECRET_ACCESS_KEY ?? "",
    },
    forcePathStyle: config.S3_FORCE_PATH_STYLE || Boolean(config.S3_ENDPOINT),
  });
}

function encodePath(pathValue: string) {
  return pathValue
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildKey(input: { keyPrefix: string; fileName?: string }) {
  return `${input.keyPrefix}/${Date.now()}-${randomUUID()}-${input.fileName ?? "document.bin"}`;
}

async function putSupabaseObject(input: { key: string; body: Buffer; contentType: string }) {
  const config = getAppConfig();
  const bucket = config.SUPABASE_STORAGE_BUCKET!;
  const response = await fetch(
    `${config.SUPABASE_URL}/storage/v1/object/${encodePath(bucket)}/${encodePath(input.key)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: config.SUPABASE_SERVICE_ROLE_KEY ?? "",
        "Content-Type": input.contentType,
        "x-upsert": "true",
      },
      body: Uint8Array.from(input.body),
    },
  );
  if (!response.ok) {
    throw new Error(`Supabase upload failed (${response.status}).`);
  }
}

async function getSupabaseObjectBuffer(key: string) {
  const config = getAppConfig();
  const bucket = config.SUPABASE_STORAGE_BUCKET!;
  const response = await fetch(
    `${config.SUPABASE_URL}/storage/v1/object/${encodePath(bucket)}/${encodePath(key)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: config.SUPABASE_SERVICE_ROLE_KEY ?? "",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Supabase read failed (${response.status}).`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function getSupabaseSignedUrl(key: string, expiresInSeconds: number) {
  const config = getAppConfig();
  const bucket = config.SUPABASE_STORAGE_BUCKET!;
  const response = await fetch(
    `${config.SUPABASE_URL}/storage/v1/object/sign/${encodePath(bucket)}/${encodePath(key)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: config.SUPABASE_SERVICE_ROLE_KEY ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    },
  );
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json().catch(() => ({}))) as { signedURL?: string };
  if (!payload.signedURL) return null;
  if (payload.signedURL.startsWith("http")) return payload.signedURL;
  return `${config.SUPABASE_URL}${payload.signedURL}`;
}

export async function putPrivateObject(input: {
  keyPrefix: string;
  body: Buffer;
  contentType: string;
  fileName?: string;
}) {
  const config = getAppConfig();
  const key = buildKey({ keyPrefix: input.keyPrefix, fileName: input.fileName });

  if (config.storageMode === "local") {
    const fullPath = path.join(localRoot, key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, input.body);
    return { key: `local:${key}` };
  }

  if (config.storageMode === "supabase") {
    await putSupabaseObject({ key, body: input.body, contentType: input.contentType });
    return { key: `supabase:${key}` };
  }

  const bucket = config.S3_BUCKET!;
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
  return { key };
}

export async function getPrivateObjectBuffer(key: string) {
  if (key.startsWith("local:")) {
    const relative = key.replace("local:", "");
    const fullPath = path.join(localRoot, relative);
    return readFile(fullPath);
  }
  if (key.startsWith("supabase:")) {
    return getSupabaseObjectBuffer(key.replace("supabase:", ""));
  }

  const config = getAppConfig();
  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: config.S3_BUCKET!,
      Key: key,
    }),
  );
  if (!response.Body) {
    throw new Error("Object body not found.");
  }
  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function getPrivateObjectDownloadUrl(key: string, expiresInSeconds = 300) {
  const config = getAppConfig();
  if (config.STORAGE_DOWNLOAD_MODE === "proxy") return null;
  if (key.startsWith("local:")) return null;
  if (key.startsWith("supabase:")) {
    return getSupabaseSignedUrl(key.replace("supabase:", ""), expiresInSeconds);
  }
  if (config.STORAGE_DOWNLOAD_MODE === "signed" || config.STORAGE_DOWNLOAD_MODE === "auto") {
    return getSignedUrl(
      getS3Client(),
      new GetObjectCommand({
        Bucket: config.S3_BUCKET!,
        Key: key,
      }),
      { expiresIn: expiresInSeconds },
    );
  }
  return null;
}

export async function checkStorageHealth() {
  const config = getAppConfig();
  try {
    if (config.storageMode === "local") {
      await mkdir(localRoot, { recursive: true });
      return { ok: true, mode: "local", message: "Local storage directory ready." };
    }

    if (config.storageMode === "supabase") {
      const bucket = config.SUPABASE_STORAGE_BUCKET!;
      const response = await fetch(`${config.SUPABASE_URL}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: config.SUPABASE_SERVICE_ROLE_KEY ?? "",
        },
      });
      if (!response.ok) {
        return { ok: false, mode: "supabase", message: `Supabase bucket check failed (${response.status}).` };
      }
      return { ok: true, mode: "supabase", message: "Supabase storage reachable." };
    }

    await getS3Client().send(new HeadBucketCommand({ Bucket: config.S3_BUCKET! }));
    return { ok: true, mode: config.storageMode, message: "S3-compatible storage reachable." };
  } catch (error) {
    return {
      ok: false,
      mode: config.storageMode,
      message: error instanceof Error ? error.message : "Storage health check failed.",
    };
  }
}
