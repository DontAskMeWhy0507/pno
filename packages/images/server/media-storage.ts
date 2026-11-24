import {
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export interface MediaFileInput {
  name: string;
  content: Buffer;
}

export interface MediaS3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
  maxBytes: number;
  maxObjects: number;
  isR2: boolean;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: "BYTE_QUOTA_REACHED" | "OBJECT_QUOTA_REACHED";
  projectedBytes: number;
  projectedObjects: number;
}

export interface MediaBatchUploadResult {
  mediaBase: string;
  provider: "s3" | "github";
  fallbackUsed: boolean;
  reason?: string;
}

export interface SingleMediaUploadResult {
  url: string;
  provider: "s3" | "github";
  fallbackUsed: boolean;
  reason?: string;
}

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;
const QUOTA_CACHE_TTL_MS = 5 * 60 * 1000;
const S3_CONCURRENCY = 16;
const GH_BLOB_CONCURRENCY = 16;

let cachedS3Usage: {
  key: string;
  totalBytes: number;
  objectCount: number;
  fetchedAt: number;
} | null = null;

let cachedS3Client: {
  key: string;
  client: S3Client;
} | null = null;

export function sanitizeMediaFileName(raw: string): string {
  const base = raw.replace(/\\/g, "/").split("/").pop() ?? "media";
  return base.replace(INVALID_FILENAME_CHARS, "_").slice(0, 180) || "media";
}

export function detectMediaContentType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "webm":
      return "audio/webm";
    case "mp4":
      return "video/mp4";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

export function evaluateS3QuotaHeadroom(params: {
  currentBytes: number;
  currentObjects: number;
  incomingBytes: number;
  incomingObjects: number;
  maxBytes: number;
  maxObjects: number;
}): QuotaCheckResult {
  const projectedBytes = params.currentBytes + Math.max(0, params.incomingBytes);
  const projectedObjects =
    params.currentObjects + Math.max(0, params.incomingObjects);

  if (projectedBytes > params.maxBytes) {
    return {
      allowed: false,
      reason: "BYTE_QUOTA_REACHED",
      projectedBytes,
      projectedObjects,
    };
  }
  if (projectedObjects > params.maxObjects) {
    return {
      allowed: false,
      reason: "OBJECT_QUOTA_REACHED",
      projectedBytes,
      projectedObjects,
    };
  }
  return {
    allowed: true,
    projectedBytes,
    projectedObjects,
  };
}

export function getMediaS3Config(): MediaS3Config | null {
  const endpoint =
    process.env.MEDIA_S3_ENDPOINT?.trim() ||
    (process.env.R2_ACCOUNT_ID?.trim()
      ? `https://${process.env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`
      : "");
  const bucket =
    process.env.MEDIA_S3_BUCKET?.trim() ||
    process.env.ASSETS_BUCKET_NAME?.trim() ||
    "";
  const accessKeyId =
    process.env.MEDIA_S3_ACCESS_KEY_ID?.trim() ||
    process.env.R2_ACCESS_KEY_ID?.trim() ||
    "";
  const secretAccessKey =
    process.env.MEDIA_S3_SECRET_ACCESS_KEY?.trim() ||
    process.env.R2_SECRET_ACCESS_KEY?.trim() ||
    "";
  const publicUrl = (
    process.env.MEDIA_S3_PUBLIC_URL?.trim() ||
    process.env.ASSETS_BUCKET_URL?.trim() ||
    ""
  ).replace(/\/+$/, "");

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicUrl) {
    return null;
  }

  const isR2 = endpoint.includes("r2.cloudflarestorage.com");
  const defaultMaxBytes = isR2 ? 9_000_000_000 : 4_500_000_000; // 90% hard cap
  const defaultMaxObjects = isR2 ? 500_000 : 90_000;

  const parsedMaxBytes = Number(process.env.MEDIA_S3_MAX_BYTES);
  const parsedMaxObjects = Number(process.env.MEDIA_S3_MAX_OBJECTS);

  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    region: process.env.MEDIA_S3_REGION?.trim() || "auto",
    bucket,
    accessKeyId,
    secretAccessKey,
    publicUrl,
    maxBytes:
      Number.isFinite(parsedMaxBytes) && parsedMaxBytes > 0
        ? parsedMaxBytes
        : defaultMaxBytes,
    maxObjects:
      Number.isFinite(parsedMaxObjects) && parsedMaxObjects > 0
        ? parsedMaxObjects
        : defaultMaxObjects,
    isR2,
  };
}

