import {
  calculateNextSchedule,
  getIntervalEstimateLabel,
  isRelearningCard,
  type CardScheduleState,
} from "../packages/lib/src/anki/srs";

describe("Anki Review Queue and State Transitions", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  const opts = { timezoneOffsetMinutes: 0, enableFuzz: false };

  test("calculates interval badges for cards in review queue", () => {
    const card: CardScheduleState = {
      queue: "New",
      step: 0,
      interval: 0,
      easeFactor: 2500,
      reps: 0,
      lapses: 0,
      due: now,
      lastReviewedAt: null,
    };

    const estimates = {
      again: getIntervalEstimateLabel(card, 1, now, opts),
      hard: getIntervalEstimateLabel(card, 2, now, opts),
      good: getIntervalEstimateLabel(card, 3, now, opts),
      easy: getIntervalEstimateLabel(card, 4, now, opts),
    };

    expect(estimates.again).toBe("< 1m");
    expect(estimates.hard).toBe("< 6m");
    expect(estimates.good).toBe("< 10m");
    expect(estimates.easy).toBe("4d");
  });

  test("submitting rating 3 (Good) on step 0 transitions to step 1 and sets due in 10 minutes", () => {
    const card: CardScheduleState = {
      queue: "New",
      step: 0,
      interval: 0,
      easeFactor: 2500,
      reps: 0,
      lapses: 0,
      due: now,
      lastReviewedAt: null,
    };

    const next = calculateNextSchedule(card, 3, now, opts);
    expect(next.queue).toBe("Learning");
    expect(next.step).toBe(1);
    expect(next.due.getTime()).toBe(now.getTime() + 10 * 60 * 1000);
  });

  test("submitting rating 1 (Again) on review card enters Relearning (10m) with lapse count", () => {
    const card: CardScheduleState = {
      queue: "Review",
      step: 0,
      interval: 15,
      easeFactor: 2400,
      reps: 7,
      lapses: 1,
      due: now,
      lastReviewedAt: new Date(now.getTime() - 15 * 86400000),
    };

    const next = calculateNextSchedule(card, 1, now, opts);
    expect(next.queue).toBe("Learning");
    expect(isRelearningCard(next)).toBe(true);
    expect(next.step).toBe(0);
    expect(next.lapses).toBe(2);
    expect(next.easeFactor).toBe(2200); // 2400 - 200
    expect(next.due.getTime()).toBe(now.getTime() + 10 * 60 * 1000);
  });
});
