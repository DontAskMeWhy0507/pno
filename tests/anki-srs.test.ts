import {
  applyAnkiFuzz,
  calculateNextSchedule,
  getAnkiDayStart,
  getIntervalEstimateLabel,
  isRelearningCard,
  type CardScheduleState,
} from "../packages/lib/src/anki/srs";

describe("Anki V3 / SM-2 SRS Engine", () => {
  // 2026-10-15 12:00 UTC (with timezoneOffsetMinutes: 0 so Anki day starts at 04:00 UTC)
  const baseNow = new Date("2026-10-15T12:00:00Z");
  const tzOpts = { timezoneOffsetMinutes: 0, enableFuzz: false };

  const initialNewCard: CardScheduleState = {
    queue: "New",
    step: 0,
    interval: 0,
    easeFactor: 2500,
    reps: 0,
    lapses: 0,
    due: baseNow,
    lastReviewedAt: null,
  };

  test("New card graded Good advances learning step to 10m", () => {
    const next = calculateNextSchedule(initialNewCard, 3, baseNow, tzOpts);
    expect(next.queue).toBe("Learning");
    expect(next.step).toBe(1);
    expect(next.reps).toBe(1);
    expect(next.interval).toBe(0);
    expect(isRelearningCard(next)).toBe(false);
    expect(next.due.getTime()).toBe(baseNow.getTime() + 10 * 60 * 1000);
  });

  test("New card graded Good at final step graduates to Review anchored to 4:00 AM next day", () => {
    const cardAtStep1: CardScheduleState = {
      ...initialNewCard,
      queue: "Learning",
      step: 1,
      reps: 1,
    };
    const next = calculateNextSchedule(cardAtStep1, 3, baseNow, tzOpts);
    expect(next.queue).toBe("Review");
    expect(next.step).toBe(0);
    expect(next.interval).toBe(1);
    // 2026-10-15 04:00Z + 1d = 2026-10-16 04:00Z (ready next morning, not 24h later)
    expect(next.due.toISOString()).toBe("2026-10-16T04:00:00.000Z");
  });

  test("Day boundary rollover treats 02:00 AM as belonging to previous Anki day", () => {
    const lateNight = new Date("2026-10-16T02:00:00Z");
    const dayStart = getAnkiDayStart(lateNight, 4, 0);
    expect(dayStart.toISOString()).toBe("2026-10-15T04:00:00.000Z");
  });

  test("Single-step Learning/Relearning Hard uses Anki 1.5x rule", () => {
    const singleStepNew: CardScheduleState = {
      ...initialNewCard,
      queue: "Learning",
      step: 0,
    };
    const next = calculateNextSchedule(singleStepNew, 2, baseNow, {
      ...tzOpts,
      learningStepsMinutes: [10],
    });
    expect(next.queue).toBe("Learning");
    expect(next.due.getTime()).toBe(baseNow.getTime() + 15 * 60 * 1000);
  });

  test("Review card graded Again enters Relearning (10m) and preserves post-lapse interval", () => {
    const reviewCard: CardScheduleState = {
      queue: "Review",
      step: 0,
      interval: 20,
      easeFactor: 2500,
      reps: 5,
      lapses: 0,
      due: baseNow,
      lastReviewedAt: new Date(baseNow.getTime() - 20 * 86400000),
    };
    const lapsed = calculateNextSchedule(reviewCard, 1, baseNow, {
      ...tzOpts,
      lapseNewIntervalMultiplier: 0.25,
    });
    expect(lapsed.queue).toBe("Learning");
    expect(isRelearningCard(lapsed)).toBe(true);
    expect(lapsed.step).toBe(0);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.interval).toBe(5); // 20 * 0.25 = 5 days saved for re-graduation
    expect(lapsed.easeFactor).toBe(2300); // 2500 - 200
    expect(lapsed.due.getTime()).toBe(baseNow.getTime() + 10 * 60 * 1000);

    // Relearning Good graduates directly to Review with preserved 5d interval
    const regraduated = calculateNextSchedule(lapsed, 3, baseNow, tzOpts);
    expect(regraduated.queue).toBe("Review");
    expect(regraduated.interval).toBe(5);
    expect(regraduated.due.toISOString()).toBe("2026-10-20T04:00:00.000Z");
  });

  test("Leech threshold suspends card after 8 lapses", () => {
    const leechProneCard: CardScheduleState = {
      queue: "Review",
      step: 0,
      interval: 10,
      easeFactor: 1500,
      reps: 15,
      lapses: 7,
      due: baseNow,
      lastReviewedAt: baseNow,
    };
    const next = calculateNextSchedule(leechProneCard, 1, baseNow, tzOpts);
    expect(next.lapses).toBe(8);
    expect(next.queue).toBe("Suspended");
    expect(getIntervalEstimateLabel(leechProneCard, 1, baseNow, tzOpts)).toBe(
      "Leech",
    );
  });

  test("Ease factor clamps at minimum 1300", () => {
    let card: CardScheduleState = {
      queue: "Review",
      step: 0,
      interval: 5,
      easeFactor: 1400,
      reps: 3,
      lapses: 2,
      due: baseNow,
      lastReviewedAt: baseNow,
    };
    card = calculateNextSchedule(card, 1, baseNow, tzOpts);
    expect(card.easeFactor).toBe(1300);
    // Relearning Again does not penalize ease again
    card = calculateNextSchedule(card, 1, baseNow, tzOpts);
    expect(card.easeFactor).toBe(1300);
    expect(card.lapses).toBe(3);
  });

  test("Review card graded Good accounts for daysLate overdue bonus", () => {
    const overdueDue = new Date("2026-10-05T04:00:00Z"); // 10 days overdue at baseNow
    const reviewCard: CardScheduleState = {
      queue: "Review",
      step: 0,
      interval: 10,
      easeFactor: 2500,
      reps: 5,
      lapses: 0,
      due: overdueDue,
      lastReviewedAt: new Date("2026-09-25T04:00:00Z"),
    };
    const next = calculateNextSchedule(reviewCard, 3, baseNow, tzOpts);
    expect(next.queue).toBe("Review");
    // (10 + 10/2) * 2.5 = 37.5 -> 38 days
    expect(next.interval).toBe(38);
  });

  test("applyAnkiFuzz jitters intervals >= 3 within bounds", () => {
    const low = applyAnkiFuzz(10, 36500, 2, () => 0);
    const high = applyAnkiFuzz(10, 36500, 2, () => 0.9999);
    expect(low).toBe(8); // 10 - max(2, round(1.5)=2) = 8
    expect(high).toBe(12); // 10 + 2 = 12
    expect(applyAnkiFuzz(2, 36500, 2, () => 0.99)).toBe(2);
  });

  test("getIntervalEstimateLabel returns human-friendly badges for New and Review", () => {
    expect(getIntervalEstimateLabel(initialNewCard, 1, baseNow, tzOpts)).toBe("< 1m");
    expect(getIntervalEstimateLabel(initialNewCard, 2, baseNow, tzOpts)).toBe("< 6m");
    expect(getIntervalEstimateLabel(initialNewCard, 3, baseNow, tzOpts)).toBe("< 10m");
    expect(getIntervalEstimateLabel(initialNewCard, 4, baseNow, tzOpts)).toBe("4d");

    const reviewCard: CardScheduleState = {
      queue: "Review",
      step: 0,
      interval: 10,
      easeFactor: 2500,
      reps: 5,
      lapses: 0,
      due: baseNow,
      lastReviewedAt: baseNow,
    };
    expect(getIntervalEstimateLabel(reviewCard, 1, baseNow, tzOpts)).toBe("< 10m");
    expect(getIntervalEstimateLabel(reviewCard, 2, baseNow, tzOpts)).toBe("12d");
    expect(getIntervalEstimateLabel(reviewCard, 3, baseNow, tzOpts)).toBe("25d");
    expect(getIntervalEstimateLabel(reviewCard, 4, baseNow, tzOpts)).toBe("33d");
  });
});
