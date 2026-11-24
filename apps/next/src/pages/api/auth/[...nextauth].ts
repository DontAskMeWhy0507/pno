import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import NextAuth from "next-auth";

import { authOptions } from "@pno/auth/next-auth-options";

const nextAuthHandler = NextAuth(authOptions) as NextApiHandler;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  return nextAuthHandler(req, res);
}
