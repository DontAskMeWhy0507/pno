import { z } from "zod";

export const ZImportPackageSchema = z.object({
  fileBase64: z.string().min(1).max(70_000_000),
  fileName: z.string().max(255).default("anki_deck.apkg"),
});

export type TImportPackageSchema = z.infer<typeof ZImportPackageSchema>;
