import { z } from "zod";

export const ZSubmitReviewSchema = z.object({
  studySetId: z.string(),
  termId: z.string(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  takenMillis: z.number().int().min(0).max(3600000).default(0),
  timezoneOffsetMinutes: z.number().int().min(-840).max(840).optional(),
});

export type TSubmitReviewSchema = z.infer<typeof ZSubmitReviewSchema>;
