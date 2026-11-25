export type AnkiRating = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy
export type AnkiQueue = "New" | "Learning" | "Review" | "DayLearn" | "Suspended";

export type AnkiNewGatherOrder = "sequential" | "random";
export type AnkiReviewMix = "mix" | "after_reviews" | "before_reviews";
export type AnkiReviewSortOrder =
  | "due_asc"
  | "interval_asc"
  | "interval_desc"
  | "random";
export type AnkiLeechAction = "suspend" | "tag_only";

export interface AnkiTodayLimitOverride {
  dayKey: string;
  newCardsPerDay?: number;
  maxReviewsPerDay?: number;
}

export interface AnkiDeckOptions {
  // Daily Limits
  newCardsPerDay: number;
  maxReviewsPerDay: number;
  todayOverride?: AnkiTodayLimitOverride | null;
  // New Cards
  learningStepsMinutes: number[];
  graduatingIntervalDays: number;
  easyIntervalDays: number;
  newCardGatherOrder: AnkiNewGatherOrder;
  // Lapses
  relearningStepsMinutes: number[];
  minimumLapseIntervalDays: number;
  leechThreshold: number;
  leechAction: AnkiLeechAction;
  // Display Order
  newMix: AnkiReviewMix;
  interdayLearnMix: AnkiReviewMix;
  reviewSortOrder: AnkiReviewSortOrder;
  // Timer & Audio
  showTimer: boolean;
  capAnswerTimeSecs: number;
  disableAutoplay: boolean;
  // Advanced SM-2 & Scheduling
  maxIntervalDays: number;
  startingEaseFactor: number;
  easyIntervalBonus: number;
  intervalModifier: number;
  hardIntervalMultiplier: number;
  lapseNewIntervalMultiplier: number;
  rolloverHour: number;
  learnAheadMinutes: number;
}

export interface CardScheduleState {
  queue: AnkiQueue;
  step: number;        // Step index in learning/relearning steps
  interval: number;    // Days (0 if initial learning; >= 1 if Review or Relearning post-lapse interval)
  easeFactor: number;  // 2500 = 250%
  reps: number;
  lapses: number;
  due: Date;
  lastReviewedAt: Date | null;
}

export interface ScheduleConfig {
  learningStepsMinutes: number[];     // default: [1, 10]
  relearningStepsMinutes: number[];   // default: [10]
  graduatingIntervalDays: number;     // default: 1
  easyIntervalDays: number;           // default: 4
  startingEaseFactor: number;         // default: 2500
  minimumEaseFactor: number;          // default: 1300
  hardIntervalMultiplier: number;     // default: 1.2
  easyIntervalBonus: number;          // default: 1.3
  intervalModifier: number;           // default: 1.0 (Anki interval_multiplier)
  lapseNewIntervalMultiplier: number; // default: 0 (reset to minimumLapseIntervalDays, Anki default)
  minimumLapseIntervalDays: number;   // default: 1
  leechThreshold: number;             // default: 8 lapses
  leechAction: AnkiLeechAction;       // default: "suspend"
  maxIntervalDays: number;            // default: 36500 (100 years)
  newCardsPerDay: number;             // default: 20
  maxReviewsPerDay: number;           // default: 200
  learnAheadMinutes: number;          // default: 20 (Anki learn_ahead_secs = 1200)
  rolloverHour: number;               // default: 4 (4:00 AM next day cutoff)
  enableFuzz: boolean;                // default: true
  timezoneOffsetMinutes?: number;     // JS Date.getTimezoneOffset() (UTC - local, in minutes)
}

export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  learningStepsMinutes: [1, 10],
  relearningStepsMinutes: [10],
  graduatingIntervalDays: 1,
  easyIntervalDays: 4,
  startingEaseFactor: 2500,
  minimumEaseFactor: 1300,
  hardIntervalMultiplier: 1.2,
  easyIntervalBonus: 1.3,
  intervalModifier: 1.0,
  lapseNewIntervalMultiplier: 0,
  minimumLapseIntervalDays: 1,
  leechThreshold: 8,
  leechAction: "suspend",
  maxIntervalDays: 36500,
  newCardsPerDay: 20,
  maxReviewsPerDay: 200,
  learnAheadMinutes: 20,
  rolloverHour: 4,
  enableFuzz: true,
};

