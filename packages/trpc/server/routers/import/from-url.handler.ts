import { TRPCError } from "@trpc/server";

import {
  fetchQuizletSet,
  parseQuizletExportText,
} from "@pno/lib/src/quizlet/parser";

import type { NonNullableUserContext } from "../../lib/types";
import type { TFromUrlSchema } from "./from-url.schema";

type FromUrlOptions = {
  ctx: NonNullableUserContext;
  input: TFromUrlSchema;
};

export const fromUrlHandler = async ({ ctx, input }: FromUrlOptions) => {
  const userId = (ctx.session.user as any).id as string;
  let title = input.title?.trim() || "";
  let terms: { word: string; definition: string; imageUrl?: string }[] = [];

  const rawText = input.text || (input.url?.includes("\t") || input.url?.includes("\n") ? input.url : "");

  if (rawText && rawText.trim()) {
    terms = parseQuizletExportText(rawText, {
      termDelimiter: input.termDelimiter,
      customTermDelimiter: input.customTermDelimiter,
      rowDelimiter: input.rowDelimiter,
      customRowDelimiter: input.customRowDelimiter,
    });
    if (!title) {
      title = "Quizlet Imported Set";
    }
  } else if (input.url && input.url.trim()) {
    try {
      const parsed = await fetchQuizletSet(input.url.trim());
      title = title || parsed.title || "Quizlet Flashcards";
      terms = parsed.terms;
    } catch (err: any) {
      const msg = err?.message || String(err);
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: msg,
      });
    }
  } else {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Please enter a Quizlet URL or paste exported flashcard text.",
    });
  }

  if (terms.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "No flashcard terms could be found or parsed from the provided input.",
    });
  }

  const studySet = await ctx.prisma.$transaction(async (tx) => {
    const created = await tx.studySet.create({
      data: {
        title: title.slice(0, 255),
        description: (input.url && !rawText
          ? `Imported from Quizlet (${input.url})`
          : `Imported from Quizlet (${terms.length} terms)`
        ).slice(0, 2000),
        userId,
        created: true,
        tags: ["quizlet"],
      },
    });

    const batchSize = 500;
    for (let i = 0; i < terms.length; i += batchSize) {
      const chunk = terms.slice(i, i + batchSize);
      await tx.term.createMany({
        data: chunk.map((t, idx) => ({
          word: t.word.slice(0, 1000),
          definition: t.definition.slice(0, 1000),
          rank: i + idx,
          studySetId: created.id,
          assetUrl: t.imageUrl && t.imageUrl.length <= 255 ? t.imageUrl : null,
        })),
      });
    }

    return created;
  });

  return {
    createdSetId: studySet.id,
    title: studySet.title,
    terms: terms.length,
  };
};

export default fromUrlHandler;
