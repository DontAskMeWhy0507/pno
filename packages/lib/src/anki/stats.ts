import {
  getAnkiDayKey,
  getAnkiDayStart,
  isRelearningCard,
  type AnkiQueue,
} from "./srs";

export type AnkiStatsReviewKind =
  | "Learning"
  | "Review"
  | "Relearning"
  | "Filtered"
  | "Manual";

export interface AnkiStatsCardInput {
  termId: string;
  queue: AnkiQueue;
  step: number;
  interval: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  due: Date;
  lastReviewedAt: Date | null;
}

export interface AnkiStatsRevlogInput {
  termId: string;
  rating: number; // 1..4
  kind: AnkiStatsReviewKind;
  interval: number;
  lastInterval: number;
  easeFactor: number;
  takenMillis: number;
  reviewedAt: Date;
}

export interface AnkiRetentionPeriod {
  youngPassed: number;
  youngFailed: number;
  maturePassed: number;
  matureFailed: number;
  youngPct: number | null;
  maturePct: number | null;
  totalPct: number | null;
}

export interface AnkiDeckStats {
  rangeDays: number; // 30, 90, 365, or 0 (all time)
  today: {
    answerCount: number;
    answerMillis: number;
    avgSecs: number;
    correctCount: number;
    correctPct: number | null;
    matureCount: number;
    matureCorrect: number;
    learnCount: number;
    reviewCount: number;
    relearnCount: number;
  };
  cardCounts: {
    newCards: number;
    learn: number;
    relearn: number;
    young: number;
    mature: number;
    suspended: number;
    total: number;
  };
  futureDue: {
    days: Array<{ dayOffset: number; count: number; young: number; mature: number }>;
    backlog: number;
    dailyLoad: number;
    averageDue: number;
  };
  intervals: {
    buckets: Array<{ label: string; count: number }>;
    averageDays: number;
    longestDays: number;
  };
  eases: {
    buckets: Array<{ label: string; easePct: number; count: number }>;
    averageEasePct: number;
    medianEasePct: number;
  };
  calendar: {
    days: Array<{ dateKey: string; count: number; level: 0 | 1 | 2 | 3 | 4 }>;
    currentStreak: number;
    longestStreak: number;
    daysStudied: number;
    totalDays: number;
    dailyAverage: number;
  };
  reviews: {
    days: Array<{
      dayOffset: number;
      dateKey: string;
      learn: number;
      relearn: number;
      young: number;
      mature: number;
      learnMs: number;
      relearnMs: number;
      youngMs: number;
      matureMs: number;
    }>;
    totalReviews: number;
    totalMillis: number;
  };
  buttons: {
    learning: [number, number, number, number];
    young: [number, number, number, number];
    mature: [number, number, number, number];
  };
  hours: Array<{ hour: number; total: number; correct: number; pct: number | null }>;
  trueRetention: {
    today: AnkiRetentionPeriod;
    yesterday: AnkiRetentionPeriod;
    week: AnkiRetentionPeriod;
    month: AnkiRetentionPeriod;
    year: AnkiRetentionPeriod;
    allTime: AnkiRetentionPeriod;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MATURE_IVL = 21;

function makeRetentionPeriod(
  youngPassed: number,
  youngFailed: number,
  maturePassed: number,
  matureFailed: number,
): AnkiRetentionPeriod {
  const youngTotal = youngPassed + youngFailed;
  const matureTotal = maturePassed + matureFailed;
  const allPassed = youngPassed + maturePassed;
  const allTotal = youngTotal + matureTotal;
  return {
    youngPassed,
    youngFailed,
    maturePassed,
    matureFailed,
    youngPct: youngTotal > 0 ? Math.round((youngPassed / youngTotal) * 1000) / 10 : null,
    maturePct: matureTotal > 0 ? Math.round((maturePassed / matureTotal) * 1000) / 10 : null,
    totalPct: allTotal > 0 ? Math.round((allPassed / allTotal) * 1000) / 10 : null,
  };
}

export function computeAnkiDeckStats(params: {
  cards: AnkiStatsCardInput[];
  revlogs: AnkiStatsRevlogInput[];
  rangeDays?: number;
  rolloverHour?: number;
  timezoneOffsetMinutes?: number;
  now?: Date;
}): AnkiDeckStats {
  const now = params.now ?? new Date();
  const rolloverHour = params.rolloverHour ?? 4;
  const tzOffset = params.timezoneOffsetMinutes ?? now.getTimezoneOffset();
  const rangeDays = params.rangeDays ?? 30;

  const todayStart = getAnkiDayStart(now, rolloverHour, tzOffset);
  const nextDayStart = new Date(todayStart.getTime() + DAY_MS);
  const rangeStartMs =
    rangeDays > 0 ? nextDayStart.getTime() - rangeDays * DAY_MS : 0;

  // 1. Card Counts (Anki rslib/src/stats/graphs/card_counts.rs)
  const cardCounts = {
    newCards: 0,
    learn: 0,
    relearn: 0,
    young: 0,
    mature: 0,
    suspended: 0,
    total: params.cards.length,
  };

  // 2. Future Due (Anki rslib/src/stats/graphs/future_due.rs)
  const forecastHorizon = rangeDays > 0 ? Math.min(365, rangeDays) : 90;
  const futureDueMap = new Map<number, { young: number; mature: number }>();
  let backlog = 0;
  let dailyLoad = 0;

  // 3. Intervals & Eases (Anki rslib/src/stats/graphs/intervals.rs, eases.rs)
  const intervalBuckets = [
    { label: "1d", min: 1, max: 1, count: 0 },
    { label: "2-3d", min: 2, max: 3, count: 0 },
    { label: "4-7d", min: 4, max: 7, count: 0 },
    { label: "8-20d", min: 8, max: 20, count: 0 },
    { label: "21-60d", min: 21, max: 60, count: 0 },
    { label: "61-180d", min: 61, max: 180, count: 0 },
    { label: "181d+", min: 181, max: Number.MAX_SAFE_INTEGER, count: 0 },
  ];
  let sumIntervals = 0;
  let reviewCardCount = 0;
  let longestDays = 0;
  const easeValues: number[] = [];
  const easeMap = new Map<number, number>();

  for (const c of params.cards) {
    if (c.queue === "Suspended") {
      cardCounts.suspended += 1;
      continue;
    }

    const relearning = isRelearningCard({
      queue: c.queue,
      step: c.step,
      interval: c.interval,
      easeFactor: c.easeFactor,
      reps: c.reps,
      lapses: c.lapses,
      due: c.due,
      lastReviewedAt: c.lastReviewedAt,
    });

    if (c.queue === "New") {
      cardCounts.newCards += 1;
    } else if (c.queue === "Learning" || c.queue === "DayLearn") {
      if (relearning) cardCounts.relearn += 1;
      else cardCounts.learn += 1;
    } else if (c.queue === "Review") {
      if (c.interval < MATURE_IVL) cardCounts.young += 1;
      else cardCounts.mature += 1;
    }

    // Future due, intervals, and ease include Review and Relearning cards
    if (c.queue === "Review" || relearning) {
      const ivl = Math.max(1, c.interval);
      reviewCardCount += 1;
      sumIntervals += ivl;
      if (ivl > longestDays) longestDays = ivl;

      for (const b of intervalBuckets) {
        if (ivl >= b.min && ivl <= b.max) {
          b.count += 1;
          break;
        }
      }

      const easePct = Math.round(c.easeFactor / 10);
      const binnedEase = Math.round(easePct / 10) * 10;
      easeValues.push(easePct);
      easeMap.set(binnedEase, (easeMap.get(binnedEase) ?? 0) + 1);

      dailyLoad += 1 / ivl;

      // Day offset: 0 = due today (before nextDayStart and >= todayStart), < 0 = overdue backlog
      const dueMs = c.due.getTime();
      let dayOffset: number;
      if (dueMs < todayStart.getTime()) {
        dayOffset = -1;
        backlog += 1;
      } else {
        dayOffset = Math.floor((dueMs - todayStart.getTime()) / DAY_MS);
      }

      const clampedDay = Math.max(0, dayOffset);
      if (clampedDay < forecastHorizon) {
        const entry = futureDueMap.get(clampedDay) ?? { young: 0, mature: 0 };
        if (ivl >= MATURE_IVL) entry.mature += 1;
        else entry.young += 1;
        futureDueMap.set(clampedDay, entry);
      }
    } else if (c.queue === "DayLearn") {
      const dueMs = c.due.getTime();
      const clampedDay =
        dueMs < todayStart.getTime()
          ? 0
          : Math.floor((dueMs - todayStart.getTime()) / DAY_MS);
      if (dueMs < todayStart.getTime()) backlog += 1;
      if (clampedDay < forecastHorizon) {
        const entry = futureDueMap.get(clampedDay) ?? { young: 0, mature: 0 };
        entry.young += 1;
        futureDueMap.set(clampedDay, entry);
      }
    }
  }

  const futureDueDays: Array<{
    dayOffset: number;
    count: number;
    young: number;
    mature: number;
  }> = [];
  let totalForecastCount = 0;
  for (let d = 0; d < forecastHorizon; d++) {
    const entry = futureDueMap.get(d) ?? { young: 0, mature: 0 };
    const count = entry.young + entry.mature;
    totalForecastCount += count;
    futureDueDays.push({
      dayOffset: d,
      count,
      young: entry.young,
      mature: entry.mature,
    });
  }

  easeValues.sort((a, b) => a - b);
  const medianEasePct =
    easeValues.length === 0
      ? 250
      : easeValues.length % 2 === 1
        ? easeValues[(easeValues.length - 1) / 2]!
        : Math.round(
            (easeValues[easeValues.length / 2 - 1]! +
              easeValues[easeValues.length / 2]!) /
              2,
          );
  const averageEasePct =
    easeValues.length === 0
      ? 250
      : Math.round(
          (easeValues.reduce((s, v) => s + v, 0) / easeValues.length) * 10,
        ) / 10;

  const easeBuckets = Array.from(easeMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([easePct, count]) => ({
      label: `${easePct}%`,
      easePct,
      count,
    }));

  // 4. Revlog aggregations: Today, Calendar, Reviews, Buttons, Hours, True Retention
  const today = {
    answerCount: 0,
    answerMillis: 0,
    avgSecs: 0,
    correctCount: 0,
    correctPct: null as number | null,
    matureCount: 0,
    matureCorrect: 0,
    learnCount: 0,
    reviewCount: 0,
    relearnCount: 0,
  };

  const buttons = {
    learning: [0, 0, 0, 0] as [number, number, number, number],
    young: [0, 0, 0, 0] as [number, number, number, number],
    mature: [0, 0, 0, 0] as [number, number, number, number],
  };

  const hoursBuckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    total: 0,
    correct: 0,
  }));

  const dailyRevMap = new Map<
    string,
    {
      learn: number;
      relearn: number;
      young: number;
      mature: number;
      learnMs: number;
      relearnMs: number;
      youngMs: number;
      matureMs: number;
    }
  >();

  const calendarCounts = new Map<string, number>();

  const retentionBounds = {
    today: { start: todayStart.getTime(), end: nextDayStart.getTime(), yp: 0, yf: 0, mp: 0, mf: 0 },
    yesterday: {
      start: todayStart.getTime() - DAY_MS,
      end: todayStart.getTime(),
      yp: 0,
      yf: 0,
      mp: 0,
      mf: 0,
    },
    week: { start: nextDayStart.getTime() - 7 * DAY_MS, end: nextDayStart.getTime(), yp: 0, yf: 0, mp: 0, mf: 0 },
    month: { start: nextDayStart.getTime() - 30 * DAY_MS, end: nextDayStart.getTime(), yp: 0, yf: 0, mp: 0, mf: 0 },
    year: { start: nextDayStart.getTime() - 365 * DAY_MS, end: nextDayStart.getTime(), yp: 0, yf: 0, mp: 0, mf: 0 },
    allTime: { start: 0, end: nextDayStart.getTime(), yp: 0, yf: 0, mp: 0, mf: 0 },
  };

  let totalReviewsInRange = 0;
  let totalMillisInRange = 0;

  for (const r of params.revlogs) {
    if (r.kind === "Manual") continue;
    const ts = r.reviewedAt.getTime();
    const dayKey = getAnkiDayKey(r.reviewedAt, rolloverHour, tzOffset);
    calendarCounts.set(dayKey, (calendarCounts.get(dayKey) ?? 0) + 1);

    // Today stats
    if (ts >= todayStart.getTime() && ts < nextDayStart.getTime()) {
      today.answerCount += 1;
      today.answerMillis += r.takenMillis;
      if (r.rating > 1) today.correctCount += 1;
      if (r.lastInterval >= MATURE_IVL) {
        today.matureCount += 1;
        if (r.rating > 1) today.matureCorrect += 1;
      }
      if (r.kind === "Learning") today.learnCount += 1;
      else if (r.kind === "Review") today.reviewCount += 1;
      else if (r.kind === "Relearning") today.relearnCount += 1;
    }

    // True retention across all defined windows (cards with interval >= 1d / Review)
    if (r.kind === "Review" || r.lastInterval >= 1) {
      const isMature = r.lastInterval >= MATURE_IVL;
      const passed = r.rating > 1;
      for (const win of Object.values(retentionBounds)) {
        if (ts >= win.start && ts < win.end) {
          if (isMature) {
            if (passed) win.mp += 1;
            else win.mf += 1;
          } else {
            if (passed) win.yp += 1;
            else win.yf += 1;
          }
        }
      }
    }

    // Filter remaining charts (Reviews, Buttons, Hours) by rangeDays
    if (ts < rangeStartMs) continue;

    totalReviewsInRange += 1;
    totalMillisInRange += r.takenMillis;

    // Daily Reviews chart
    const revBucket = dailyRevMap.get(dayKey) ?? {
      learn: 0,
      relearn: 0,
      young: 0,
      mature: 0,
      learnMs: 0,
      relearnMs: 0,
      youngMs: 0,
      matureMs: 0,
    };
    if (r.kind === "Learning") {
      revBucket.learn += 1;
      revBucket.learnMs += r.takenMillis;
    } else if (r.kind === "Relearning") {
      revBucket.relearn += 1;
      revBucket.relearnMs += r.takenMillis;
    } else if (r.kind === "Review") {
      if (r.lastInterval < MATURE_IVL) {
        revBucket.young += 1;
        revBucket.youngMs += r.takenMillis;
      } else {
        revBucket.mature += 1;
        revBucket.matureMs += r.takenMillis;
      }
    }
    dailyRevMap.set(dayKey, revBucket);

    // Answer Buttons (1..4)
    const btnIdx = Math.max(0, Math.min(3, r.rating - 1)) as 0 | 1 | 2 | 3;
    if (r.kind === "Learning" || r.kind === "Relearning" || r.kind === "Filtered") {
      buttons.learning[btnIdx] += 1;
    } else if (r.kind === "Review") {
      if (r.lastInterval < MATURE_IVL) buttons.young[btnIdx] += 1;
      else buttons.mature[btnIdx] += 1;
    }

    // Hourly breakdown (local wall-clock hour)
    const localShifted = new Date(ts - tzOffset * 60_000);
    const hour = localShifted.getUTCHours();
    hoursBuckets[hour]!.total += 1;
    if (r.rating > 1) hoursBuckets[hour]!.correct += 1;
  }

  if (today.answerCount > 0) {
    today.avgSecs =
      Math.round((today.answerMillis / today.answerCount / 1000) * 10) / 10;
    today.correctPct =
      Math.round((today.correctCount / today.answerCount) * 1000) / 10;
  }

  // Build Reviews series (contiguous days back from today)
  const reviewSpanDays = rangeDays > 0 ? Math.min(365, rangeDays) : 90;
  const reviewDays: AnkiDeckStats["reviews"]["days"] = [];
  for (let offset = -(reviewSpanDays - 1); offset <= 0; offset++) {
    const d = new Date(todayStart.getTime() + offset * DAY_MS);
    const dateKey = getAnkiDayKey(d, rolloverHour, tzOffset);
    const b = dailyRevMap.get(dateKey);
    reviewDays.push({
      dayOffset: offset,
      dateKey,
      learn: b?.learn ?? 0,
      relearn: b?.relearn ?? 0,
      young: b?.young ?? 0,
      mature: b?.mature ?? 0,
      learnMs: b?.learnMs ?? 0,
      relearnMs: b?.relearnMs ?? 0,
      youngMs: b?.youngMs ?? 0,
      matureMs: b?.matureMs ?? 0,
    });
  }

  // Build Calendar Heatmap (last 182 days / 26 weeks or 365 days)
  const calendarSpan = 182;
  const calCountsValues = Array.from(calendarCounts.values()).filter((v) => v > 0);
  const maxCalCount = Math.max(1, ...calCountsValues);
  const calendarDays: AnkiDeckStats["calendar"]["days"] = [];
  let daysStudied = 0;
  let totalCalendarReviews = 0;

  for (let offset = -(calendarSpan - 1); offset <= 0; offset++) {
    const d = new Date(todayStart.getTime() + offset * DAY_MS);
    const dateKey = getAnkiDayKey(d, rolloverHour, tzOffset);
    const count = calendarCounts.get(dateKey) ?? 0;
    if (count > 0) daysStudied += 1;
    totalCalendarReviews += count;
    const ratio = count / maxCalCount;
    const level: 0 | 1 | 2 | 3 | 4 =
      count === 0
        ? 0
        : ratio < 0.25
          ? 1
          : ratio < 0.5
            ? 2
            : ratio < 0.75
              ? 3
              : 4;
    calendarDays.push({ dateKey, count, level });
  }

  // Calculate streaks across all calendar history
  let currentStreak = 0;
  for (let offset = 0; offset >= -3650; offset--) {
    const d = new Date(todayStart.getTime() + offset * DAY_MS);
    const key = getAnkiDayKey(d, rolloverHour, tzOffset);
    const count = calendarCounts.get(key) ?? 0;
    if (count > 0) {
      currentStreak += 1;
    } else if (offset === 0) {
      // Allow streak to continue if user hasn't reviewed yet today, check yesterday
      continue;
    } else {
      break;
    }
  }

  let longestStreak = 0;
  let running = 0;
  for (let offset = -365; offset <= 0; offset++) {
    const d = new Date(todayStart.getTime() + offset * DAY_MS);
    const key = getAnkiDayKey(d, rolloverHour, tzOffset);
    if ((calendarCounts.get(key) ?? 0) > 0) {
      running += 1;
      if (running > longestStreak) longestStreak = running;
    } else {
      running = 0;
    }
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  return {
    rangeDays,
    today,
    cardCounts,
    futureDue: {
      days: futureDueDays,
      backlog,
      dailyLoad: Math.round(dailyLoad * 10) / 10,
      averageDue:
        forecastHorizon > 0
          ? Math.round((totalForecastCount / forecastHorizon) * 10) / 10
          : 0,
    },
    intervals: {
      buckets: intervalBuckets.map(({ label, count }) => ({ label, count })),
      averageDays:
        reviewCardCount > 0
          ? Math.round((sumIntervals / reviewCardCount) * 10) / 10
          : 0,
      longestDays,
    },
    eases: {
      buckets: easeBuckets,
      averageEasePct,
      medianEasePct,
    },
    calendar: {
      days: calendarDays,
      currentStreak,
      longestStreak,
      daysStudied,
      totalDays: calendarSpan,
      dailyAverage:
        daysStudied > 0
          ? Math.round((totalCalendarReviews / daysStudied) * 10) / 10
          : 0,
    },
    reviews: {
      days: reviewDays,
      totalReviews: totalReviewsInRange,
      totalMillis: totalMillisInRange,
    },
    buttons,
    hours: hoursBuckets.map((h) => ({
      hour: h.hour,
      total: h.total,
      correct: h.correct,
      pct: h.total > 0 ? Math.round((h.correct / h.total) * 1000) / 10 : null,
    })),
    trueRetention: {
      today: makeRetentionPeriod(
        retentionBounds.today.yp,
        retentionBounds.today.yf,
        retentionBounds.today.mp,
        retentionBounds.today.mf,
      ),
      yesterday: makeRetentionPeriod(
        retentionBounds.yesterday.yp,
        retentionBounds.yesterday.yf,
        retentionBounds.yesterday.mp,
        retentionBounds.yesterday.mf,
      ),
      week: makeRetentionPeriod(
        retentionBounds.week.yp,
        retentionBounds.week.yf,
        retentionBounds.week.mp,
        retentionBounds.week.mf,
      ),
      month: makeRetentionPeriod(
        retentionBounds.month.yp,
        retentionBounds.month.yf,
        retentionBounds.month.mp,
        retentionBounds.month.mf,
      ),
      year: makeRetentionPeriod(
        retentionBounds.year.yp,
        retentionBounds.year.yf,
        retentionBounds.year.mp,
        retentionBounds.year.mf,
      ),
      allTime: makeRetentionPeriod(
        retentionBounds.allTime.yp,
        retentionBounds.allTime.yf,
        retentionBounds.allTime.mp,
        retentionBounds.allTime.mf,
      ),
    },
  };
}