function getS3Client(cfg: MediaS3Config): S3Client {
  const cacheKey = `${cfg.endpoint}|${cfg.region}|${cfg.bucket}|${cfg.accessKeyId}`;
  if (cachedS3Client && cachedS3Client.key === cacheKey) {
    return cachedS3Client.client;
  }
  const client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  cachedS3Client = { key: cacheKey, client };
  return client;
}

async function getBucketUsage(
  cfg: MediaS3Config,
  client: S3Client,
): Promise<{ totalBytes: number; objectCount: number }> {
  const cacheKey = `${cfg.endpoint}|${cfg.bucket}`;
  const now = Date.now();
  if (
    cachedS3Usage &&
    cachedS3Usage.key === cacheKey &&
    now - cachedS3Usage.fetchedAt < QUOTA_CACHE_TTL_MS
  ) {
    return {
      totalBytes: cachedS3Usage.totalBytes,
      objectCount: cachedS3Usage.objectCount,
    };
  }

  let totalBytes = 0;
  let objectCount = 0;
  let continuationToken: string | undefined;

  // Paginate until complete or hard cap already reached (stops early on large buckets)
  for (let page = 0; page < 100; page++) {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: cfg.bucket,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );

    const contents = res.Contents ?? [];
    for (const item of contents) {
      totalBytes += Number(item.Size ?? 0);
      objectCount += 1;
    }

    if (totalBytes >= cfg.maxBytes || objectCount >= cfg.maxObjects) {
      break;
    }

    if (!res.IsTruncated || !res.NextContinuationToken) {
      break;
    }
    continuationToken = res.NextContinuationToken;
  }

  cachedS3Usage = {
    key: cacheKey,
    totalBytes,
    objectCount,
    fetchedAt: now,
  };

  return { totalBytes, objectCount };
}

function recordS3UsageDelta(
  cfg: MediaS3Config,
  addedBytes: number,
  addedObjects: number,
) {
  const cacheKey = `${cfg.endpoint}|${cfg.bucket}`;
  if (cachedS3Usage && cachedS3Usage.key === cacheKey) {
    cachedS3Usage.totalBytes += Math.max(0, addedBytes);
    cachedS3Usage.objectCount += Math.max(0, addedObjects);
  }
}

export async function uploadFilesToS3(
  files: MediaFileInput[],
  prefix: string,
  estimatedTotalBytes?: number,
): Promise<{
  mediaBase: string;
  blockedReason?: QuotaCheckResult["reason"];
} | null> {
  const cfg = getMediaS3Config();
  if (!cfg || files.length === 0) return null;

  const client = getS3Client(cfg);
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "");
  const batchBytes = files.reduce((sum, f) => sum + f.content.length, 0);
  const incomingBytes = Math.max(batchBytes, estimatedTotalBytes ?? 0);

  try {
    const usage = await getBucketUsage(cfg, client);
    const headroom = evaluateS3QuotaHeadroom({
      currentBytes: usage.totalBytes,
      currentObjects: usage.objectCount,
      incomingBytes,
      incomingObjects: files.length,
      maxBytes: cfg.maxBytes,
      maxObjects: cfg.maxObjects,
    });

    if (!headroom.allowed) {
      console.warn(
        `[MediaStorage] S3 hard quota guard triggered (${headroom.reason}): ${headroom.projectedBytes}/${cfg.maxBytes} bytes, ${headroom.projectedObjects}/${cfg.maxObjects} objects. Failing over to backup storage.`,
      );
      return { mediaBase: "", blockedReason: headroom.reason };
    }

    for (let i = 0; i < files.length; i += S3_CONCURRENCY) {
      const chunk = files.slice(i, i + S3_CONCURRENCY);
      await Promise.all(
        chunk.map((file) => {
          const safeName = sanitizeMediaFileName(file.name);
          const key = cleanPrefix ? `${cleanPrefix}/${safeName}` : safeName;
          return client.send(
            new PutObjectCommand({
              Bucket: cfg.bucket,
              Key: key,
              Body: file.content,
              ContentType: detectMediaContentType(safeName),
              CacheControl: "public, max-age=31536000, immutable",
            }),
          );
        }),
      );
    }

    recordS3UsageDelta(cfg, batchBytes, files.length);
    return {
      mediaBase: cleanPrefix ? `${cfg.publicUrl}/${cleanPrefix}` : cfg.publicUrl,
    };
  } catch (err) {
    console.warn("[MediaStorage] S3 upload failed, triggering failover:", err);
    return null;
  }
}

