import * as fzstd from "fzstd";
import fs from "fs/promises";
import fsSync from "fs";
import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";

import { getServerAuthSession } from "@quenti/auth";
import { uploadFilesToGithubTree } from "@quenti/trpc/server/routers/anki/import-package.handler";

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

  const { importId, files } = req.body as {
    importId?: string;
    files?: { name: string; base64: string }[];
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

  // 1. Try GitHub Git Tree batch upload
  const ghMediaBase = await uploadFilesToGithubTree(decodedFiles, importId);
  if (ghMediaBase) {
    return res.status(200).json({ mediaBase: ghMediaBase });
  }

  // 2. Local filesystem fallback
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
    return res.status(200).json({ mediaBase: null });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to save media batch.",
    });
  }
}
