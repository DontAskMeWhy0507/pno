import fsSync from "fs";
import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";
import * as fzstd from "fzstd";
import { put } from "@vercel/blob";

import { parseAnkiPackage } from "@quenti/lib/src/anki/parser";

import { TRPCError } from "@trpc/server";

import type { NonNullableUserContext } from "../../lib/types";
import type { TImportPackageSchema } from "./import-package.schema";

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

function sanitizeMediaFilename(raw: string): string {
  const base = raw.replace(/\\/g, "/").split("/").pop() ?? "media";
  return base.replace(INVALID_FILENAME_CHARS, "_").slice(0, 180) || "media";
}

function resolveLocalUploadsDir(): string {
  const cwd = process.cwd();
  const directPublic = path.resolve(cwd, "public");
  if (fsSync.existsSync(directPublic)) {
    return path.join(directPublic, "uploads", "anki");
  }
  return path.resolve(cwd, "apps/next/public/uploads/anki");
}

function safeTruncate(str: string, maxLen = 1000): string {
  if (!str || str.length <= maxLen) return str;
  let cut = str.slice(0, maxLen);
  const lastOpen = cut.lastIndexOf("<");
  const lastClose = cut.lastIndexOf(">");
  if (lastOpen > lastClose) {
    cut = cut.slice(0, lastOpen);
  }
  return cut;
}

type ImportPackageOptions = {
  ctx: NonNullableUserContext;
  input: TImportPackageSchema;
};

