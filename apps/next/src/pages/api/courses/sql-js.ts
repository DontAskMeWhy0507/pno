import fs from "fs";
import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  try {
    const distDir = path.dirname(require.resolve("sql.js"));
    const jsPath = path.join(distDir, "sql-wasm-browser.js");
    const content = fs.readFileSync(jsPath, "utf8");
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.status(200).send(content);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to load sql.js",
    });
  }
}
