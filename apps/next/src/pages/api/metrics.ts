import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

import { env } from "@pno/env/server";
import { register } from "@pno/trpc/server/prometheus";

const safeCompare = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!env.METRICS_API_USER || !env.METRICS_API_PASSWORD) {
    return res.status(503).end("Metrics not configured");
  }

  const auth = req.headers.authorization;
  const decoded = Buffer.from(auth?.split(" ")[1] ?? "", "base64").toString();
  const sepIndex = decoded.indexOf(":");
  const username = sepIndex >= 0 ? decoded.slice(0, sepIndex) : "";
  const password = sepIndex >= 0 ? decoded.slice(sepIndex + 1) : "";

  if (
    !safeCompare(username, env.METRICS_API_USER) ||
    !safeCompare(password, env.METRICS_API_PASSWORD)
  ) {
    res.statusCode = 401;
    return res.end("Unauthorized");
  }

  res.setHeader("Content-Type", register.contentType);
  return res.end(await register.metrics());
}
