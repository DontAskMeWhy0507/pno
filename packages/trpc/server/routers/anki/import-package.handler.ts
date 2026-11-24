import fsSync from "fs";
import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";
import * as fzstd from "fzstd";
import { put } from "@vercel/blob";

import { parseAnkiPackage } from "@quenti/lib/src/anki/parser";
import {
  sanitizeAnkiHtml,
  stripFrontSidePrefix,
} from "@quenti/lib/src/anki/template";
import { uploadMediaBatchWithFailover } from "@quenti/images/server";

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

export async function uploadFilesToGithubTree(
  files: { name: string; content: Buffer }[],
  importId?: string,
): Promise<string | null> {
  if (files.length === 0) return null;
  const safeImportId =
    importId?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) ||
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const prefix = `anki/imports/${safeImportId}`;
  const res = await uploadMediaBatchWithFailover(files, prefix);
  return res?.mediaBase ?? null;
}

export async function importAnkiBuffer(
  ctx: NonNullableUserContext,
  buffer: Buffer,
  _fileName: string,
  mediaBaseOverride?: string,
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

  let mediaBase: string | null = mediaBaseOverride ?? null;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const ghToken = process.env.GITHUB_MEDIA_TOKEN;
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

  if (!mediaBase) {
    const files = await loadMediaFiles();
    if (files.length > 0) {
      mediaBase = await uploadFilesToGithubTree(files);
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

      const nonEmptyDecks =
        parsed.decks.length > 1
          ? parsed.decks.filter((d) => d.cards.length > 0)
          : parsed.decks;

      if (nonEmptyDecks.length === 0 || nonEmptyDecks.every((d) => !d.cards.length)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This Anki package contains no importable cards.",
        });
      }

      if (nonEmptyDecks.length > 1 && rootName) {
        const folder = await tx.folder.create({
          data: {
            title: rootName.slice(0, 255),
            description: "Anki Deck Collection",
            userId,
          },
        });
        folderId = folder.id;
        await tx.container.create({
          data: {
            userId,
            entityId: folder.id,
            type: "Folder",
            viewedAt: new Date(),
          },
        });
      }

      let firstSetId = "";
      let totalTerms = 0;

      for (const deck of nonEmptyDecks) {
        if (!deck.cards.length && nonEmptyDecks.length > 1) continue;

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
            ankiTemplate: deck.template
              ? {
                  presetId: "imported",
                  fields: deck.template.fields,
                  qfmt: deck.template.qfmt,
                  afmt: deck.template.afmt,
                  css: deck.template.css,
                  isCloze: deck.template.isCloze,
                }
              : undefined,
          },
        });

        await tx.container.create({
          data: {
            userId,
            entityId: studySet.id,
            type: "StudySet",
            viewedAt: new Date(),
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
        const resolvedMediaPrefix = mediaBase ?? "/api/anki/media";
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
              const rewrittenFront = rewriteMedia(c.front);
              const rewrittenBack = stripFrontSidePrefix(
                rewrittenFront,
                rewriteMedia(c.back),
              );
              const normalizedFields: Record<string, string> = {};
              for (const [fKey, fVal] of Object.entries(c.rawFields ?? {})) {
                normalizedFields[fKey] = sanitizeAnkiHtml(
                  fVal,
                  resolvedMediaPrefix,
                ).html;
              }
              return {
                word: safeTruncate(rewrittenFront, 32000),
                definition: safeTruncate(rewrittenBack, 32000),
                wordRichText: {
                  ankiFields: normalizedFields,
                  ...(c.clozeOrdinal !== undefined
                    ? { clozeOrdinal: c.clozeOrdinal }
                    : {}),
                },
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
  return importAnkiBuffer(
    ctx,
    buffer,
    input.fileName,
    input.mediaBaseOverride,
  );
};

export default importPackageHandler;