export const DEFAULT_DECK_OPTIONS: AnkiDeckOptions = {
  newCardsPerDay: DEFAULT_SCHEDULE_CONFIG.newCardsPerDay,
  maxReviewsPerDay: DEFAULT_SCHEDULE_CONFIG.maxReviewsPerDay,
  todayOverride: null,
  learningStepsMinutes: [...DEFAULT_SCHEDULE_CONFIG.learningStepsMinutes],
  graduatingIntervalDays: DEFAULT_SCHEDULE_CONFIG.graduatingIntervalDays,
  easyIntervalDays: DEFAULT_SCHEDULE_CONFIG.easyIntervalDays,
  newCardGatherOrder: "sequential",
  relearningStepsMinutes: [...DEFAULT_SCHEDULE_CONFIG.relearningStepsMinutes],
  minimumLapseIntervalDays: DEFAULT_SCHEDULE_CONFIG.minimumLapseIntervalDays,
  leechThreshold: DEFAULT_SCHEDULE_CONFIG.leechThreshold,
  leechAction: DEFAULT_SCHEDULE_CONFIG.leechAction,
  newMix: "after_reviews",
  interdayLearnMix: "mix",
  reviewSortOrder: "due_asc",
  showTimer: false,
  capAnswerTimeSecs: 60,
  disableAutoplay: false,
  maxIntervalDays: DEFAULT_SCHEDULE_CONFIG.maxIntervalDays,
  startingEaseFactor: DEFAULT_SCHEDULE_CONFIG.startingEaseFactor,
  easyIntervalBonus: DEFAULT_SCHEDULE_CONFIG.easyIntervalBonus,
  intervalModifier: DEFAULT_SCHEDULE_CONFIG.intervalModifier,
  hardIntervalMultiplier: DEFAULT_SCHEDULE_CONFIG.hardIntervalMultiplier,
  lapseNewIntervalMultiplier: DEFAULT_SCHEDULE_CONFIG.lapseNewIntervalMultiplier,
  rolloverHour: DEFAULT_SCHEDULE_CONFIG.rolloverHour,
  learnAheadMinutes: DEFAULT_SCHEDULE_CONFIG.learnAheadMinutes,
};

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, Math.round(val)));
}

function clampFloat(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, val));
}

function normalizeSteps(raw: unknown, fallback: number[]): number[] {
  if (!Array.isArray(raw)) return [...fallback];
  const valid = raw
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 1)
    .map((n) => Math.min(525600, Math.round(n)))
    .slice(0, 12);
  return valid.length > 0 ? valid : [...fallback];
}

