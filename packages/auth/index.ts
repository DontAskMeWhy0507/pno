import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";

import { isEmailAllowed } from "./allowlist";
import { authOptions } from "./next-auth-options";

export const invalidateDefaultOwnerSession = () => {
  // No-op kept for backward compatibility with user mutation handlers.
};

/**
 * Wrapper for getServerSession used in tRPC createContext, SSR, and API routes.
 * Strictly requires an authenticated session whose email passes the private allowlist.
 */
export const getServerAuthSession = async (ctx: {
  req: GetServerSidePropsContext["req"];
  res: GetServerSidePropsContext["res"];
}) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) {
    return null;
  }

  const allowed = await isEmailAllowed(session.user.email);
  if (!allowed) {
    return null;
  }

  return session;
};
