import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", ["GET", "HEAD"]);
    return res.status(405).end();
  }

  const { path: pathSegments } = req.query;
  if (!pathSegments || !Array.isArray(pathSegments) || pathSegments.length === 0) {
    return res.status(400).json({ error: "Invalid media path" });
  }

  // Validate no directory traversal in segments
  if (pathSegments.some((s) => s.includes("..") || s === ".")) {
    return res.status(400).json({ error: "Invalid path segments" });
  }

  // Sanitized filename (last segment is the actual file)
  const lastSegment = pathSegments[pathSegments.length - 1] ?? "";
  const filename = path.basename(lastSegment);
  const ext = path.extname(filename).toLowerCase();
  const mimeType = MIME_TYPES[ext] || "application/octet-stream";

  // Check possible locations in public/uploads/anki/
  const cwd = process.cwd();
  const baseUploadsDir = fs.existsSync(path.resolve(cwd, "public/uploads/anki"))
    ? path.resolve(cwd, "public/uploads/anki")
    : path.resolve(cwd, "apps/next/public/uploads/anki");
  const relativeJoined = pathSegments.map((s) => path.basename(s)).join(path.sep);
  const pathOption1 = path.join(baseUploadsDir, relativeJoined);
  const pathOption2 = path.join(baseUploadsDir, filename);

  let targetFile = "";
  if (fs.existsSync(pathOption1)) {
    targetFile = pathOption1;
  } else if (fs.existsSync(pathOption2)) {
    targetFile = pathOption2;
  } else {
    return res.status(404).json({ error: "Media not found" });
  }

  const resolved = path.resolve(targetFile);
  if (!resolved.startsWith(baseUploadsDir + path.sep)) {
    return res.status(403).json({ error: "Access denied" });
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolved);
  } catch {
    return res.status(404).json({ error: "Media not found" });
  }
  if (!stat.isFile()) {
    return res.status(404).json({ error: "Media not found" });
  }

  res.setHeader("Content-Type", mimeType);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (ext === ".svg") {
    res.setHeader(
      "Content-Security-Policy",
      "sandbox; default-src 'none'; style-src 'unsafe-inline'",
    );
  }
  res.setHeader("Cache-Control", "public, max-age=3600, must-revalidate");

  if (req.method === "HEAD") {
    res.setHeader("Content-Length", stat.size);
    return res.status(200).end();
  }

  let start = 0;
  let end = Math.max(0, stat.size - 1);
  const range = req.headers.range;
  if (range && stat.size > 0) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      return res
        .status(416)
        .setHeader("Content-Range", `bytes */${stat.size}`)
        .end();
    }
    start = match[1] ? parseInt(match[1], 10) : 0;
    end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
    if (isNaN(start) || isNaN(end) || start > end || end >= stat.size) {
      return res
        .status(416)
        .setHeader("Content-Range", `bytes */${stat.size}`)
        .end();
    }
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    res.setHeader("Content-Length", end - start + 1);
  } else {
    res.setHeader("Content-Length", stat.size);
  }

  const stream = fs.createReadStream(
    resolved,
    stat.size > 0 ? { start, end } : undefined,
  );
  stream.on("error", () => {
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to read media file" });
    } else {
      res.end();
    }
  });
  res.on("close", () => stream.destroy());
  stream.pipe(res);
}
