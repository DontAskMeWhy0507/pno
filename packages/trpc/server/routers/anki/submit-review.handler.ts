import { TRPCError } from "@trpc/server";

import { parseAnkiDeckTemplate } from "@pno/lib/src/anki/presets";
import {
  calculateNextSchedule,
  deckOptionsToScheduleConfig,
  isRelearningCard,
  resolveDeckOptions,
  type AnkiQueue,
  type CardScheduleState,
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

  const [term, studySet] = await Promise.all([
    ctx.prisma.term.findUnique({
      where: {
        id_studySetId: {
          id: input.termId,
          studySetId: input.studySetId,
        },
      },
      select: { id: true },
    }),
    ctx.prisma.studySet.findUnique({
      where: { id: input.studySetId },
      select: { ankiTemplate: true },
    }),
  ]);

  if (!term) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Card not found in this deck.",
    });
  }

  const parsedTemplate = parseAnkiDeckTemplate(studySet?.ankiTemplate);
  const options = resolveDeckOptions(parsedTemplate?.options);
  const scheduleConfig = deckOptionsToScheduleConfig(
    options,
    input.timezoneOffsetMinutes,
    true,
  );
  const cappedMillis = Math.min(
    input.takenMillis ?? 0,
    options.capAnswerTimeSecs * 1000,
  );

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
      easeFactor: existing?.easeFactor ?? options.startingEaseFactor,
      reps: existing?.reps ?? 0,
      lapses: existing?.lapses ?? 0,
      due: existing?.due ?? now,
      lastReviewedAt: existing?.lastReviewedAt ?? null,
    };

    const nextState = calculateNextSchedule(
      currentState,
      input.rating,
      now,
      scheduleConfig,
    );

    const schedule = await tx.ankiCardSchedule.upsert({
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

    const reviewKind =
      currentState.queue === "Review"
        ? "Review"
        : isRelearningCard(currentState)
          ? "Relearning"
          : "Learning";

    const logInterval =
      nextState.queue === "Learning"
        ? -Math.max(
            60,
            Math.round((nextState.due.getTime() - now.getTime()) / 1000),
          )
        : nextState.interval;

    await tx.ankiReviewLog.create({
      data: {
        userId,
        termId: input.termId,
        studySetId: input.studySetId,
        rating: input.rating,
        kind: reviewKind,
        interval: logInterval,
        lastInterval: currentState.interval,
        easeFactor: nextState.easeFactor,
        takenMillis: cappedMillis,
        reviewedAt: now,
      },
    });

    return schedule;
  });

  return {
    success: true,
    schedule: updated,
  };
};

export default submitReviewHandler;