export function resolveDeckOptions(
  raw?: Partial<AnkiDeckOptions> | Record<string, unknown> | null,
): AnkiDeckOptions {
  if (!raw || typeof raw !== "object") {
    return {
      ...DEFAULT_DECK_OPTIONS,
      learningStepsMinutes: [...DEFAULT_DECK_OPTIONS.learningStepsMinutes],
      relearningStepsMinutes: [...DEFAULT_DECK_OPTIONS.relearningStepsMinutes],
    };
  }
  const obj = raw as Record<string, unknown>;
  const rawOverride = obj.todayOverride as Record<string, unknown> | null | undefined;
  const todayOverride: AnkiTodayLimitOverride | null =
    rawOverride &&
    typeof rawOverride === "object" &&
    typeof rawOverride.dayKey === "string" &&
    rawOverride.dayKey.length > 0
      ? {
          dayKey: rawOverride.dayKey,
          ...(typeof rawOverride.newCardsPerDay === "number"
            ? { newCardsPerDay: clampInt(rawOverride.newCardsPerDay, 0, 9999, 20) }
            : {}),
          ...(typeof rawOverride.maxReviewsPerDay === "number"
            ? { maxReviewsPerDay: clampInt(rawOverride.maxReviewsPerDay, 0, 9999, 200) }
            : {}),
        }
      : null;

  return {
    newCardsPerDay: clampInt(obj.newCardsPerDay, 0, 9999, DEFAULT_DECK_OPTIONS.newCardsPerDay),
    maxReviewsPerDay: clampInt(obj.maxReviewsPerDay, 0, 9999, DEFAULT_DECK_OPTIONS.maxReviewsPerDay),
    todayOverride,
    learningStepsMinutes: normalizeSteps(
      obj.learningStepsMinutes,
      DEFAULT_DECK_OPTIONS.learningStepsMinutes,
    ),
    graduatingIntervalDays: clampInt(
      obj.graduatingIntervalDays,
      1,
      36500,
      DEFAULT_DECK_OPTIONS.graduatingIntervalDays,
    ),
    easyIntervalDays: clampInt(
      obj.easyIntervalDays,
      1,
      36500,
      DEFAULT_DECK_OPTIONS.easyIntervalDays,
    ),
    newCardGatherOrder:
      obj.newCardGatherOrder === "random" ? "random" : "sequential",
    relearningStepsMinutes: normalizeSteps(
      obj.relearningStepsMinutes,
      DEFAULT_DECK_OPTIONS.relearningStepsMinutes,
    ),
    minimumLapseIntervalDays: clampInt(
      obj.minimumLapseIntervalDays,
      1,
      36500,
      DEFAULT_DECK_OPTIONS.minimumLapseIntervalDays,
    ),
    leechThreshold: clampInt(obj.leechThreshold, 0, 999, DEFAULT_DECK_OPTIONS.leechThreshold),
    leechAction: obj.leechAction === "tag_only" ? "tag_only" : "suspend",
    newMix:
      obj.newMix === "mix" || obj.newMix === "before_reviews"
        ? obj.newMix
        : "after_reviews",
    interdayLearnMix:
      obj.interdayLearnMix === "after_reviews" ||
      obj.interdayLearnMix === "before_reviews"
        ? obj.interdayLearnMix
        : "mix",
    reviewSortOrder:
      obj.reviewSortOrder === "interval_asc" ||
      obj.reviewSortOrder === "interval_desc" ||
      obj.reviewSortOrder === "random"
        ? obj.reviewSortOrder
        : "due_asc",
    showTimer: Boolean(obj.showTimer),
    capAnswerTimeSecs: clampInt(
      obj.capAnswerTimeSecs,
      5,
      3600,
      DEFAULT_DECK_OPTIONS.capAnswerTimeSecs,
    ),
    disableAutoplay: Boolean(obj.disableAutoplay),
    maxIntervalDays: clampInt(
      obj.maxIntervalDays,
      1,
      36500,
      DEFAULT_DECK_OPTIONS.maxIntervalDays,
    ),
    startingEaseFactor: clampInt(
      obj.startingEaseFactor,
      1300,
      5000,
      DEFAULT_DECK_OPTIONS.startingEaseFactor,
    ),
    easyIntervalBonus: clampFloat(
      obj.easyIntervalBonus,
      1.0,
      5.0,
      DEFAULT_DECK_OPTIONS.easyIntervalBonus,
    ),
    intervalModifier: clampFloat(
      obj.intervalModifier,
      0.5,
      2.5,
      DEFAULT_DECK_OPTIONS.intervalModifier,
    ),
    hardIntervalMultiplier: clampFloat(
      obj.hardIntervalMultiplier,
      1.0,
      2.5,
      DEFAULT_DECK_OPTIONS.hardIntervalMultiplier,
    ),
    lapseNewIntervalMultiplier: clampFloat(
      obj.lapseNewIntervalMultiplier,
      0,
      1.0,
      DEFAULT_DECK_OPTIONS.lapseNewIntervalMultiplier,
    ),
    rolloverHour: clampInt(obj.rolloverHour, 0, 23, DEFAULT_DECK_OPTIONS.rolloverHour),
    learnAheadMinutes: clampInt(
      obj.learnAheadMinutes,
      0,
      180,
      DEFAULT_DECK_OPTIONS.learnAheadMinutes,
    ),
  };
}

