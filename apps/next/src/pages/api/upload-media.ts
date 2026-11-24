import { put } from "@vercel/blob";
import fs from "fs";
import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";

import { getServerAuthSession } from "@quenti/auth";
import { uploadSingleMediaWithFailover } from "@quenti/images/server";

export const config = {
  api: {
    bodyParser: false,
  },
};

const ALLOWED_SKILLS = new Set(["listening", "reading", "writing", "speaking"]);
const ALLOWED_AUDIO_EXTS = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".ogg",
  ".webm",
  ".mp4",
]);
const ALLOWED_IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

const UPLOAD_WINDOW_MS = 10 * 60 * 1000;
const MAX_UPLOADS_PER_WINDOW = 30;
const uploadRateLimit = new Map<string, { count: number; resetAt: number }>();

const checkUploadRateLimit = (key: string): boolean => {
  const now = Date.now();
  const entry = uploadRateLimit.get(key);
  if (!entry || entry.resetAt <= now) {
    if (uploadRateLimit.size > 1000) uploadRateLimit.clear();
    uploadRateLimit.set(key, { count: 1, resetAt: now + UPLOAD_WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_UPLOADS_PER_WINDOW) {
    return false;
  }
  entry.count += 1;
  return true;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const session = await getServerAuthSession({ req, res });
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!checkUploadRateLimit(session.user.id)) {
    return res
      .status(429)
      .json({ error: "Too many uploads. Please wait a few minutes." });
  }

  const skill = String(
    req.query.skill || req.headers["x-skill"] || "listening",
  );
  if (!ALLOWED_SKILLS.has(skill)) {
    return res.status(400).json({ error: "Unsupported media skill." });
  }

  const rawTestId = String(
    req.query.testId || req.headers["x-test-id"] || "custom-test",
  );
  const rawFilename = String(
    req.query.filename ||
      req.headers["x-filename"] ||
      `media_${Date.now()}.mp3`,
  );

  const testId = rawTestId.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 100);
  const baseFilename = path
    .basename(rawFilename)
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .slice(0, 150);
  const ext = path.extname(baseFilename).toLowerCase();

  const isImage = ALLOWED_IMAGE_EXTS.has(ext);
  const isAudio = ALLOWED_AUDIO_EXTS.has(ext);
  if (!isImage && !isAudio) {
    return res.status(400).json({
      error:
        "Unsupported file type. Allowed audio: mp3, wav, m4a, ogg, webm, mp4. Allowed images: png, jpg, jpeg, webp, gif.",
    });
  }

  // Unique prefix prevents overwriting built-in or other users' assets
  const filename = `${Date.now()}_${baseFilename}`;
  const subFolder = isImage || skill === "writing" ? "pic" : "audio";

  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > MAX_UPLOAD_BYTES) {
    return res.status(413).json({ error: "Upload exceeds the 25 MB limit." });
  }

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let receivedBytes = 0;
    req.on("data", (chunk: Buffer) => {
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_UPLOAD_BYTES) {
        reject(new Error("Upload exceeds the 25 MB limit."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  }).catch((err: Error) => {
    res.status(413).json({ error: err.message });
    return null;
  });

  if (!buffer) return;

  const ownerPrefix = session.user.id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const relPath = `tests/${ownerPrefix}/${skill}/${testId}/${subFolder}/${filename}`;

  // 1. Try Primary S3 (Tigris / Cloudflare R2 with Hard Quota Guard) -> Backup GitHub quenti-media
  const cloudKey = `ielts/${relPath}`;
  const uploadedCloud = await uploadSingleMediaWithFailover(
    { name: filename, content: buffer },
    cloudKey,
  );
  if (uploadedCloud) {
    return res.status(200).json({
      success: true,
      url: uploadedCloud.url,
      filename,
      size: buffer.length,
      provider: uploadedCloud.provider,
      fallbackUsed: uploadedCloud.fallbackUsed,
    });
  }

  // 2. Vercel Blob fallback if configured
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const uploaded = await put(cloudKey, buffer, {
        access: "public",
        addRandomSuffix: false,
      });
      return res.status(200).json({
        success: true,
        url: uploaded.url,
        filename,
        size: buffer.length,
      });
    } catch (err) {
      console.warn("Vercel Blob upload failed, trying local fallback:", err);
    }
  }

  // 3. Local filesystem fallback (dev / self-hosted server)
  try {
    const cwd = process.cwd();
    const publicRoot = fs.existsSync(path.resolve(cwd, "public"))
      ? path.resolve(cwd, "public")
      : path.resolve(cwd, "apps/next/public");
    const targetDir = path.join(
      publicRoot,
      "tests",
      ownerPrefix,
      skill,
      testId,
      subFolder,
    );
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, filename), buffer);

    const webUrl = `/${relPath}`;
    return res.status(200).json({
      success: true,
      url: webUrl,
      filename,
      size: buffer.length,
    });
  } catch (err) {
    return res.status(500).json({
      error:
        err instanceof Error ? err.message : "Unable to persist media file.",
    });
  }
}
