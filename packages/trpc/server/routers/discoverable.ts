import fs from "fs";
import path from "path";

import { EnabledFeature } from "@quenti/lib/feature";

import { createTRPCRouter, lockedProcedure } from "../trpc";

const loadLines = (filename: string): string[] => {
  const candidates = [
    path.join(__dirname, "../static/insults", filename),
    path.join(
      process.cwd(),
      "../../packages/trpc/server/static/insults",
      filename,
    ),
    path.join(process.cwd(), "packages/trpc/server/static/insults", filename),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      return fs
        .readFileSync(filePath, "utf8")
        .split(/\r?\n/)
        .filter((i) => i.length > 0);
    }
  }
  return [];
};

let cachedInsults: { correct: string[]; incorrect: string[] } | null = null;

export const discoverableRouter = createTRPCRouter({
  fetchInsults: lockedProcedure([EnabledFeature.ExtendedFeedbackBank]).query(
    () => {
      if (!cachedInsults) {
        cachedInsults = {
          correct: loadLines("correct.txt"),
          incorrect: loadLines("incorrect.txt"),
        };
      }
      return cachedInsults;
    },
  ),
});
