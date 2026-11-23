import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import NextAuth from "next-auth";

import { getServerAuthSession } from "@quenti/auth";
import { authOptions } from "@quenti/auth/next-auth-options";

const nextAuthHandler = NextAuth(authOptions) as NextApiHandler;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const segments = req.query.nextauth;
  const action = Array.isArray(segments) ? segments[0] : segments;

  // Passwordless full-access mode: return the active or default owner session
  // directly so client hooks (useSession) never block on a login screen.
  if (req.method === "GET" && action === "session") {
    const session = await getServerAuthSession({ req, res });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json(session ?? {});
  }

  return nextAuthHandler(req, res);
}
