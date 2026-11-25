import { parseAnkiDeckTemplate } from "@pno/lib/src/anki/presets";
import { resolveDeckOptions, type AnkiQueue } from "@pno/lib/src/anki/srs";
import {
  computeAnkiDeckStats,
  type AnkiStatsCardInput,
  type AnkiStatsReviewKind,
} from "@pno/lib/src/anki/stats";

import type { NonNullableUserContext } from "../../lib/types";
import { assertStudySetReadable } from "./access";
import type { TGetAnkiStatsSchema } from "./get-stats.schema";

export const getStatsHandler = async ({
  ctx,
  input,
}: {
  ctx: NonNullableUserContext;
  input: TGetAnkiStatsSchema;
}) => {
  const userId = ctx.session.user.id;
  const now = new Date();

  await assertStudySetReadable(ctx, input.studySetId);

  const [studySet, terms, schedules, revlogs] = await Promise.all([
    ctx.prisma.studySet.findUnique({
      where: { id: input.studySetId },
      select: { id: true, title: true, ankiTemplate: true },
    }),
    ctx.prisma.term.findMany({
      where: { studySetId: input.studySetId, ephemeral: false },
      orderBy: { rank: "asc" },
      select: { id: true, word: true, rank: true },
    }),
    ctx.prisma.ankiCardSchedule.findMany({
      where: { userId, studySetId: input.studySetId },
    }),
    ctx.prisma.ankiReviewLog.findMany({
      where: { userId, studySetId: input.studySetId },
      orderBy: { reviewedAt: "asc" },
      select: {
        termId: true,
        rating: true,
        kind: true,
        interval: true,
        lastInterval: true,
        easeFactor: true,
        takenMillis: true,
        reviewedAt: true,
      },
    }),
  ]);

  const parsedTemplate = parseAnkiDeckTemplate(studySet?.ankiTemplate);
  const options = resolveDeckOptions(parsedTemplate?.options);

  const scheduleMap = new Map(schedules.map((s) => [s.termId, s]));
  const cards: AnkiStatsCardInput[] = [];
  const cardStates: Array<{
    termId: string;
    queue: AnkiQueue;
    interval: number;
    easeFactor: number;
    lapses: number;
    reps: number;
    due: Date;
  }> = [];
  const suspendedCards: Array<{
    termId: string;
    wordPreview: string;
    lapses: number;
    interval: number;
  }> = [];

  for (const t of terms) {
    const s = scheduleMap.get(t.id);
    const queue = (s?.queue ?? "New") as AnkiQueue;
    const interval = s?.interval ?? 0;
    const easeFactor = s?.easeFactor ?? options.startingEaseFactor;
    const lapses = s?.lapses ?? 0;
    const reps = s?.reps ?? 0;
    const due = s?.due ?? now;

    cards.push({
      termId: t.id,
      queue,
      step: s?.step ?? 0,
      interval,
      easeFactor,
      reps,
      lapses,
      due,
      lastReviewedAt: s?.lastReviewedAt ?? null,
    });

    cardStates.push({
      termId: t.id,
      queue,
      interval,
      easeFactor,
      lapses,
      reps,
      due,
    });

    if (queue === "Suspended") {
      const stripped = t.word
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
      suspendedCards.push({
        termId: t.id,
        wordPreview: stripped || "(Card)",
        lapses,
        interval,
      });
    }
  }

  const stats = computeAnkiDeckStats({
    cards,
    revlogs: revlogs.map((r) => ({
      termId: r.termId,
      rating: r.rating,
      kind: r.kind as AnkiStatsReviewKind,
      interval: r.interval,
      lastInterval: r.lastInterval,
      easeFactor: r.easeFactor,
      takenMillis: r.takenMillis,
      reviewedAt: r.reviewedAt,
    })),
    rangeDays: input.rangeDays,
    rolloverHour: options.rolloverHour,
    timezoneOffsetMinutes: input.timezoneOffsetMinutes,
    now,
  });

  return {
    deckTitle: studySet?.title ?? "",
    stats,
    suspendedCards,
    cardStates,
  };
};

export default getStatsHandler;
