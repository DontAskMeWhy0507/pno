import { TRPCError } from "@trpc/server";

import { env } from "@quenti/env/server";

import type { NonNullableUserContext } from "../../lib/types";

export const DRIVE_NEEDS_CONSENT = "DRIVE_NEEDS_CONSENT";
export const DRIVE_NO_ACCOUNT = "DRIVE_NO_ACCOUNT";
const MAX_DRIVE_APKG_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Returns a valid Google access token for the signed-in user's linked
 * Google account, refreshing it with the stored refresh token when needed.
 * Throws a TRPCError whose message starts with DRIVE_NEEDS_CONSENT or
 * DRIVE_NO_ACCOUNT when the user has to (re)connect Google with the
 * Drive scope granted.
 */
export async function getGoogleAccessToken(
  ctx: NonNullableUserContext,
): Promise<string> {
  const account = await ctx.prisma.account.findFirst({
    where: { userId: ctx.session.user.id, provider: "google" },
  });
  if (!account) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `${DRIVE_NO_ACCOUNT}: No Google account is linked to this user.`,
    });
  }
  const scopes = (account.scope ?? "").split(/\s+/);
  const hasDriveScope = scopes.some(
    (s) =>
      s === "https://www.googleapis.com/auth/drive.readonly" ||
      s === "https://www.googleapis.com/auth/drive",
  );
  if (!hasDriveScope) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: `${DRIVE_NEEDS_CONSENT}: Google Drive access has not been granted yet. Sign in with Google again to grant it.`,
    });
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    account.access_token &&
    account.expires_at &&
    account.expires_at > now + 60
  ) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: `${DRIVE_NEEDS_CONSENT}: The Google session has expired. Sign in with Google again to reconnect Drive.`,
    });
  }

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: `${DRIVE_NEEDS_CONSENT}: Could not refresh the Google session (HTTP ${resp.status}). Sign in with Google again to reconnect Drive.`,
    });
  }
  const data = (await resp.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
  };
  if (!data.access_token) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: `${DRIVE_NEEDS_CONSENT}: Invalid token response from Google. Please reconnect Drive.`,
    });
  }
  const expiresIn =
    typeof data.expires_in === "number" && data.expires_in > 0
      ? data.expires_in
      : 3600;
  await ctx.prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: data.access_token,
      expires_at: now + expiresIn,
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
    },
  });
  return data.access_token;
}

export interface DriveFile {
  id: string;
  name: string;
  sizeBytes: number;
  modifiedTime: string;
}

export async function listDriveApkgFiles(token: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(
    "name contains '.apkg' and trashed = false and mimeType != 'application/vnd.google-apps.folder'",
  );
  const fields = encodeURIComponent("files(id,name,size,modifiedTime)");
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=modifiedTime%20desc&pageSize=50`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (resp.status === 401 || resp.status === 403) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: `${DRIVE_NEEDS_CONSENT}: Google Drive access was refused. Sign in with Google again to reconnect Drive.`,
    });
  }
  if (!resp.ok) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Google Drive list failed (HTTP ${resp.status}).`,
    });
  }
  const data = (await resp.json()) as {
    files?: { id: string; name: string; size?: string; modifiedTime: string }[];
  };
  return (data.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    sizeBytes: f.size ? Number(f.size) : 0,
    modifiedTime: f.modifiedTime,
  }));
}

export async function downloadDriveFile(
  token: string,
  fileId: string,
): Promise<Buffer> {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (resp.status === 401 || resp.status === 403) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: `${DRIVE_NEEDS_CONSENT}: Google Drive access was refused. Sign in with Google again to reconnect Drive.`,
    });
  }
  if (!resp.ok) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Google Drive download failed (HTTP ${resp.status}).`,
    });
  }
  const contentLength = Number(resp.headers.get("content-length") ?? 0);
  if (contentLength > MAX_DRIVE_APKG_BYTES) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "Anki package exceeds the 50 MB in-app import limit.",
    });
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.byteLength > MAX_DRIVE_APKG_BYTES) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "Anki package exceeds the 50 MB in-app import limit.",
    });
  }
  return buf;
}
