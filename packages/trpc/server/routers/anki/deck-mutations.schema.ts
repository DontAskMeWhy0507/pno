import { z } from "zod";

export const ZAnkiTemplateSchema = z.object({
  presetId: z
    .enum(["vocab_pro", "basic", "cloze", "imported", "custom"])
    .optional(),
  fields: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
  qfmt: z.string().max(16000),
  afmt: z.string().max(16000),
  css: z.string().max(16000).default(""),
  isCloze: z.boolean().optional(),
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

export type TCreateAnkiDeckSchema = z.infer<typeof ZCreateAnkiDeckSchema>;
export type TUpdateAnkiDeckSchema = z.infer<typeof ZUpdateAnkiDeckSchema>;
export type TUpdateAnkiTemplateSchema = z.infer<
  typeof ZUpdateAnkiTemplateSchema
>;