export async function uploadFilesToGithubMedia(
  files: MediaFileInput[],
  prefix: string,
): Promise<string | null> {
  const ghToken = process.env.GITHUB_MEDIA_TOKEN?.trim();
  if (!ghToken || files.length === 0) return null;

  const owner = process.env.GITHUB_MEDIA_OWNER?.trim() || "DontAskMeWhy0507";
  const repo = process.env.GITHUB_MEDIA_REPO?.trim() || "quenti-media";
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "");
  const headers = {
    Authorization: `Bearer ${ghToken}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  try {
    // 1. Create Git blobs once in parallel batches of 16
    const blobs: {
      path: string;
      mode: "100644";
      type: "blob";
      sha: string;
    }[] = [];

    for (let i = 0; i < files.length; i += GH_BLOB_CONCURRENCY) {
      const chunk = files.slice(i, i + GH_BLOB_CONCURRENCY);
      const created = await Promise.all(
        chunk.map(async (f) => {
          const safeName = sanitizeMediaFileName(f.name);
          const blobRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                content: f.content.toString("base64"),
                encoding: "base64",
              }),
              signal: AbortSignal.timeout(20_000),
            },
          );
          if (!blobRes.ok) return null;
          const blobJson = (await blobRes.json()) as { sha?: string };
          return blobJson.sha
            ? {
                path: cleanPrefix ? `${cleanPrefix}/${safeName}` : safeName,
                mode: "100644" as const,
                type: "blob" as const,
                sha: blobJson.sha,
              }
            : null;
        }),
      );
      for (const item of created) {
        if (item) blobs.push(item);
      }
    }

    if (blobs.length === 0) return null;

    // 2. Attach blobs onto latest HEAD without force-overwriting concurrent batches
    for (let attempt = 0; attempt < 4; attempt++) {
      const refRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/main`,
        { headers, signal: AbortSignal.timeout(10_000) },
      );
      if (!refRes.ok) throw new Error(`GitHub ref fetch failed (${refRes.status})`);
      const refJson = (await refRes.json()) as { object?: { sha?: string } };
      const parentCommitSha = refJson.object?.sha;
      if (!parentCommitSha) throw new Error("Missing HEAD commit SHA");

      const commitRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/commits/${parentCommitSha}`,
        { headers, signal: AbortSignal.timeout(10_000) },
      );
      if (!commitRes.ok)
        throw new Error(`GitHub commit fetch failed (${commitRes.status})`);
      const commitJson = (await commitRes.json()) as { tree?: { sha?: string } };
      const baseTreeSha = commitJson.tree?.sha;
      if (!baseTreeSha) throw new Error("Missing base tree SHA");

      const newTreeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            base_tree: baseTreeSha,
            tree: blobs,
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!newTreeRes.ok)
        throw new Error(`GitHub tree creation failed (${newTreeRes.status})`);
      const newTreeJson = (await newTreeRes.json()) as { sha?: string };
      if (!newTreeJson.sha) throw new Error("Missing new tree SHA");

      const newCommitRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/commits`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: `Media upload batch (${blobs.length} files)`,
            tree: newTreeJson.sha,
            parents: [parentCommitSha],
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!newCommitRes.ok)
        throw new Error(`GitHub commit creation failed (${newCommitRes.status})`);
      const newCommitJson = (await newCommitRes.json()) as { sha?: string };
      if (!newCommitJson.sha) throw new Error("Missing new commit SHA");

      const updateRefRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/main`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            sha: newCommitJson.sha,
            force: false,
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (updateRefRes.ok) {
        return cleanPrefix
          ? `https://cdn.jsdelivr.net/gh/${owner}/${repo}@main/${cleanPrefix}`
          : `https://cdn.jsdelivr.net/gh/${owner}/${repo}@main`;
      }

      if (updateRefRes.status === 409 || updateRefRes.status === 422) {
        continue; // Parallel batch advanced HEAD; retry on new HEAD without re-uploading blobs
      }

      throw new Error(`GitHub ref update failed (${updateRefRes.status})`);
    }

    throw new Error("GitHub ref update conflicted after retries");
  } catch (err) {
    console.warn("[MediaStorage] GitHub backup batch upload warning:", err);
    return null;
  }
}

