import { z } from "zod";

export const ZGetReviewQueueSchema = z.object({
  studySetId: z.string(),
  limit: z.number().min(1).max(200).default(50),
  timezoneOffsetMinutes: z.number().int().min(-840).max(840).optional(),
  ignoreDailyLimit: z.boolean().default(false),
});

export type TGetReviewQueueSchema = z.infer<typeof ZGetReviewQueueSchema>;
