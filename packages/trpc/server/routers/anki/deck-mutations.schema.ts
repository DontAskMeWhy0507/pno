import { z } from "zod";

export const ZAnkiDeckOptionsSchema = z.object({
  newCardsPerDay: z.number().int().min(0).max(9999),
  maxReviewsPerDay: z.number().int().min(0).max(9999),
  learningStepsMinutes: z.array(z.number().min(1).max(525600)).min(1).max(12),
  graduatingIntervalDays: z.number().int().min(1).max(36500),
  easyIntervalDays: z.number().int().min(1).max(36500),
  newCardGatherOrder: z.enum(["sequential", "random"]),
  relearningStepsMinutes: z.array(z.number().min(1).max(525600)).min(1).max(12),
  minimumLapseIntervalDays: z.number().int().min(1).max(36500),
  leechThreshold: z.number().int().min(0).max(999),
  leechAction: z.enum(["suspend", "tag_only"]),
  newMix: z.enum(["mix", "after_reviews", "before_reviews"]),
  interdayLearnMix: z.enum(["mix", "after_reviews", "before_reviews"]),
  reviewSortOrder: z.enum([
    "due_asc",
    "interval_asc",
    "interval_desc",
    "random",
  ]),
  showTimer: z.boolean(),
  capAnswerTimeSecs: z.number().int().min(5).max(3600),
  disableAutoplay: z.boolean(),
  maxIntervalDays: z.number().int().min(1).max(36500),
  startingEaseFactor: z.number().int().min(1300).max(5000),
  easyIntervalBonus: z.number().min(1).max(5),
  intervalModifier: z.number().min(0.5).max(2.5),
  hardIntervalMultiplier: z.number().min(1).max(2.5),
  lapseNewIntervalMultiplier: z.number().min(0).max(1),
  rolloverHour: z.number().int().min(0).max(23),
  learnAheadMinutes: z.number().int().min(0).max(180),
});

export const ZAnkiTemplateSchema = z.object({
  presetId: z
    .enum(["vocab_pro", "basic", "cloze", "imported", "custom"])
    .optional(),
  fields: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
  qfmt: z.string().max(16000),
  afmt: z.string().max(16000),
  css: z.string().max(16000).default(""),
  isCloze: z.boolean().optional(),
  options: ZAnkiDeckOptionsSchema.partial().optional(),
});

export const ZCreateAnkiDeckSchema = z.object({
  title: z.string().trim().min(1, "Deck title is required").max(255),
  description: z.string().trim().max(2000).optional(),
  presetId: z.enum(["vocab_pro", "basic", "cloze", "custom"]).optional(),
  template: ZAnkiTemplateSchema.optional(),
});

export const ZUpdateAnkiDeckSchema = z.object({
  studySetId: z.string().min(1),
  title: z.string().trim().min(1, "Deck title is required").max(255),
  description: z.string().trim().max(2000),
});

export const ZUpdateAnkiTemplateSchema = z.object({
  studySetId: z.string().min(1),
  template: ZAnkiTemplateSchema,
});

export const ZUpdateAnkiDeckOptionsSchema = z.object({
  studySetId: z.string().min(1),
  options: ZAnkiDeckOptionsSchema.partial().optional(),
  todayOnly: z
    .object({
      newCardsPerDay: z.number().int().min(0).max(9999).optional(),
      maxReviewsPerDay: z.number().int().min(0).max(9999).optional(),
    })
    .nullable()
    .optional(),
  timezoneOffsetMinutes: z.number().int().min(-840).max(840).optional(),
  resetToDefaults: z.boolean().default(false),
});

export type TCreateAnkiDeckSchema = z.infer<typeof ZCreateAnkiDeckSchema>;
export type TUpdateAnkiDeckSchema = z.infer<typeof ZUpdateAnkiDeckSchema>;
export type TUpdateAnkiTemplateSchema = z.infer<
  typeof ZUpdateAnkiTemplateSchema
>;
export type TUpdateAnkiDeckOptionsSchema = z.infer<
  typeof ZUpdateAnkiDeckOptionsSchema
>;