export function deckOptionsToScheduleConfig(
  options: AnkiDeckOptions,
  timezoneOffsetMinutes?: number,
  enableFuzz = true,
): Partial<ScheduleConfig> {
  return {
    learningStepsMinutes: options.learningStepsMinutes,
    relearningStepsMinutes: options.relearningStepsMinutes,
    graduatingIntervalDays: options.graduatingIntervalDays,
    easyIntervalDays: options.easyIntervalDays,
    startingEaseFactor: options.startingEaseFactor,
    hardIntervalMultiplier: options.hardIntervalMultiplier,
    easyIntervalBonus: options.easyIntervalBonus,
    intervalModifier: options.intervalModifier,
    lapseNewIntervalMultiplier: options.lapseNewIntervalMultiplier,
    minimumLapseIntervalDays: options.minimumLapseIntervalDays,
    leechThreshold: options.leechThreshold,
    leechAction: options.leechAction,
    maxIntervalDays: options.maxIntervalDays,
    newCardsPerDay: options.newCardsPerDay,
    maxReviewsPerDay: options.maxReviewsPerDay,
    learnAheadMinutes: options.learnAheadMinutes,
    rolloverHour: options.rolloverHour,
    enableFuzz,
    timezoneOffsetMinutes,
  };
}

/**
 * Parses an Anki steps string like "1m 10m 1d" or "1 10 1440" into minutes.
 * Mirrors Anki's steps parser (supports s/m/h/d suffixes; rounds up >= 1m).
 */
export function parseStepsString(raw: string): number[] {
  const parts = raw
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  const result: number[] = [];
  for (const part of parts) {
    const m = /^(\d+(?:\.\d+)?)\s*([smhd])?$/i.exec(part);
    if (!m) continue;
    const num = Number(m[1]);
    if (!Number.isFinite(num) || num <= 0) continue;
    const unit = (m[2] ?? "m").toLowerCase();
    let minutes = num;
    if (unit === "s") minutes = num / 60;
    else if (unit === "h") minutes = num * 60;
    else if (unit === "d") minutes = num * 1440;
    result.push(Math.max(1, Math.min(525600, Math.round(minutes))));
  }
  return result;
}

