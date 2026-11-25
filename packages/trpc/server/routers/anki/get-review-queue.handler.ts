import { parseAnkiDeckTemplate } from "@pno/lib/src/anki/presets";
import {
  deckOptionsToScheduleConfig,
  getAnkiDayKey,
  getAnkiDayStart,
  getIntervalEstimateLabel,
  resolveDeckOptions,
  type AnkiQueue,
  type CardScheduleState,
} from "@pno/lib/src/anki/srs";

import type { NonNullableUserContext } from "../../lib/types";
import { assertStudySetReadable } from "./access";
import type { TGetReviewQueueSchema } from "./get-review-queue.schema";

type GetReviewQueueOptions = {
  ctx: NonNullableUserContext;
  input: TGetReviewQueueSchema;
};

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export const getReviewQueueHandler = async ({
  ctx,
  input,
}: GetReviewQueueOptions) => {
  const userId = ctx.session.user.id;
  const now = new Date();

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

  const parsedTemplate = parseAnkiDeckTemplate(studySet?.ankiTemplate);
  const options = resolveDeckOptions(parsedTemplate?.options);
  const dayKey = getAnkiDayKey(
    now,
    options.rolloverHour,
    input.timezoneOffsetMinutes,
  );
  const dayStart = getAnkiDayStart(
    now,
    options.rolloverHour,
    input.timezoneOffsetMinutes,
  );
  const learnAheadCutoff = new Date(
    now.getTime() + options.learnAheadMinutes * 60 * 1000,
  );

  const effectiveNewLimit =
    options.todayOverride?.dayKey === dayKey &&
    typeof options.todayOverride.newCardsPerDay === "number"
      ? options.todayOverride.newCardsPerDay
      : options.newCardsPerDay;
  const effectiveReviewLimit =
    options.todayOverride?.dayKey === dayKey &&
    typeof options.todayOverride.maxReviewsPerDay === "number"
      ? options.todayOverride.maxReviewsPerDay
      : options.maxReviewsPerDay;

  const [terms, existingSchedules, todayReviewLogs] = await Promise.all([
    ctx.prisma.term.findMany({
      where: { studySetId: input.studySetId, ephemeral: false },
      orderBy: { rank: "asc" },
      select: { id: true, rank: true },
    }),
    ctx.prisma.ankiCardSchedule.findMany({
      where: {
        userId,
        studySetId: input.studySetId,
      },
    }),
    ctx.prisma.ankiReviewLog.findMany({
      where: {
        userId,
        studySetId: input.studySetId,
        reviewedAt: { gte: dayStart },
      },
      select: { termId: true, kind: true },
    }),
  ]);

  const scheduleMap = new Map<string, (typeof existingSchedules)[0]>();
  let newByScheduleToday = 0;
  let reviewsByScheduleToday = 0;
  let suspendedCount = 0;

  for (const s of existingSchedules) {
    scheduleMap.set(s.termId, s);
    if (s.queue === "Suspended") {
      suspendedCount += 1;
    }
    if (s.createdAt >= dayStart) {
      newByScheduleToday += 1;
    } else if (s.lastReviewedAt && s.lastReviewedAt >= dayStart) {
      reviewsByScheduleToday += 1;
    }
  }

  const reviewedTodayTermIds = new Set<string>();
  for (const l of todayReviewLogs) {
    if (l.kind === "Review") reviewedTodayTermIds.add(l.termId);
  }
  const newStudiedToday = newByScheduleToday;
  const reviewsStudiedToday = Math.max(
    reviewsByScheduleToday,
    reviewedTodayTermIds.size,
  );

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
  const dayLearnDue: LightweightCard[] = [];
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
      easeFactor: s?.easeFactor ?? options.startingEaseFactor,
      reps: s?.reps ?? 0,
      lapses: s?.lapses ?? 0,
      due,
      lastReviewedAt: s?.lastReviewedAt ?? null,
    };

    if (queue === "Learning") {
      if (due <= now) {
        learnDue.push(item);
      } else if (due <= learnAheadCutoff) {
        learnAhead.push(item);
      }
    } else if (queue === "DayLearn") {
      if (due <= now) {
        dayLearnDue.push(item);
      }
    } else if (queue === "Review" && due <= now) {
      reviewDueAll.push(item);
    } else if (queue === "New") {
      newCardsAll.push(item);
    }
  }

  learnDue.sort((a, b) => a.due.getTime() - b.due.getTime());
  learnAhead.sort((a, b) => a.due.getTime() - b.due.getTime());
  dayLearnDue.sort((a, b) => a.due.getTime() - b.due.getTime());

  let orderedReviews = [...reviewDueAll];
  if (options.reviewSortOrder === "interval_asc") {
    orderedReviews.sort((a, b) => a.interval - b.interval || a.due.getTime() - b.due.getTime());
  } else if (options.reviewSortOrder === "interval_desc") {
    orderedReviews.sort((a, b) => b.interval - a.interval || a.due.getTime() - b.due.getTime());
  } else if (options.reviewSortOrder === "random") {
    orderedReviews = shuffleArray(orderedReviews);
  } else {
    orderedReviews.sort((a, b) => a.due.getTime() - b.due.getTime() || a.rank - b.rank);
  }

  const orderedNew =
    options.newCardGatherOrder === "random"
      ? shuffleArray(newCardsAll)
      : newCardsAll;

  const remainingNewQuota = input.ignoreDailyLimit
    ? orderedNew.length
    : Math.max(0, effectiveNewLimit - newStudiedToday);
  const remainingReviewQuota = input.ignoreDailyLimit
    ? orderedReviews.length
    : Math.max(0, effectiveReviewLimit - reviewsStudiedToday);

  const reviewDue = orderedReviews.slice(0, remainingReviewQuota);
  const newCards = orderedNew.slice(0, remainingNewQuota);

  // Order New / DayLearn / Review according to Display Order options
  const mainPool: LightweightCard[] = [];
  if (options.interdayLearnMix === "before_reviews") {
    mainPool.push(...dayLearnDue);
  }
  if (options.newMix === "before_reviews") {
    mainPool.push(...newCards);
  }
  mainPool.push(...reviewDue);
  if (options.interdayLearnMix !== "before_reviews") {
    mainPool.push(...dayLearnDue);
  }
  if (options.newMix !== "before_reviews") {
    mainPool.push(...newCards);
  }

  const targetCards = [...learnDue, ...mainPool, ...learnAhead].slice(
    0,
    input.limit,
  );
  const targetTermIds = targetCards.map((c) => c.termId);

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

  const estimateConfig = deckOptionsToScheduleConfig(
    options,
    input.timezoneOffsetMinutes,
    false,
  );

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
      again: getIntervalEstimateLabel(state, 1, now, estimateConfig),
      hard: getIntervalEstimateLabel(state, 2, now, estimateConfig),
      good: getIntervalEstimateLabel(state, 3, now, estimateConfig),
      easy: getIntervalEstimateLabel(state, 4, now, estimateConfig),
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

  const learnCount = learnDue.length + dayLearnDue.length + learnAhead.length;

  return {
    deck: studySet
      ? {
          id: studySet.id,
          title: studySet.title,
          userId: studySet.userId,
          isOwner: studySet.userId === userId,
          ankiTemplate: studySet.ankiTemplate ?? null,
          options,
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
      dayKey,
      newStudiedToday,
      newLimit: effectiveNewLimit,
      baseNewLimit: options.newCardsPerDay,
      reviewsStudiedToday,
      reviewLimit: effectiveReviewLimit,
      baseReviewLimit: options.maxReviewsPerDay,
      hasTodayOverride: options.todayOverride?.dayKey === dayKey,
      remainingNewAvailable: Math.max(0, orderedNew.length - newCards.length),
      remainingReviewAvailable: Math.max(
        0,
        orderedReviews.length - reviewDue.length,
      ),
      suspendedCount,
      learnAheadMinutes: options.learnAheadMinutes,
    },
  };
};

export default getReviewQueueHandler;
