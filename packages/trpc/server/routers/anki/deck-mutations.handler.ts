import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import {
  getAnkiPreset,
  parseAnkiCardFields,
} from "@quenti/lib/src/anki/presets";
import {
  renderAnkiCard,
  stripFrontSidePrefix,
} from "@quenti/lib/src/anki/template";

import type { NonNullableUserContext } from "../../lib/types";
import type {
  TCreateAnkiDeckSchema,
  TUpdateAnkiDeckSchema,
  TUpdateAnkiTemplateSchema,
} from "./deck-mutations.schema";

export function safeTruncateHtml(str: string, maxLen = 32000): string {
  if (!str || str.length <= maxLen) return str;
  let cut = str.slice(0, maxLen);
  const lastOpen = cut.lastIndexOf("<");
  const lastClose = cut.lastIndexOf(">");
  if (lastOpen > lastClose) {
    cut = cut.slice(0, lastOpen);
  }
  return cut;
}

export async function assertDeckOwner(
  ctx: NonNullableUserContext,
  studySetId: string,
) {
  const studySet = await ctx.prisma.studySet.findFirst({
    where: {
      id: studySetId,
      userId: ctx.session.user.id,
    },
    select: {
      id: true,
      userId: true,
      title: true,
      description: true,
      ankiTemplate: true,
    },
  });

  if (!studySet) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Anki deck not found or you do not have permission to edit it.",
    });
  }

  return studySet;
}

export const createDeckHandler = async ({
  ctx,
  input,
}: {
  ctx: NonNullableUserContext;
  input: TCreateAnkiDeckSchema;
}) => {
  const userId = ctx.session.user.id;
  const presetKey =
    input.presetId && input.presetId !== "custom"
      ? input.presetId
      : "vocab_pro";
  const resolvedTemplate = input.template ?? getAnkiPreset(presetKey);

  return await ctx.prisma.$transaction(async (tx) => {
    const studySet = await tx.studySet.create({
      data: {
        title: input.title,
        description: input.description ?? "",
        userId,
        created: true,
        tags: ["anki"],
        ankiTemplate: resolvedTemplate as unknown as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        title: true,
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

    return studySet;
  });
};

export const updateDeckHandler = async ({
  ctx,
  input,
}: {
  ctx: NonNullableUserContext;
  input: TUpdateAnkiDeckSchema;
}) => {
  await assertDeckOwner(ctx, input.studySetId);

  return await ctx.prisma.studySet.update({
    where: { id: input.studySetId },
    data: {
      title: input.title,
      description: input.description,
    },
    select: {
      id: true,
      title: true,
      description: true,
    },
  });
};

export const updateTemplateHandler = async ({
  ctx,
  input,
}: {
  ctx: NonNullableUserContext;
  input: TUpdateAnkiTemplateSchema;
}) => {
  await assertDeckOwner(ctx, input.studySetId);
  const tmpl = input.template;

  await ctx.prisma.studySet.update({
    where: { id: input.studySetId },
    data: {
      ankiTemplate: tmpl as unknown as Prisma.InputJsonValue,
      cortexStale: true,
    },
  });

  const terms = await ctx.prisma.term.findMany({
    where: { studySetId: input.studySetId, ephemeral: false },
    select: {
      id: true,
      wordRichText: true,
      assetUrl: true,
    },
  });

  const updates: Array<{
    id: string;
    word: string;
    definition: string;
    assetUrl: string | null;
  }> = [];

  for (const term of terms) {
    const parsedFields = parseAnkiCardFields(term.wordRichText);
    if (!parsedFields) continue;

    const rendered = renderAnkiCard({
      qfmt: tmpl.qfmt,
      afmt: tmpl.afmt,
      fields: parsedFields.ankiFields,
      clozeOrdinal: parsedFields.clozeOrdinal,
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
    const nextAsset =
      imgMatch && imgMatch.length <= 255
        ? imgMatch
        : term.assetUrl && term.assetUrl.length <= 255
          ? term.assetUrl
          : null;

    updates.push({
      id: term.id,
      word: front,
      definition: back,
      assetUrl: nextAsset,
    });
  }

  const chunkSize = 25;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map((u) =>
        ctx.prisma.term.update({
          where: { id: u.id },
          data: {
            word: u.word,
            definition: u.definition,
            assetUrl: u.assetUrl,
          },
        }),
      ),
    );
  }

  return {
    updatedCardsCount: updates.length,
    template: tmpl,
  };
};