export function formatStepsString(steps: number[]): string {
  return steps
    .map((m) => {
      if (m >= 1440 && m % 1440 === 0) return `${m / 1440}d`;
      if (m >= 60 && m % 60 === 0) return `${m / 60}h`;
      return `${m}m`;
    })
    .join(" ");
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/**
 * Computes the timestamp of the start of the current Anki day (default 04:00 local time).
 */
export function getAnkiDayStart(
  now: Date,
  rolloverHour = DEFAULT_SCHEDULE_CONFIG.rolloverHour,
  timezoneOffsetMinutes?: number,
): Date {
  const offsetMin =
    typeof timezoneOffsetMinutes === "number" && Number.isFinite(timezoneOffsetMinutes)
      ? timezoneOffsetMinutes
      : now.getTimezoneOffset();
  const offsetMs = offsetMin * MINUTE_MS;

  const shifted = new Date(now.getTime() - offsetMs);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const hour = shifted.getUTCHours();

  const startLocalUtcMs = Date.UTC(year, month, day, rolloverHour, 0, 0, 0);
  const adjustedLocalUtcMs =
    hour < rolloverHour ? startLocalUtcMs - DAY_MS : startLocalUtcMs;

  return new Date(adjustedLocalUtcMs + offsetMs);
}

/**
 * Returns the YYYY-MM-DD key for the current Anki day (respecting rolloverHour & timezone).
 */
export function getAnkiDayKey(
  now: Date = new Date(),
  rolloverHour = DEFAULT_SCHEDULE_CONFIG.rolloverHour,
  timezoneOffsetMinutes?: number,
): string {
  const offsetMin =
    typeof timezoneOffsetMinutes === "number" && Number.isFinite(timezoneOffsetMinutes)
      ? timezoneOffsetMinutes
      : now.getTimezoneOffset();
  const dayStart = getAnkiDayStart(now, rolloverHour, offsetMin);
  const shifted = new Date(dayStart.getTime() - offsetMin * MINUTE_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Schedules a day-based due timestamp anchored to the Anki day boundary (rolloverHour).
 */
export function scheduleAnkiDaysDue(
  now: Date,
  intervalDays: number,
  rolloverHour = DEFAULT_SCHEDULE_CONFIG.rolloverHour,
  timezoneOffsetMinutes?: number,
): Date {
  const safeDays = Math.max(1, Math.round(intervalDays));
  const dayStart = getAnkiDayStart(now, rolloverHour, timezoneOffsetMinutes);
  return new Date(dayStart.getTime() + safeDays * DAY_MS);
}

/**
 * Returns true if the card is currently in Relearning (lapsed from Review)
 * rather than initial Learning (from New).
 */
export function isRelearningCard(state: CardScheduleState): boolean {
  return (
    (state.queue === "Learning" || state.queue === "DayLearn") &&
    state.interval >= 1
  );
}

function calculateLearningHardMinutes(steps: number[], stepIndex: number): number {
  const currentStep = Math.max(1, steps[stepIndex] ?? steps[0] ?? 1);
  if (steps.length <= 1) {
    return Math.min(currentStep + 1440, Math.max(1, Math.round(currentStep * 1.5)));
  }
  if (stepIndex === 0) {
    const nextStep = Math.max(1, steps[1] ?? currentStep);
    return Math.max(1, Math.round((currentStep + nextStep) / 2));
  }
  return currentStep;
}

export function applyAnkiFuzz(
  intervalDays: number,
  maxIntervalDays: number,
  minBound = 2,
  randomFn: () => number = Math.random,
): number {
  if (intervalDays < 3) return intervalDays;
  let delta: number;
  if (intervalDays < 7) {
    delta = 1;
  } else if (intervalDays < 30) {
    delta = Math.max(2, Math.round(intervalDays * 0.15));
  } else {
    delta = Math.max(4, Math.round(intervalDays * 0.05));
  }
  const minIv = Math.max(minBound, intervalDays - delta);
  const maxIv = Math.min(maxIntervalDays, intervalDays + delta);
  if (maxIv <= minIv) return minIv;
  return minIv + Math.floor(randomFn() * (maxIv - minIv + 1));
}

function scheduleStepTarget(
  minutes: number,
  now: Date,
  config: ScheduleConfig,
): { queue: "Learning" | "DayLearn"; due: Date } {
  const safeMinutes = Math.max(1, minutes);
  const exactDue = new Date(now.getTime() + safeMinutes * MINUTE_MS);
  const nextCutoff = new Date(
    getAnkiDayStart(now, config.rolloverHour, config.timezoneOffsetMinutes).getTime() +
      DAY_MS,
  );

  if (safeMinutes >= 1440 || exactDue.getTime() >= nextCutoff.getTime()) {
    const days = Math.max(1, Math.round(safeMinutes / 1440));
    return {
      queue: "DayLearn",
      due: scheduleAnkiDaysDue(
        now,
        days,
        config.rolloverHour,
        config.timezoneOffsetMinutes,
      ),
    };
  }

  return {
    queue: "Learning",
    due: exactDue,
  };
}

export function calculateNextSchedule(
  current: CardScheduleState,
  rating: AnkiRating,
  now: Date = new Date(),
  customConfig?: Partial<ScheduleConfig>,
): CardScheduleState {
  if (current.queue === "Suspended") {
    return current;
  }

  const config: ScheduleConfig = { ...DEFAULT_SCHEDULE_CONFIG, ...customConfig };
  const reps = current.reps + 1;
  const isLearningOrRelearning =
    current.queue === "New" ||
    current.queue === "Learning" ||
    current.queue === "DayLearn";

  if (isLearningOrRelearning) {
    const relearning = isRelearningCard(current);
    const steps = relearning
      ? config.relearningStepsMinutes.length > 0
        ? config.relearningStepsMinutes
        : [10]
      : config.learningStepsMinutes.length > 0
        ? config.learningStepsMinutes
        : [1, 10];
    const preservedInterval = relearning ? Math.max(1, current.interval) : 0;

    switch (rating) {
      case 1: {
        const minutes = steps[0] ?? 1;
        const target = scheduleStepTarget(minutes, now, config);
        return {
          queue: target.queue,
          step: 0,
          interval: preservedInterval,
          easeFactor: current.easeFactor,
          reps,
          lapses: current.lapses,
          due: target.due,
          lastReviewedAt: now,
        };
      }
      case 2: {
        const clampedStep = Math.min(current.step, steps.length - 1);
        const minutes = calculateLearningHardMinutes(steps, clampedStep);
        const target = scheduleStepTarget(minutes, now, config);
        return {
          queue: target.queue,
          step: clampedStep,
          interval: preservedInterval,
          easeFactor: current.easeFactor,
          reps,
          lapses: current.lapses,
          due: target.due,
          lastReviewedAt: now,
        };
      }
      case 3: {
        const nextStep = current.step + 1;
        if (nextStep < steps.length) {
          const minutes = steps[nextStep] ?? 10;
          const target = scheduleStepTarget(minutes, now, config);
          return {
            queue: target.queue,
            step: nextStep,
            interval: preservedInterval,
            easeFactor: current.easeFactor,
            reps,
            lapses: current.lapses,
            due: target.due,
            lastReviewedAt: now,
          };
        }

        const baseGradInterval = relearning
          ? preservedInterval
          : config.graduatingIntervalDays;
        const interval = config.enableFuzz
          ? applyAnkiFuzz(baseGradInterval, config.maxIntervalDays, 1)
          : baseGradInterval;
        return {
          queue: "Review",
          step: 0,
          interval,
          easeFactor: current.easeFactor,
          reps,
          lapses: current.lapses,
          due: scheduleAnkiDaysDue(
            now,
            interval,
            config.rolloverHour,
            config.timezoneOffsetMinutes,
          ),
          lastReviewedAt: now,
        };
      }
      case 4: {
        const baseEasyInterval = relearning
          ? Math.max(preservedInterval + 1, config.easyIntervalDays)
          : config.easyIntervalDays;
        const interval = config.enableFuzz
          ? applyAnkiFuzz(baseEasyInterval, config.maxIntervalDays, 1)
          : baseEasyInterval;
        return {
          queue: "Review",
          step: 0,
          interval,
          easeFactor: current.easeFactor,
          reps,
          lapses: current.lapses,
          due: scheduleAnkiDaysDue(
            now,
            interval,
            config.rolloverHour,
            config.timezoneOffsetMinutes,
          ),
          lastReviewedAt: now,
        };
      }
    }
  }

  // Card is in Review queue
  const safeInterval = Math.max(1, current.interval);
  const daysLate = Math.max(
    0,
    Math.floor((now.getTime() - current.due.getTime()) / DAY_MS),
  );
  const ivlMod = config.intervalModifier;

  const rawHard = Math.min(
    config.maxIntervalDays,
    Math.max(
      safeInterval + 1,
      Math.round(
        (safeInterval + daysLate / 4) * config.hardIntervalMultiplier * ivlMod,
      ),
    ),
  );
  const rawGood = Math.min(
    config.maxIntervalDays,
    Math.max(
      rawHard + 1,
      Math.round(
        (safeInterval + daysLate / 2) * (current.easeFactor / 1000) * ivlMod,
      ),
    ),
  );
  const rawEasy = Math.min(
    config.maxIntervalDays,
    Math.max(
      rawGood + 1,
      Math.round(
        (safeInterval + daysLate) *
          (current.easeFactor / 1000) *
          config.easyIntervalBonus *
          ivlMod,
      ),
    ),
  );

  switch (rating) {
    case 1: {
      const nextLapses = current.lapses + 1;
      const nextEase = Math.max(
        config.minimumEaseFactor,
        current.easeFactor - 200,
      );
      const postLapseInterval = Math.min(
        config.maxIntervalDays,
        Math.max(
          config.minimumLapseIntervalDays,
          Math.round(safeInterval * config.lapseNewIntervalMultiplier),
        ),
      );

      const isLeechTrigger =
        config.leechThreshold > 0 &&
        nextLapses >= config.leechThreshold &&
        (nextLapses === config.leechThreshold ||
          (nextLapses - config.leechThreshold) %
            Math.max(1, Math.floor(config.leechThreshold / 2)) ===
            0);

      if (config.leechAction === "suspend" && isLeechTrigger) {
        return {
          queue: "Suspended",
          step: 0,
          interval: postLapseInterval,
          easeFactor: nextEase,
          reps,
          lapses: nextLapses,
          due: now,
          lastReviewedAt: now,
        };
      }

      const relearnSteps =
        config.relearningStepsMinutes.length > 0
          ? config.relearningStepsMinutes
          : [10];
      const firstMinutes = relearnSteps[0] ?? 10;
      const target = scheduleStepTarget(firstMinutes, now, config);
      return {
        queue: target.queue,
        step: 0,
        interval: postLapseInterval,
        easeFactor: nextEase,
        reps,
        lapses: nextLapses,
        due: target.due,
        lastReviewedAt: now,
      };
    }
    case 2: {
      const interval = config.enableFuzz
        ? applyAnkiFuzz(rawHard, config.maxIntervalDays, safeInterval + 1)
        : rawHard;
      const easeFactor = Math.max(
        config.minimumEaseFactor,
        current.easeFactor - 150,
      );
      return {
        queue: "Review",
        step: 0,
        interval,
        easeFactor,
        reps,
        lapses: current.lapses,
        due: scheduleAnkiDaysDue(
          now,
          interval,
          config.rolloverHour,
          config.timezoneOffsetMinutes,
        ),
        lastReviewedAt: now,
      };
    }
    case 3: {
      const interval = config.enableFuzz
        ? applyAnkiFuzz(rawGood, config.maxIntervalDays, rawHard + 1)
        : rawGood;
      return {
        queue: "Review",
        step: 0,
        interval,
        easeFactor: current.easeFactor,
        reps,
        lapses: current.lapses,
        due: scheduleAnkiDaysDue(
          now,
          interval,
          config.rolloverHour,
          config.timezoneOffsetMinutes,
        ),
        lastReviewedAt: now,
      };
    }
    case 4: {
      const interval = config.enableFuzz
        ? applyAnkiFuzz(rawEasy, config.maxIntervalDays, rawGood + 1)
        : rawEasy;
      return {
        queue: "Review",
        step: 0,
        interval,
        easeFactor: current.easeFactor + 150,
        reps,
        lapses: current.lapses,
        due: scheduleAnkiDaysDue(
          now,
          interval,
          config.rolloverHour,
          config.timezoneOffsetMinutes,
        ),
        lastReviewedAt: now,
      };
    }
  }
}

export function getIntervalEstimateLabel(
  current: CardScheduleState,
  rating: AnkiRating,
  now: Date = new Date(),
  customConfig?: Partial<ScheduleConfig>,
): string {
  const next = calculateNextSchedule(current, rating, now, {
    ...customConfig,
    enableFuzz: false,
  });

  if (next.queue === "Suspended") {
    return "Leech";
  }

  if (next.queue === "Review" || next.queue === "DayLearn") {
    const days =
      next.queue === "DayLearn"
        ? Math.max(1, Math.round((next.due.getTime() - now.getTime()) / DAY_MS))
        : Math.max(1, next.interval);
    if (days >= 365) {
      const years = (days / 365).toFixed(1).replace(/\.0$/, "");
      return `${years}y`;
    }
    if (days >= 60) {
      const months = (days / 30).toFixed(1).replace(/\.0$/, "");
      return `${months}mo`;
    }
    return `${days}d`;
  }

  const diffMs = next.due.getTime() - now.getTime();
  const minutes = Math.max(1, Math.round(diffMs / MINUTE_MS));
  return `< ${minutes}m`;
}
