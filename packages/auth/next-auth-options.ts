import { type NextAuthOptions } from "next-auth";
import type { Provider } from "next-auth/providers";
import GoogleProvider from "next-auth/providers/google";

import { env } from "@pno/env/server";
import { APP_URL } from "@pno/lib/constants/url";
import { prisma } from "@pno/prisma";

import pjson from "../../apps/next/package.json";
import { isEmailAllowed, isMagicLinkConfigured } from "./allowlist";
import { sendVerificationRequest } from "./magic-link";
import { CustomPrismaAdapter } from "./prisma-adapter";

const version = pjson.version;

export const authOptions: NextAuthOptions = {
  // Include user.id on session
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.username = user.username || "";
        session.user.displayName = user.displayName;
        session.user.type = user.type;
        session.user.banned = !!user.bannedAt;
        session.user.flags = user.flags;
        session.user.completedOnboarding = user.completedOnboarding;
        session.user.organizationId = user.organizationId;
        session.user.isOrgEligible = user.isOrgEligible;

        session.version = version;
      }
      return session;
    },
    redirect({ url, baseUrl }) {
      // Allows relative callback URLs (block protocol-relative //)
      if (url.startsWith("/") && !url.startsWith("//")) return `${baseUrl}${url}`;
      try {
        const parsed = new URL(url);
        const appUrl = new URL(APP_URL);
        if (parsed.origin === appUrl.origin) return url;
      } catch {
        // Invalid callback URL falls back to baseUrl
      }
      return baseUrl;
    },
    async signIn({ user }) {
      const allowed = await isEmailAllowed(user.email);
      if (!allowed) {
        return "/unauthorized";
      }

      return true;
    },
  },
  events: {
    // NextAuth v4 never updates the stored OAuth account row after the
    // first link, so tokens/scope saved at first sign-in go stale forever
    // (this froze the Google account at its pre-Drive scope and made the
    // Drive import ask for a reconnect on every attempt). Persist the
    // fresh grant on every Google sign-in.
    async signIn({ account }) {
      if (account?.provider !== "google" || !account.providerAccountId)
        return;
      const data: {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
        scope?: string;
        id_token?: string;
      } = {};
      if (account.access_token) data.access_token = account.access_token;
      if (account.refresh_token) data.refresh_token = account.refresh_token;
      if (account.expires_at) data.expires_at = account.expires_at;
      if (account.scope) data.scope = account.scope;
      if (account.id_token) data.id_token = account.id_token;
      if (Object.keys(data).length === 0) return;
      await prisma.account.updateMany({
        where: {
          provider: "google",
          providerAccountId: account.providerAccountId,
        },
        data,
      });
    },
  },
  pages: {
    signIn: "/auth/login",
    signOut: "/",
    newUser: "/onboarding",
    verifyRequest: "/auth/verify",
    error: "/auth/error",
  },
  // Configure one or more authentication providers
  adapter: CustomPrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          // Request minimal identity scopes on sign-in; Google Drive read-only
          // access is requested incrementally only from the Anki Drive importer.
          scope: "openid email profile",
          prompt: "select_account",
        },
      },
    }),
    ...(isMagicLinkConfigured() || env.NODE_ENV === "development"
      ? [
          {
            id: "magic",
            type: "email",
            sendVerificationRequest,
          } as unknown as Provider,
        ]
      : []),
  ],
};
