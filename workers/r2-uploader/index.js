const ALLOWED_ORIGINS = new Set([
  "https://pno-app.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const MAGIC = [0x50, 0x4e, 0x4f, 0x42]; // "PNOB"
const VERSION = 1;
const MAX_FILES_PER_BATCH = 45;
const PREFIX_PATTERN = /^anki\/imports\/[a-zA-Z0-9_-]{1,40}$/;
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;
const PUT_CONCURRENCY = 10;

const textDecoder = new TextDecoder("utf-8", { fatal: false });
const textEncoder = new TextEncoder();

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  const headers = new Headers();
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  } else {
    headers.set("Access-Control-Allow-Origin", "https://pno-app.vercel.app");
  }
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

function jsonResponse(request, status, body) {
  const headers = corsHeaders(request);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

function base64UrlToUint8Array(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const bin = atob(padded + "=".repeat(padLen));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function base64UrlToString(str) {
  return textDecoder.decode(base64UrlToUint8Array(str));
}

async function verifyToken(token, secret) {
  if (!secret || typeof token !== "string") {
    return null;
  }
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0 || dotIdx === token.length - 1) {
    return null;
  }
  const payloadB64 = token.slice(0, dotIdx);
  const sigB64 = token.slice(dotIdx + 1);

  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  let sigBytes;
  try {
    sigBytes = base64UrlToUint8Array(sigB64);
  } catch {
    return null;
  }

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    textEncoder.encode(payloadB64),
  );
  if (!valid) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlToString(payloadB64));
  } catch {
    return null;
  }

  if (
    !payload ||
    typeof payload.exp !== "number" ||
    payload.exp <= Date.now() ||
    typeof payload.prefix !== "string" ||
    !PREFIX_PATTERN.test(payload.prefix)
  ) {
    return null;
  }

  return payload;
}

function sanitizeFilename(raw) {
  const base = String(raw || "").replace(/\\/g, "/").split("/").pop() || "media";
  return base.replace(INVALID_FILENAME_CHARS, "_").slice(0, 180) || "media";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse(request, 200, { ok: true, service: "pno-r2-uploader" });
    }

    if (request.method !== "POST") {
      return jsonResponse(request, 405, { error: "Method Not Allowed" });
    }

    if (!env?.BUCKET || !env?.UPLOAD_SECRET) {
      return jsonResponse(request, 500, { error: "Worker bindings not configured" });
    }

    let buf;
    try {
      buf = await request.arrayBuffer();
    } catch {
      return jsonResponse(request, 400, { error: "Failed to read request body" });
    }

    if (buf.byteLength < 9) {
      return jsonResponse(request, 400, { error: "Truncated batch payload" });
    }

    const bytes = new Uint8Array(buf);
    const view = new DataView(buf);

    if (
      bytes[0] !== MAGIC[0] ||
      bytes[1] !== MAGIC[1] ||
      bytes[2] !== MAGIC[2] ||
      bytes[3] !== MAGIC[3] ||
      bytes[4] !== VERSION
    ) {
      return jsonResponse(request, 400, { error: "Invalid PNOB batch header" });
    }

    let offset = 5;
    if (offset + 2 > bytes.length) {
      return jsonResponse(request, 400, { error: "Truncated token length" });
    }
    const tokenLen = view.getUint16(offset, false);
    offset += 2;
    if (tokenLen === 0 || offset + tokenLen + 2 > bytes.length) {
      return jsonResponse(request, 400, { error: "Invalid token bounds" });
    }
    const token = textDecoder.decode(bytes.subarray(offset, offset + tokenLen));
    offset += tokenLen;

    const claims = await verifyToken(token, env.UPLOAD_SECRET);
    if (!claims) {
      return jsonResponse(request, 401, { error: "Invalid or expired upload token" });
    }

    const fileCount = view.getUint16(offset, false);
    offset += 2;
    if (fileCount < 1 || fileCount > MAX_FILES_PER_BATCH) {
      return jsonResponse(request, 400, {
        error: `fileCount must be between 1 and ${MAX_FILES_PER_BATCH}`,
      });
    }

    const entries = [];
    let totalBytes = 0;

    for (let i = 0; i < fileCount; i++) {
      if (offset + 2 > bytes.length) {
        return jsonResponse(request, 400, { error: "Truncated filename length" });
      }
      const nameLen = view.getUint16(offset, false);
      offset += 2;
      if (nameLen === 0 || offset + nameLen + 2 > bytes.length) {
        return jsonResponse(request, 400, { error: "Invalid filename bounds" });
      }
      const rawName = textDecoder.decode(bytes.subarray(offset, offset + nameLen));
      offset += nameLen;

      const ctLen = view.getUint16(offset, false);
      offset += 2;
      if (offset + ctLen + 4 > bytes.length) {
        return jsonResponse(request, 400, { error: "Invalid content-type bounds" });
      }
      const contentType =
        ctLen > 0
          ? textDecoder.decode(bytes.subarray(offset, offset + ctLen))
          : "application/octet-stream";
      offset += ctLen;

      const dataLen = view.getUint32(offset, false);
      offset += 4;
      if (offset + dataLen > bytes.length) {
        return jsonResponse(request, 400, { error: "Truncated file data" });
      }
      const dataSlice = bytes.subarray(offset, offset + dataLen);
      offset += dataLen;

      const safeName = sanitizeFilename(rawName);
      entries.push({
        key: `${claims.prefix}/${safeName}`,
        contentType,
        dataSlice,
      });
      totalBytes += dataLen;
    }

    for (let i = 0; i < entries.length; i += PUT_CONCURRENCY) {
      const chunk = entries.slice(i, i + PUT_CONCURRENCY);
      await Promise.all(
        chunk.map((item) =>
          env.BUCKET.put(item.key, item.dataSlice, {
            httpMetadata: {
              contentType: item.contentType,
              cacheControl: "public, max-age=31536000, immutable",
            },
          }),
        ),
      );
    }

    return jsonResponse(request, 200, {
      ok: true,
      uploaded: entries.length,
      bytes: totalBytes,
    });
  },
};
