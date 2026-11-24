import * as fzstd from "fzstd";
import fsSync from "fs";
import fs from "fs/promises";
import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";

import { getServerAuthSession } from "@quenti/auth";
import {
  uploadFilesToGithubMedia,
  uploadMediaBatchWithFailover,
} from "@quenti/images/server";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
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

  const { importId, files, estimatedTotalBytes, forceBackup } = req.body as {
    importId?: string;
    files?: { name: string; base64: string }[];
    estimatedTotalBytes?: number;
    forceBackup?: boolean;
  };

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "No media files provided." });
  }

  const decodedFiles = files.map((f) => {
    let content = Buffer.from(f.base64, "base64");
    if (
      content.length >= 4 &&
      content[0] === 0x28 &&
      content[1] === 0xb5 &&
      content[2] === 0x2f &&
      content[3] === 0xfd
    ) {
      content = Buffer.from(fzstd.decompress(content));
    }
    const safeName =
      f.name
        .replace(/\\/g, "/")
        .split("/")
        .pop()
        ?.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
        .slice(0, 180) || "media";
    return { name: safeName, content };
  });

  const safeImportId =
    importId?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) ||
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const prefix = `anki/imports/${safeImportId}`;

  // 1. Primary S3 (Tigris / R2 with hard free-tier quota guard) -> Backup GitHub quenti-media
  if (forceBackup) {
    const ghMediaBase = await uploadFilesToGithubMedia(decodedFiles, prefix);
    if (ghMediaBase) {
      return res.status(200).json({
        mediaBase: ghMediaBase,
        provider: "github",
        fallbackUsed: true,
        reason: "S3_QUOTA_GUARD_DECK_ROUTED",
      });
    }
  } else {
    const uploaded = await uploadMediaBatchWithFailover(decodedFiles, prefix, {
      estimatedTotalBytes,
    });
    if (uploaded) {
      return res.status(200).json({
        mediaBase: uploaded.mediaBase,
        provider: uploaded.provider,
        fallbackUsed: uploaded.fallbackUsed,
        reason: uploaded.reason,
      });
    }
  }

  // 2. Local filesystem fallback (dev / self-hosted)
  try {
    const cwd = process.cwd();
    const directPublic = path.resolve(cwd, "public");
    const uploadsBase = fsSync.existsSync(directPublic)
      ? path.join(directPublic, "uploads", "anki")
      : path.resolve(cwd, "apps/next/public/uploads/anki");
    await fs.mkdir(uploadsBase, { recursive: true });
    for (const file of decodedFiles) {
      await fs.writeFile(path.join(uploadsBase, file.name), file.content);
    }
    return res.status(200).json({
      mediaBase: null,
      provider: "local",
      fallbackUsed: true,
    });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to save media batch.",
    });
  }
}
