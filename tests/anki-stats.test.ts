import { computeAnkiDeckStats } from "../packages/lib/src/anki/stats";

describe("Anki Statistics Engine", () => {
  const now = new Date("2026-10-15T12:00:00Z");

  test("computes card counts, today stats, true retention, buttons, and hours", () => {
    const stats = computeAnkiDeckStats({
      now,
      rolloverHour: 4,
      timezoneOffsetMinutes: 0,
      rangeDays: 30,
      cards: [
        {
          termId: "c1",
          queue: "New",
          step: 0,
          interval: 0,
          easeFactor: 2500,
          reps: 0,
          lapses: 0,
          due: now,
          lastReviewedAt: null,
        },
        {
          termId: "c2",
          queue: "Learning",
          step: 1,
          interval: 0,
          easeFactor: 2500,
          reps: 1,
          lapses: 0,
          due: now,
          lastReviewedAt: now,
        },
        {
          termId: "c3",
          queue: "Review",
          step: 0,
          interval: 10,
          easeFactor: 2500,
          reps: 4,
          lapses: 0,
          due: new Date("2026-10-16T04:00:00Z"),
          lastReviewedAt: now,
        },
        {
          termId: "c4",
          queue: "Review",
          step: 0,
          interval: 30,
          easeFactor: 2650,
          reps: 8,
          lapses: 0,
          due: new Date("2026-10-14T04:00:00Z"), // backlog
          lastReviewedAt: new Date("2026-09-14T04:00:00Z"),
        },
        {
          termId: "c5",
          queue: "Suspended",
          step: 0,
          interval: 1,
          easeFactor: 1300,
          reps: 12,
          lapses: 8,
          due: now,
          lastReviewedAt: now,
        },
      ],
      revlogs: [
        {
          termId: "c2",
          rating: 3,
          kind: "Learning",
          interval: -600,
          lastInterval: 0,
          easeFactor: 2500,
          takenMillis: 4500,
          reviewedAt: new Date("2026-10-15T10:00:00Z"),
        },
        {
          termId: "c3",
          rating: 3,
          kind: "Review",
          interval: 10,
          lastInterval: 4,
          easeFactor: 2500,
          takenMillis: 6000,
          reviewedAt: new Date("2026-10-15T10:05:00Z"),
        },
        {
          termId: "c4",
          rating: 1,
          kind: "Review",
          interval: -600,
          lastInterval: 25,
          easeFactor: 2300,
          takenMillis: 8000,
          reviewedAt: new Date("2026-10-14T10:00:00Z"),
        },
      ],
    });

    expect(stats.cardCounts).toEqual({
      newCards: 1,
      learn: 1,
      relearn: 0,
      young: 1,
      mature: 1,
      suspended: 1,
      total: 5,
    });

    expect(stats.today.answerCount).toBe(2);
    expect(stats.today.correctCount).toBe(2);
    expect(stats.today.correctPct).toBe(100);
    expect(stats.today.learnCount).toBe(1);
    expect(stats.today.reviewCount).toBe(1);

    expect(stats.futureDue.backlog).toBe(1);
    expect(stats.intervals.longestDays).toBe(30);
    expect(stats.buttons.learning).toEqual([0, 0, 1, 0]);
    expect(stats.buttons.young).toEqual([0, 0, 1, 0]);
    expect(stats.buttons.mature).toEqual([1, 0, 0, 0]);
    expect(stats.hours[10]?.total).toBe(3);
    expect(stats.trueRetention.today.youngPct).toBe(100);
    expect(stats.trueRetention.yesterday.maturePct).toBe(0);
    expect(stats.calendar.currentStreak).toBe(2);
  });
});
