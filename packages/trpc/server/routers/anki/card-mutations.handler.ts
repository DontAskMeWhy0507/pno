import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import {
  type AnkiDeckTemplate,
  parseAnkiDeckTemplate,
} from "@pno/lib/src/anki/presets";
import {
  extractClozeOrdinals,
  renderAnkiCard,
  sanitizeAnkiHtml,
  stripFrontSidePrefix,
} from "@pno/lib/src/anki/template";

import type { NonNullableUserContext } from "../../lib/types";
import type {
  TAddAnkiCardSchema,
  TDeleteAnkiCardSchema,
  TSetCardSuspendedSchema,
  TUpdateAnkiCardSchema,
} from "./card-mutations.schema";
import { assertStudySetReadable } from "./access";
import { assertDeckOwner, safeTruncateHtml } from "./deck-mutations.handler";

function buildCardPayload(
  input: {
    frontHtml?: string;
    backHtml?: string;
    ankiFields?: Record<string, string>;
    clozeOrdinal?: number;
    assetUrl?: string | null;
  },
  deckTemplate: AnkiDeckTemplate | null,
) {
  if (input.ankiFields && deckTemplate) {
    const sanitizedFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.ankiFields)) {
      sanitizedFields[k] = sanitizeAnkiHtml(v).html;
    }

    const joined = Object.values(sanitizedFields).join(" ");
    const resolvedOrdinal =
      input.clozeOrdinal ??
      (deckTemplate.isCloze
        ? (extractClozeOrdinals(joined)[0] ?? 1)
        : undefined);

    const rendered = renderAnkiCard({
      qfmt: deckTemplate.qfmt,
      afmt: deckTemplate.afmt,
      fields: sanitizedFields,
      clozeOrdinal: resolvedOrdinal,
    });

    const front = safeTruncateHtml(rendered.questionHtml, 32000);
    const back = safeTruncateHtml(
      stripFrontSidePrefix(front, rendered.answerHtml),
      32000,
    );

    const imgMatch =
      rendered.answerHtml.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] ??
      rendered.questionHtml.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] ??
      null;

    const resolvedAsset =
      input.assetUrl !== undefined
        ? input.assetUrl
        : imgMatch && imgMatch.length <= 255
          ? imgMatch
          : null;

    return {
      word: front,
      definition: back,
      wordRichText: {
        ankiFields: sanitizedFields,
        ...(resolvedOrdinal !== undefined
          ? { clozeOrdinal: resolvedOrdinal }
          : {}),
      } as Prisma.InputJsonValue,
      assetUrl: resolvedAsset,
    };
  }

  const front = safeTruncateHtml(
    sanitizeAnkiHtml(input.frontHtml ?? "").html,
    32000,
  );
  const sanitizedBack = sanitizeAnkiHtml(input.backHtml ?? "").html;
  const back = safeTruncateHtml(
    stripFrontSidePrefix(front, sanitizedBack),
    32000,
  );

  const imgMatch =
    back.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] ??
    front.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] ??
    null;

  const resolvedAsset =
    input.assetUrl !== undefined
      ? input.assetUrl
      : imgMatch && imgMatch.length <= 255
        ? imgMatch
        : null;

  return {
    word: front,
    definition: back,
    wordRichText: Prisma.JsonNull,
    assetUrl: resolvedAsset,
  };
}

export const addCardHandler = async ({
  ctx,
  input,
}: {
  ctx: NonNullableUserContext;
  input: TAddAnkiCardSchema;
}) => {
  const studySet = await assertDeckOwner(ctx, input.studySetId);
  const deckTemplate = parseAnkiDeckTemplate(studySet.ankiTemplate);
  const payload = buildCardPayload(input, deckTemplate);

  if (!payload.word.trim() && !payload.definition.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Card content cannot be empty.",
    });
  }

  const maxRankRow = await ctx.prisma.term.aggregate({
    where: { studySetId: input.studySetId, ephemeral: false },
    _max: { rank: true },
  });
  const nextRank = (maxRankRow._max.rank ?? -1) + 1;

  return await ctx.prisma.term.create({
    data: {
      studySetId: input.studySetId,
      rank: nextRank,
      word: payload.word,
      definition: payload.definition,
      wordRichText: payload.wordRichText,
      assetUrl: payload.assetUrl,
      authorId: ctx.session.user.id,
    },
    select: {
      id: true,
      rank: true,
      word: true,
      definition: true,
      wordRichText: true,
      assetUrl: true,
      studySetId: true,
    },
  });
};

export const updateCardHandler = async ({
  ctx,
  input,
}: {
  ctx: NonNullableUserContext;
  input: TUpdateAnkiCardSchema;
}) => {
  const studySet = await assertDeckOwner(ctx, input.studySetId);
  const deckTemplate = parseAnkiDeckTemplate(studySet.ankiTemplate);
  const payload = buildCardPayload(input, deckTemplate);

  const existing = await ctx.prisma.term.findUnique({
    where: {
      id_studySetId: {
        id: input.termId,
        studySetId: input.studySetId,
      },
    },
    select: { id: true },
  });

  if (!existing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Card not found in this deck.",
    });
  }

  return await ctx.prisma.term.update({
    where: {
      id_studySetId: {
        id: input.termId,
        studySetId: input.studySetId,
      },
    },
    data: {
      word: payload.word,
      definition: payload.definition,
      wordRichText: payload.wordRichText,
      assetUrl: payload.assetUrl,
    },
    select: {
      id: true,
      rank: true,
      word: true,
      definition: true,
      wordRichText: true,
      assetUrl: true,
      studySetId: true,
    },
  });
};

export const deleteCardHandler = async ({
  ctx,
  input,
}: {
  ctx: NonNullableUserContext;
  input: TDeleteAnkiCardSchema;
}) => {
  await assertDeckOwner(ctx, input.studySetId);

  await ctx.prisma.term.delete({
    where: {
      id_studySetId: {
        id: input.termId,
        studySetId: input.studySetId,
      },
    },
  });

  return { deletedId: input.termId };
};

export const setCardSuspendedHandler = async ({
  ctx,
  input,
}: {
  ctx: NonNullableUserContext;
  input: TSetCardSuspendedSchema;
}) => {
  await assertStudySetReadable(ctx, input.studySetId);
  const userId = ctx.session.user.id;
  const now = new Date();

  const existing = await ctx.prisma.ankiCardSchedule.findUnique({
    where: {
      userId_termId: {
        userId,
        termId: input.termId,
      },
    },
  });

  if (input.suspended) {
    const schedule = await ctx.prisma.ankiCardSchedule.upsert({
      where: {
        userId_termId: { userId, termId: input.termId },
      },
      create: {
        userId,
        termId: input.termId,
        studySetId: input.studySetId,
        queue: "Suspended",
        due: now,
      },
      update: {
        queue: "Suspended",
      },
    });
    return { schedule };
  }

  if (!existing) {
    return { schedule: null };
  }

  const nextQueue = existing.interval >= 1 ? "Review" : existing.reps > 0 ? "Learning" : "New";
  const schedule = await ctx.prisma.ankiCardSchedule.update({
    where: {
      userId_termId: { userId, termId: input.termId },
    },
    data: {
      queue: nextQueue,
      due: existing.due < now ? now : existing.due,
    },
  });

  return { schedule };
};