export async function importAnkiBuffer(
  ctx: NonNullableUserContext,
  buffer: Buffer,
  _fileName: string,
) {
  const userId = ctx.session.user.id;

  // Parse collection metadata and cards
  const parsed = await parseAnkiPackage(buffer, {
    mediaUrlPrefix: "/api/anki/media",
  });

  if (!parsed.decks.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No decks found in Anki package.",
    });
  }

  // Only extract media files actually referenced by imported cards
  const usedMediaNames = new Set<string>();
  for (const deck of parsed.decks) {
    for (const card of deck.cards) {
      for (const a of card.audioFiles) usedMediaNames.add(a);
      for (const img of card.imageFiles) usedMediaNames.add(img);
    }
  }

  // Extract media. On deployments with GitHub CDN or Vercel Blob configured,
  // media is uploaded externally and card HTML is rewritten to public URLs.
  // Otherwise it falls back to the local public/uploads/anki directory.
  let mediaBase: string | null = null;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const loadMediaFiles = async () => {
    const files: { name: string; content: Buffer }[] = [];
    if (Object.keys(parsed.mediaMap).length === 0) return files;
    const zip = await JSZip.loadAsync(buffer);
    for (const [entryId, realName] of Object.entries(parsed.mediaMap)) {
      if (usedMediaNames.size > 0 && !usedMediaNames.has(realName)) {
        continue;
      }
      const fileEntry = zip.file(entryId);
      if (fileEntry) {
        let content = await fileEntry.async("nodebuffer");
        if (
          content.length >= 4 &&
          content[0] === 0x28 &&
          content[1] === 0xb5 &&
          content[2] === 0x2f &&
          content[3] === 0xfd
        ) {
          content = Buffer.from(fzstd.decompress(content));
        }
        files.push({ name: sanitizeMediaFilename(realName), content });
      }
    }
    return files;
  };

  // Preferred media target: a public GitHub repo served through the
  // jsDelivr CDN (GITHUB_MEDIA_TOKEN). Files land under a per-import prefix
  // so decks never collide, and card HTML is rewritten to the CDN URLs.
  const ghToken = process.env.GITHUB_MEDIA_TOKEN;
  if (ghToken) {
    try {
      const files = await loadMediaFiles();
      if (files.length) {
        const owner = process.env.GITHUB_MEDIA_OWNER || "DontAskMeWhy0507";
        const repo = process.env.GITHUB_MEDIA_REPO || "quenti-media";
        const importId = `${Date.now().toString(36)}${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        const prefix = `anki/imports/${importId}`;
        const uploadOne = async (file: { name: string; content: Buffer }) => {
          const resp = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${prefix}/${encodeURIComponent(
              file.name,
            )}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${ghToken}`,
                Accept: "application/vnd.github+json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: `Anki import media: ${file.name}`,
                content: file.content.toString("base64"),
              }),
              signal: AbortSignal.timeout(15_000),
            },
          );
          if (!resp.ok) {
            const err = new Error(
              `GitHub media upload failed for ${file.name} (HTTP ${resp.status})`,
            ) as Error & { status?: number };
            err.status = resp.status;
            throw err;
          }
        };
        // Uploads MUST be sequential: every Contents-API PUT creates a
        // commit on the same branch, so parallel PUTs race on the branch
        // ref and all but one fail. Retry transient errors only.
        let uploaded = 0;
        for (const f of files) {
          let lastErr: unknown = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await uploadOne(f);
              lastErr = null;
              break;
            } catch (e) {
              lastErr = e;
              const status = (e as { status?: number })?.status;
              if (status === 401 || status === 403 || status === 422) break;
              await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
            }
          }
          if (lastErr)
            console.warn(`GitHub media upload failed for ${f.name}:`, lastErr);
          else uploaded++;
        }
        if (uploaded > 0) {
          mediaBase = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@main/${prefix}`;
        }
      }
    } catch (err) {
      console.warn("GitHub media upload warning:", err);
      mediaBase = null;
    }
  }

  // Blob is only a fallback when GitHub media is not configured: the
  // project's Blob store is paused (free-tier request quota), so uploads
  // there produce links that cannot be read back.
  if (!mediaBase && blobToken && !ghToken) {
    try {
      for (const file of await loadMediaFiles()) {
        const blob = await put(`anki/${file.name}`, file.content, {
          access: "public",
          addRandomSuffix: false,
          token: blobToken,
        });
        if (!mediaBase) {
          mediaBase = new URL(".", blob.url).href.replace(/\/$/, "");
        }
      }
    } catch (err) {
      console.warn("Blob media upload warning:", err);
      mediaBase = null;
    }
  }

  if (!mediaBase) {
    const uploadsBase = resolveLocalUploadsDir();
    try {
      await fs.mkdir(uploadsBase, { recursive: true });
      for (const file of await loadMediaFiles()) {
        await fs.writeFile(path.join(uploadsBase, file.name), file.content);
      }
    } catch (err) {
      console.warn("Media extraction warning:", err);
    }
  }

  const rewriteMedia = (html: string) =>
    mediaBase ? html.split("/api/anki/media/").join(`${mediaBase}/`) : html;

  return await ctx.prisma.$transaction(
    async (tx) => {
      // Determine if there is a common parent deck or hierarchy
      let folderId: string | undefined = undefined;
      const sampleDeck = parsed.decks[0];
      const rootName =
        sampleDeck?.parentName ||
        (parsed.decks.length > 1 && sampleDeck
          ? sampleDeck.name.split(" ")[0]
          : undefined);

      if (parsed.decks.length > 1 && rootName) {
        const folder = await tx.folder.create({
          data: {
            title: rootName.slice(0, 255),
            description: "Anki Deck Collection",
            userId,
          },
        });
        folderId = folder.id;
      }

      let firstSetId = "";
      let totalTerms = 0;

      for (const deck of parsed.decks) {
        if (!deck.cards.length && parsed.decks.length > 1) continue;

        const cleanTitle = deck.name.replace(/::/g, " - ").slice(0, 255);
        const studySet = await tx.studySet.create({
          data: {
            title: cleanTitle,
            description: `Imported from Anki (${deck.cards.length} cards)`.slice(
              0,
              2000,
            ),
            userId,
            created: true,
            tags: ["anki"],
          },
        });

        if (!firstSetId) firstSetId = studySet.id;

        if (folderId) {
          await tx.studySetsOnFolders.create({
            data: {
              studySetId: studySet.id,
              folderId,
            },
          });
        }

        // Insert terms in batches of 500
        const batchSize = 500;
        for (let i = 0; i < deck.cards.length; i += batchSize) {
          const chunk = deck.cards.slice(i, i + batchSize);
          await tx.term.createMany({
            data: chunk.map((c, idx) => {
              const firstImg = c.imageFiles[0];
              let assetUrl: string | null = null;
              if (firstImg) {
                const safeName = encodeURIComponent(
                  sanitizeMediaFilename(firstImg),
                );
                const candidate = mediaBase
                  ? `${mediaBase}/${safeName}`
                  : `/api/anki/media/${safeName}`;
                assetUrl = candidate.length <= 255 ? candidate : null;
              }
              return {
                word: safeTruncate(rewriteMedia(c.front), 1000),
                definition: safeTruncate(rewriteMedia(c.back), 1000),
                rank: i + idx,
                studySetId: studySet.id,
                assetUrl,
              };
            }),
          });
        }

        totalTerms += deck.cards.length;
      }

      return {
        createdSetId: firstSetId,
        folderId,
        title: parsed.decks[0]?.name || "Anki Deck",
        termsCount: totalTerms,
        decksCount: parsed.decks.length,
      };
    },
    { timeout: 60_000 },
  );
}

export const importPackageHandler = async ({
  ctx,
  input,
}: ImportPackageOptions) => {
  const buffer = Buffer.from(input.fileBase64, "base64");
  return importAnkiBuffer(ctx, buffer, input.fileName);
};

export default importPackageHandler;
