import { z } from "zod";

const ZCardPayloadShape = {
  frontHtml: z.string().max(32000).optional(),
  backHtml: z.string().max(32000).optional(),
  ankiFields: z.record(z.string().max(16000)).optional(),
  clozeOrdinal: z.number().int().min(1).max(50).optional(),
  assetUrl: z.string().max(255).nullable().optional(),
};

export const ZAddAnkiCardSchema = z.object({
  studySetId: z.string().min(1),
  ...ZCardPayloadShape,
});

export const ZUpdateAnkiCardSchema = z.object({
  studySetId: z.string().min(1),
  termId: z.string().min(1),
  ...ZCardPayloadShape,
});

export const ZDeleteAnkiCardSchema = z.object({
  studySetId: z.string().min(1),
  termId: z.string().min(1),
});

export type TAddAnkiCardSchema = z.infer<typeof ZAddAnkiCardSchema>;
export type TUpdateAnkiCardSchema = z.infer<typeof ZUpdateAnkiCardSchema>;
export type TDeleteAnkiCardSchema = z.infer<typeof ZDeleteAnkiCardSchema>;
