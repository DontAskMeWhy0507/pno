export type AnkiRating = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy
export type AnkiQueue = "New" | "Learning" | "Review" | "DayLearn" | "Suspended";

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
  lapseNewIntervalMultiplier: number; // default: 0 (reset to minimumLapseIntervalDays, Anki default)
  minimumLapseIntervalDays: number;   // default: 1
  leechThreshold: number;             // default: 8 lapses -> Suspended
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
  lapseNewIntervalMultiplier: 0,
  minimumLapseIntervalDays: 1,
  leechThreshold: 8,
  maxIntervalDays: 36500,
  newCardsPerDay: 20,
  maxReviewsPerDay: 200,
  learnAheadMinutes: 20,
  rolloverHour: 4,
  enableFuzz: true,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/**
 * Computes the timestamp of the start of the current Anki day (default 04:00 local time).
 * Matches Anki's `day_cutoff` rollover semantics so a "1d" card studied at 22:00
 * becomes due at 04:00 the next morning rather than waiting a full 24h.
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

  // Shift UTC clock into "pseudo-local" coordinates so UTC getters reflect local wall time
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

/**
 * Official Anki SM-2 Hard button delay on learning/relearning steps:
 * - Single step: 1.5x the step (capped at step + 1 day)
 * - First step of >=2 steps: average of step 0 and step 1
 * - Later steps: repeats current step
 */
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

/**
 * Official Anki interval fuzz to prevent cards studied on the same day
 * from clumping together on identical future dates.
 */
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

  // If the step is >= 1 day or crosses into the next Anki day, promote to DayLearn
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
        // Again: restart learning/relearning steps without penalizing ease or lapses
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
        // Hard: 1.5x for single step, average of step 0 & 1 at start, or repeat current step
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
        // Good: advance step or graduate
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
        // Easy: graduate immediately
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

  // Precompute monotonic Anki SM-2 review intervals (Hard < Good < Easy)
  const rawHard = Math.min(
    config.maxIntervalDays,
    Math.max(
      safeInterval + 1,
      Math.round((safeInterval + daysLate / 4) * config.hardIntervalMultiplier),
    ),
  );
  const rawGood = Math.min(
    config.maxIntervalDays,
    Math.max(
      rawHard + 1,
      Math.round((safeInterval + daysLate / 2) * (current.easeFactor / 1000)),
    ),
  );
  const rawEasy = Math.min(
    config.maxIntervalDays,
    Math.max(
      rawGood + 1,
      Math.round(
        (safeInterval + daysLate) *
          (current.easeFactor / 1000) *
          config.easyIntervalBonus,
      ),
    ),
  );

  switch (rating) {
    case 1: {
      // Lapse: reduce ease, increment lapses, enter Relearning (or Suspend if Leech)
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

      if (config.leechThreshold > 0 && nextLapses >= config.leechThreshold) {
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
