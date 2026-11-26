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
    const wasmPath = path.join(distDir, "sql-wasm-browser.wasm");
    const content = fs.readFileSync(wasmPath);
    res.setHeader("Content-Type", "application/wasm");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.status(200).send(content);
  } catch (err) {
    res.status(500).json({
      error:
        err instanceof Error ? err.message : "Failed to load sql-wasm.wasm",
    });
  }
}