export async function uploadMediaBatchWithFailover(
  files: MediaFileInput[],
  prefix: string,
  options?: { estimatedTotalBytes?: number },
): Promise<MediaBatchUploadResult | null> {
  if (files.length === 0) return null;

  const s3ConfigExists = Boolean(getMediaS3Config());
  let failoverReason: string | undefined;

  if (s3ConfigExists) {
    const s3Res = await uploadFilesToS3(
      files,
      prefix,
      options?.estimatedTotalBytes,
    );
    if (s3Res && s3Res.mediaBase && !s3Res.blockedReason) {
      return {
        mediaBase: s3Res.mediaBase,
        provider: "s3",
        fallbackUsed: false,
      };
    }
    failoverReason = s3Res?.blockedReason ?? "S3_UPLOAD_FAILED";
  }

  const ghMediaBase = await uploadFilesToGithubMedia(files, prefix);
  if (ghMediaBase) {
    return {
      mediaBase: ghMediaBase,
      provider: "github",
      fallbackUsed: s3ConfigExists,
      reason: failoverReason,
    };
  }

  return null;
}

export async function uploadSingleMediaWithFailover(
  file: MediaFileInput,
  fullKey: string,
): Promise<SingleMediaUploadResult | null> {
  const normalizedKey = fullKey.replace(/^\/+|\/+$/g, "");
  const lastSlash = normalizedKey.lastIndexOf("/");
  const prefix = lastSlash === -1 ? "" : normalizedKey.slice(0, lastSlash);
  const fileName =
    lastSlash === -1 ? normalizedKey : normalizedKey.slice(lastSlash + 1);

  const cfg = getMediaS3Config();
  let failoverReason: string | undefined;

  if (cfg) {
    const res = await uploadFilesToS3(
      [{ name: fileName, content: file.content }],
      prefix,
    );
    if (res && res.mediaBase && !res.blockedReason) {
      return {
        url: `${cfg.publicUrl}/${normalizedKey.split("/").map(encodeURIComponent).join("/")}`,
        provider: "s3",
        fallbackUsed: false,
      };
    }
    failoverReason = res?.blockedReason ?? "S3_UPLOAD_FAILED";
  }

  const ghToken = process.env.GITHUB_MEDIA_TOKEN?.trim();
  if (ghToken) {
    const owner = process.env.GITHUB_MEDIA_OWNER?.trim() || "DontAskMeWhy0507";
    const repo = process.env.GITHUB_MEDIA_REPO?.trim() || "quenti-media";
    const encodedPath = normalizedKey
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

    try {
      let existingSha: string | undefined;
      const checkRes = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: "application/vnd.github+json",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (checkRes.ok) {
        const existingJson = (await checkRes.json()) as { sha?: string };
        existingSha = existingJson.sha;
      }

      const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `upload media ${fileName}`,
          content: file.content.toString("base64"),
          ...(existingSha ? { sha: existingSha } : {}),
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (putRes.ok) {
        return {
          url: `https://cdn.jsdelivr.net/gh/${owner}/${repo}@main/${encodedPath}`,
          provider: "github",
          fallbackUsed: Boolean(cfg),
          reason: failoverReason,
        };
      }
    } catch (err) {
      console.warn("[MediaStorage] GitHub single upload warning:", err);
    }
  }

  return null;
}
