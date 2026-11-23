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

export async function uploadFilesToGithubTree(
  files: { name: string; content: Buffer }[],
  importId?: string,
): Promise<string | null> {
  const ghToken = process.env.GITHUB_MEDIA_TOKEN;
  if (!ghToken || files.length === 0) return null;

  const owner = process.env.GITHUB_MEDIA_OWNER || "DontAskMeWhy0507";
  const repo = process.env.GITHUB_MEDIA_REPO || "quenti-media";
  const safeImportId =
    importId?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) ||
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const prefix = `anki/imports/${safeImportId}`;
  const headers = {
    Authorization: `Bearer ${ghToken}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  try {
    // 1. Get current main branch HEAD commit and base tree SHA
    const refRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/main`,
      { headers, signal: AbortSignal.timeout(10_000) },
    );
    if (!refRes.ok) throw new Error(`GitHub ref fetch failed (${refRes.status})`);
    const refJson = (await refRes.json()) as { object?: { sha?: string } };
    const parentCommitSha = refJson.object?.sha;
    if (!parentCommitSha) throw new Error("Missing HEAD commit SHA");

    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits/${parentCommitSha}`,
      { headers, signal: AbortSignal.timeout(10_000) },
    );
    if (!commitRes.ok)
      throw new Error(`GitHub commit fetch failed (${commitRes.status})`);
    const commitJson = (await commitRes.json()) as { tree?: { sha?: string } };
    const baseTreeSha = commitJson.tree?.sha;
    if (!baseTreeSha) throw new Error("Missing base tree SHA");

    // 2. Create Git blobs in parallel batches of 8 (no branch lock contention!)
    const treeEntries: {
      path: string;
      mode: "100644";
      type: "blob";
      sha: string;
    }[] = [];
    const batchSize = 8;
    for (let i = 0; i < files.length; i += batchSize) {
      const chunk = files.slice(i, i + batchSize);
      const created = await Promise.all(
        chunk.map(async (f) => {
          const safeName = sanitizeMediaFilename(f.name);
          const blobRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                content: f.content.toString("base64"),
                encoding: "base64",
              }),
              signal: AbortSignal.timeout(20_000),
            },
          );
          if (!blobRes.ok) return null;
          const blobJson = (await blobRes.json()) as { sha?: string };
          return blobJson.sha
            ? {
                path: `${prefix}/${safeName}`,
                mode: "100644" as const,
                type: "blob" as const,
                sha: blobJson.sha,
              }
            : null;
        }),
      );
      for (const item of created) {
        if (item) treeEntries.push(item);
      }
    }

    if (treeEntries.length === 0) return null;

    // 3. Create single Git tree + single commit + update branch ref
    const newTreeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: treeEntries,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!newTreeRes.ok)
      throw new Error(`GitHub tree creation failed (${newTreeRes.status})`);
    const newTreeJson = (await newTreeRes.json()) as { sha?: string };
    if (!newTreeJson.sha) throw new Error("Missing new tree SHA");

    const newCommitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: `Anki import media batch (${treeEntries.length} files)`,
          tree: newTreeJson.sha,
          parents: [parentCommitSha],
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!newCommitRes.ok)
      throw new Error(`GitHub commit creation failed (${newCommitRes.status})`);
    const newCommitJson = (await newCommitRes.json()) as { sha?: string };
    if (!newCommitJson.sha) throw new Error("Missing new commit SHA");

    const updateRefRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/main`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          sha: newCommitJson.sha,
          force: true,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!updateRefRes.ok)
      throw new Error(`GitHub ref update failed (${updateRefRes.status})`);

    return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@main/${prefix}`;
  } catch (err) {
    console.warn("GitHub Git Tree batch upload warning:", err);
    return null;
  }
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

  if (!mediaBase && ghToken) {
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
  return importAnkiBuffer(
    ctx,
    buffer,
    input.fileName,
    input.mediaBaseOverride,
  );
};

export default importPackageHandler;
