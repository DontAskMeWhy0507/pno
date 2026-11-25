import { TRPCError } from "@trpc/server";

import {
  calculateNextSchedule,
  CardScheduleState,
  AnkiQueue,
} from "@pno/lib/src/anki/srs";

import type { NonNullableUserContext } from "../../lib/types";
import { assertStudySetReadable } from "./access";
import type { TSubmitReviewSchema } from "./submit-review.schema";

type SubmitReviewOptions = {
  ctx: NonNullableUserContext;
  input: TSubmitReviewSchema;
};

export const submitReviewHandler = async ({
  ctx,
  input,
}: SubmitReviewOptions) => {
  const userId = ctx.session.user.id;
  const now = new Date();

  await assertStudySetReadable(ctx, input.studySetId);

  const term = await ctx.prisma.term.findUnique({
    where: {
      id_studySetId: {
        id: input.termId,
        studySetId: input.studySetId,
      },
    },
    select: { id: true },
  });
  if (!term) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Card not found in this deck.",
    });
  }

  const updated = await ctx.prisma.$transaction(async (tx) => {
    const existing = await tx.ankiCardSchedule.findUnique({
      where: {
        userId_termId: {
          userId,
          termId: input.termId,
        },
      },
    });

    const currentState: CardScheduleState = {
      queue: (existing?.queue ?? "New") as AnkiQueue,
      step: existing?.step ?? 0,
      interval: existing?.interval ?? 0,
      easeFactor: existing?.easeFactor ?? 2500,
      reps: existing?.reps ?? 0,
      lapses: existing?.lapses ?? 0,
      due: existing?.due ?? now,
      lastReviewedAt: existing?.lastReviewedAt ?? null,
    };

    const nextState = calculateNextSchedule(currentState, input.rating, now, {
      timezoneOffsetMinutes: input.timezoneOffsetMinutes,
      enableFuzz: true,
    });

    return await tx.ankiCardSchedule.upsert({
      where: {
        userId_termId: {
          userId,
          termId: input.termId,
        },
      },
      create: {
        userId,
        termId: input.termId,
        studySetId: input.studySetId,
        queue: nextState.queue,
        step: nextState.step,
        interval: nextState.interval,
        easeFactor: nextState.easeFactor,
        reps: nextState.reps,
        lapses: nextState.lapses,
        due: nextState.due,
        lastReviewedAt: nextState.lastReviewedAt,
      },
      update: {
        queue: nextState.queue,
        step: nextState.step,
        interval: nextState.interval,
        easeFactor: nextState.easeFactor,
        reps: nextState.reps,
        lapses: nextState.lapses,
        due: nextState.due,
        lastReviewedAt: nextState.lastReviewedAt,
      },
    });
  });

  return {
    success: true,
    schedule: updated,
  };
};

export default submitReviewHandler;
