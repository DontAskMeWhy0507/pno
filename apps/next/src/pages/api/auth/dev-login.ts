import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@pno/prisma";
import crypto from "crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).end();
  }

  const email = typeof req.query.email === "string" ? req.query.email.trim() : "";
  let user = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findFirst();

  if (!user) {
    user = await prisma.user.findFirst();
  }

  if (!user) {
    return res.status(404).json({ error: "No user found in local database" });
  }

  const sessionToken = crypto.randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires,
    },
  });

  res.setHeader(
    "Set-Cookie",
    `next-auth.session-token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`
  );

  const rawCallback =
    typeof req.query.callbackUrl === "string" ? req.query.callbackUrl : "/home";
  const redirectUrl =
    rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : "/home";
  res.redirect(302, redirectUrl);
  return;
}
