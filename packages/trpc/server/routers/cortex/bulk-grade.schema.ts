import { z } from "zod";

export const ZBulkGradeSchema = z.object({
  answers: z
    .array(
      z.object({
        index: z.number().int().min(0),
        answer: z.string().max(1000),
        input: z.string().max(1000),
      }),
    )
    .max(50),
});

export type TBulkGradeSchema = z.infer<typeof ZBulkGradeSchema>;
