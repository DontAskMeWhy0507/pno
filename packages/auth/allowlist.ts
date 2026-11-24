import { env } from "@pno/env/server";
import { prisma } from "@pno/prisma";

const CACHE_TTL_MS = 60 * 1000;
const allowlistCache = new Map<string, { allowed: boolean; expiresAt: number }>();

const DEFAULT_OWNER_FALLBACK_EMAIL = "tuantrung0705@gmail.com";

export const isMagicLinkConfigured = (): boolean => {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_SENDER);
};

export const invalidateAllowlistCache = (email?: string) => {
  if (email) {
    allowlistCache.delete(email.trim().toLowerCase());
  } else {
    allowlistCache.clear();
  }
};

const parseEnvAllowlist = (): Set<string> => {
  const raw = env.ALLOWED_EMAILS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
};

/**
 * Checks whether an email address is authorized to access this private PNO workspace.
 * Order of precedence:
 * 1. `ALLOWED_EMAILS` comma-separated env var (if non-empty, exact match).
 * 2. `WhitelistedEmail` table in Prisma.
 * 3. Safety net when neither env allowlist nor DB whitelist rows exist:
 *    allow only the primary owner email (`tuantrung0705@gmail.com` or earliest non-local user)
 *    so the owner is never locked out while strangers remain blocked.
 */
export const isEmailAllowed = async (
  email?: string | null,
): Promise<boolean> => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  const now = Date.now();
  const cached = allowlistCache.get(normalized);
  if (cached && cached.expiresAt > now) {
    return cached.allowed;
  }

  let allowed = false;
  const envAllowlist = parseEnvAllowlist();

  if (envAllowlist.size > 0 && envAllowlist.has(normalized)) {
    allowed = true;
  }

  if (!allowed) {
    const dbWhitelisted = await prisma.whitelistedEmail.findUnique({
      where: { email: normalized },
      select: { email: true },
    });
    if (dbWhitelisted) {
      allowed = true;
    }
  }

  if (!allowed && envAllowlist.size === 0) {
    const whitelistCount = await prisma.whitelistedEmail.count();
    if (whitelistCount === 0) {
      if (normalized === DEFAULT_OWNER_FALLBACK_EMAIL) {
        allowed = true;
      } else {
        const earliestOwner = await prisma.user.findFirst({
          where: {
            NOT: {
              email: {
                endsWith: "@local.app",
              },
            },
          },
          orderBy: { createdAt: "asc" },
          select: { email: true },
        });
        if (earliestOwner?.email?.trim().toLowerCase() === normalized) {
          allowed = true;
        }
      }
    }
  }

  allowlistCache.set(normalized, {
    allowed,
    expiresAt: now + CACHE_TTL_MS,
  });

  return allowed;
};
