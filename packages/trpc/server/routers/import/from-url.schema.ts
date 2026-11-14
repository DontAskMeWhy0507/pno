import { z } from "zod";

export const ZFromUrlSchema = z.object({
  url: z.string().optional(),
  text: z.string().optional(),
  title: z.string().optional(),
});

export type TFromUrlSchema = z.infer<typeof ZFromUrlSchema>;
