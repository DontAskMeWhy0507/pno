import { z } from "zod";

export const ZFromUrlSchema = z.object({
  url: z.string().optional(),
  text: z.string().optional(),
  title: z.string().optional(),
  termDelimiter: z.string().optional(),
  customTermDelimiter: z.string().optional(),
  rowDelimiter: z.string().optional(),
  customRowDelimiter: z.string().optional(),
});

export type TFromUrlSchema = z.infer<typeof ZFromUrlSchema>;
