import { z } from "zod";

export const ZFromUrlSchema = z.object({
  url: z.string().max(2048).optional(),
  text: z.string().max(2_000_000).optional(),
  title: z.string().max(255).optional(),
  termDelimiter: z.string().max(32).optional(),
  customTermDelimiter: z.string().max(32).optional(),
  rowDelimiter: z.string().max(32).optional(),
  customRowDelimiter: z.string().max(32).optional(),
});

export type TFromUrlSchema = z.infer<typeof ZFromUrlSchema>;
