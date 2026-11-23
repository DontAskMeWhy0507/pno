import { put } from "@vercel/blob";
import fs from "fs";
import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";

export const config = {
  api: {
    bodyParser: false,
  },
};

const ALLOWED_SKILLS = new Set(["listening", "reading", "writing", "speaking"]);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
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
  const filename = path
    .basename(rawFilename)
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .slice(0, 180);
  const isImage = /\.(png|jpe?g|webp|gif|svg)$/i.test(filename);
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

  const relPath = `tests/${skill}/${testId}/${subFolder}/${filename}`;

  // 1. If Vercel Blob is configured, upload there
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const uploaded = await put(`ielts/${relPath}`, buffer, {
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
      console.warn("Vercel Blob upload failed, trying fallback:", err);
    }
  }

  // 2. If GitHub Media Token is configured, upload to GitHub CDN
  const githubToken = process.env.GITHUB_MEDIA_TOKEN;
  if (githubToken) {
    try {
      const owner = process.env.GITHUB_MEDIA_OWNER || "DontAskMeWhy0507";
      const repo = process.env.GITHUB_MEDIA_REPO || "quenti-media";
      const ghPath = `ielts/${skill}/${testId}/${subFolder}/${encodeURIComponent(filename)}`;
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${ghPath}`;

      let existingSha: string | undefined;
      const checkRes = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
        },
      });
      if (checkRes.ok) {
        const existingJson = (await checkRes.json()) as { sha?: string };
        existingSha = existingJson.sha;
      }

      const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `upload ielts media ${filename}`,
          content: buffer.toString("base64"),
          ...(existingSha ? { sha: existingSha } : {}),
        }),
      });

      if (putRes.ok) {
        const cdnUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@main/ielts/${skill}/${testId}/${subFolder}/${encodeURIComponent(filename)}`;
        return res.status(200).json({
          success: true,
          url: cdnUrl,
          filename,
          size: buffer.length,
        });
      }
    } catch (err) {
      console.warn("GitHub media upload failed, trying local fallback:", err);
    }
  }

  // 3. Local filesystem fallback (dev / self-hosted server)
  try {
    const cwd = process.cwd();
    const publicRoot = fs.existsSync(path.resolve(cwd, "public"))
      ? path.resolve(cwd, "public")
      : path.resolve(cwd, "apps/next/public");
    const targetDir = path.join(publicRoot, "tests", skill, testId, subFolder);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, filename), buffer);

    if (skill === "listening") {
      const globalAudioDir = path.join(publicRoot, "audio");
      fs.mkdirSync(globalAudioDir, { recursive: true });
      fs.writeFileSync(path.join(globalAudioDir, filename), buffer);
    }

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
