import { z } from "zod";

export const ZAddSchema = z.object({
  studySetId: z.string(),
  term: z.object({
    rank: z.number().int().min(0).max(5000),
    word: z.string(),
    definition: z.string(),
    wordRichText: z.string().optional(),
    definitionRichText: z.string().optional(),
  }),
});

export type TAddSchema = z.infer<typeof ZAddSchema>;
