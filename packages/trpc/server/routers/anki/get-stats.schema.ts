import { z } from "zod";

export const ZGetAnkiStatsSchema = z.object({
  studySetId: z.string().min(1),
  rangeDays: z.number().int().min(0).max(3650).default(30),
  timezoneOffsetMinutes: z.number().int().min(-840).max(840).optional(),
});

export type TGetAnkiStatsSchema = z.infer<typeof ZGetAnkiStatsSchema>;
