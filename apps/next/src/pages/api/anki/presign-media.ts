import type { NextApiRequest, NextApiResponse } from "next";

import { getServerAuthSession } from "@pno/auth";
import { createPresignedMediaUploads } from "@pno/images/server/media-storage";

export const config = {
  maxDuration: 60,
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

  const {
    importId,
    filenames,
    estimatedTotalBytes,
    estimatedTotalObjects,
    skipQuotaCheck,
    forcePresigned,
  } = req.body as {
    importId?: string;
    filenames?: string[];
    estimatedTotalBytes?: number;
    estimatedTotalObjects?: number;
    skipQuotaCheck?: boolean;
    forcePresigned?: boolean;
  };

  if (
    !Array.isArray(filenames) ||
    filenames.length === 0 ||
    filenames.length > 500 ||
    !filenames.every((f) => typeof f === "string")
  ) {
    return res.status(400).json({
      error: "filenames must be a non-empty array of at most 500 strings.",
    });
  }

  const safeImportId =
    importId?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) ||
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const prefix = `anki/imports/${safeImportId}`;

  const result = await createPresignedMediaUploads({
    filenames,
    prefix,
    estimatedTotalBytes,
    estimatedTotalObjects,
    skipQuotaCheck,
    forcePresigned,
  });

  return res.status(200).json(result);
}
