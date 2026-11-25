import {
  AnkiQueue,
  CardScheduleState,
  DEFAULT_SCHEDULE_CONFIG,
  getAnkiDayStart,
  getIntervalEstimateLabel,
} from "@pno/lib/src/anki/srs";

import type { NonNullableUserContext } from "../../lib/types";
import { assertStudySetReadable } from "./access";
import type { TGetReviewQueueSchema } from "./get-review-queue.schema";

type GetReviewQueueOptions = {
  ctx: NonNullableUserContext;
  input: TGetReviewQueueSchema;
};

export const getReviewQueueHandler = async ({
  ctx,
  input,
}: GetReviewQueueOptions) => {
  const userId = ctx.session.user.id;
  const now = new Date();
  const dayStart = getAnkiDayStart(
    now,
    DEFAULT_SCHEDULE_CONFIG.rolloverHour,
    input.timezoneOffsetMinutes,
  );
  const learnAheadCutoff = new Date(
    now.getTime() + DEFAULT_SCHEDULE_CONFIG.learnAheadMinutes * 60 * 1000,
  );

  await assertStudySetReadable(ctx, input.studySetId);

  const studySet = await ctx.prisma.studySet.findUnique({
    where: { id: input.studySetId },
    select: {
      id: true,
      title: true,
      userId: true,
      ankiTemplate: true,
    },
  });

  // Step 1: Lightweight fetch of term IDs and ranks only
  const terms = await ctx.prisma.term.findMany({
    where: { studySetId: input.studySetId, ephemeral: false },
    orderBy: { rank: "asc" },
    select: { id: true, rank: true },
  });

  // Step 2: Fetch existing schedules for this user in this set
  const existingSchedules = await ctx.prisma.ankiCardSchedule.findMany({
    where: {
      userId,
      studySetId: input.studySetId,
    },
  });

  const scheduleMap = new Map<string, (typeof existingSchedules)[0]>();
  let newStudiedToday = 0;
  let reviewsStudiedToday = 0;
  let suspendedCount = 0;

  for (const s of existingSchedules) {
    scheduleMap.set(s.termId, s);
    if (s.queue === "Suspended") {
      suspendedCount += 1;
    }
    if (s.createdAt >= dayStart) {
      newStudiedToday += 1;
    } else if (s.lastReviewedAt && s.lastReviewedAt >= dayStart) {
      reviewsStudiedToday += 1;
    }
  }

  type LightweightCard = {
    termId: string;
    rank: number;
    queue: AnkiQueue;
    step: number;
    interval: number;
    easeFactor: number;
    reps: number;
    lapses: number;
    due: Date;
    lastReviewedAt: Date | null;
  };

  const learnDue: LightweightCard[] = [];
  const learnAhead: LightweightCard[] = [];
  const reviewDueAll: LightweightCard[] = [];
  const newCardsAll: LightweightCard[] = [];

  for (const term of terms) {
    const s = scheduleMap.get(term.id);
    const queue = (s?.queue ?? "New") as AnkiQueue;
    const due = s?.due ?? now;

    if (queue === "Suspended") {
      continue;
    }

    const item: LightweightCard = {
      termId: term.id,
      rank: term.rank,
      queue,
      step: s?.step ?? 0,
      interval: s?.interval ?? 0,
      easeFactor: s?.easeFactor ?? DEFAULT_SCHEDULE_CONFIG.startingEaseFactor,
      reps: s?.reps ?? 0,
      lapses: s?.lapses ?? 0,
      due,
      lastReviewedAt: s?.lastReviewedAt ?? null,
    };

    if (queue === "Learning" || queue === "DayLearn") {
      if (due <= now) {
        learnDue.push(item);
      } else if (queue === "Learning" && due <= learnAheadCutoff) {
        learnAhead.push(item);
      }
    } else if (queue === "Review" && due <= now) {
      reviewDueAll.push(item);
    } else if (queue === "New") {
      newCardsAll.push(item);
    }
  }

  learnDue.sort((a, b) => a.due.getTime() - b.due.getTime());
  learnAhead.sort((a, b) => a.due.getTime() - b.due.getTime());
  reviewDueAll.sort(
    (a, b) => a.due.getTime() - b.due.getTime() || a.rank - b.rank,
  );

  const remainingNewQuota = input.ignoreDailyLimit
    ? newCardsAll.length
    : Math.max(0, DEFAULT_SCHEDULE_CONFIG.newCardsPerDay - newStudiedToday);
  const remainingReviewQuota = input.ignoreDailyLimit
    ? reviewDueAll.length
    : Math.max(0, DEFAULT_SCHEDULE_CONFIG.maxReviewsPerDay - reviewsStudiedToday);

  const reviewDue = reviewDueAll.slice(0, remainingReviewQuota);
  const newCards = newCardsAll.slice(0, remainingNewQuota);

  // Step 3: Pick only the top N cards for the active queue
  const targetCards = [
    ...learnDue,
    ...reviewDue,
    ...newCards,
    ...learnAhead,
  ].slice(0, input.limit);
  const targetTermIds = targetCards.map((c) => c.termId);

  // Step 4: Fetch HTML definitions ONLY for the target cards (at most input.limit)
  const fullTerms =
    targetTermIds.length > 0
      ? await ctx.prisma.term.findMany({
          where: { id: { in: targetTermIds } },
          select: {
            id: true,
            word: true,
            definition: true,
            wordRichText: true,
            assetUrl: true,
          },
        })
      : [];
  const termDetailsMap = new Map(fullTerms.map((t) => [t.id, t]));

  const queueCards = targetCards.map((c) => {
    const details = termDetailsMap.get(c.termId);
    const state: CardScheduleState = {
      queue: c.queue,
      step: c.step,
      interval: c.interval,
      easeFactor: c.easeFactor,
      reps: c.reps,
      lapses: c.lapses,
      due: c.due,
      lastReviewedAt: c.lastReviewedAt,
    };

    const estimates = {
      again: getIntervalEstimateLabel(state, 1, now, {
        timezoneOffsetMinutes: input.timezoneOffsetMinutes,
      }),
      hard: getIntervalEstimateLabel(state, 2, now, {
        timezoneOffsetMinutes: input.timezoneOffsetMinutes,
      }),
      good: getIntervalEstimateLabel(state, 3, now, {
        timezoneOffsetMinutes: input.timezoneOffsetMinutes,
      }),
      easy: getIntervalEstimateLabel(state, 4, now, {
        timezoneOffsetMinutes: input.timezoneOffsetMinutes,
      }),
    };

    return {
      termId: c.termId,
      word: details?.word ?? "",
      definition: details?.definition ?? "",
      wordRichText: details?.wordRichText ?? null,
      assetUrl: details?.assetUrl ?? null,
      rank: c.rank,
      queue: c.queue,
      step: c.step,
      interval: c.interval,
      easeFactor: c.easeFactor,
      reps: c.reps,
      lapses: c.lapses,
      due: c.due,
      estimates,
    };
  });

  const learnCount = learnDue.length + learnAhead.length;

  return {
    deck: studySet
      ? {
          id: studySet.id,
          title: studySet.title,
          userId: studySet.userId,
          isOwner: studySet.userId === userId,
          ankiTemplate: studySet.ankiTemplate ?? null,
        }
      : null,
    cards: queueCards,
    counts: {
      learn: learnCount,
      review: reviewDue.length,
      new: newCards.length,
      totalDue: learnCount + reviewDue.length + newCards.length,
    },
    dailyStats: {
      newStudiedToday,
      newLimit: DEFAULT_SCHEDULE_CONFIG.newCardsPerDay,
      reviewsStudiedToday,
      reviewLimit: DEFAULT_SCHEDULE_CONFIG.maxReviewsPerDay,
      remainingNewAvailable: Math.max(0, newCardsAll.length - newCards.length),
      remainingReviewAvailable: Math.max(
        0,
        reviewDueAll.length - reviewDue.length,
      ),
      suspendedCount,
      learnAheadMinutes: DEFAULT_SCHEDULE_CONFIG.learnAheadMinutes,
    },
  };
};

export default getReviewQueueHandler;
