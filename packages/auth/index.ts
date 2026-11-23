import type { GetServerSidePropsContext } from "next";
import { type Session, getServerSession } from "next-auth";

import { prisma } from "@quenti/prisma";

import pjson from "../../apps/next/package.json";
import { authOptions } from "./next-auth-options";

const APP_VERSION = pjson.version;

// Temporary passwordless full-access mode: cache the default personal owner
// account in memory for 5 minutes so every page & tRPC endpoint works without
// requiring a login screen.
let cachedDefaultSession: { session: Session; expiresAt: number } | null = null;
const DEFAULT_SESSION_TTL_MS = 5 * 60 * 1000;

export const invalidateDefaultOwnerSession = () => {
  cachedDefaultSession = null;
};

export const getDefaultOwnerSession = async (): Promise<Session | null> => {
  const now = Date.now();
  if (cachedDefaultSession && cachedDefaultSession.expiresAt > now) {
    return cachedDefaultSession.session;
  }

  let user = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "PNO User",
        username: "pno",
        email: "pno@local.app",
        displayName: true,
        completedOnboarding: true,
      },
    });
  } else if (!user.username || !user.completedOnboarding) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        username: user.username || "pno",
        completedOnboarding: true,
      },
    });
  }

  const session: Session = {
    user: {
      id: user.id,
      name: user.name ?? "PNO User",
      email: user.email ?? undefined,
      image: user.image ?? undefined,
      username: user.username || "pno",
      displayName: user.displayName,
      type: user.type,
      banned: !!user.bannedAt,
      flags: user.flags,
      completedOnboarding: true,
      organizationId: user.organizationId,
      isOrgEligible: user.isOrgEligible,
    },
    expires: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
    version: APP_VERSION,
  };

  cachedDefaultSession = {
    session,
    expiresAt: now + DEFAULT_SESSION_TTL_MS,
  };

  return session;
};

/**
 * Wrapper for getServerSession, used in tRPC createContext, SSR, and API routes.
 * Falls back to the default owner session while login is temporarily disabled.
 */
export const getServerAuthSession = async (ctx: {
  req: GetServerSidePropsContext["req"];
  res: GetServerSidePropsContext["res"];
}) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (session?.user) {
    return session;
  }
  return await getDefaultOwnerSession();
};
