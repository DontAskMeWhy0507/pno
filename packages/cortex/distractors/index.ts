import { shuffleArray } from "@quenti/lib/array";
import type { Term } from "@quenti/prisma/client";

import { generateEmbeddings } from "../lib/embeddings";
import { VectorStore } from "../lib/vector-store";

type DistractorOutput = {
  type: "word" | "definition";
  termId: string;
  distractorId: string;
};

type Operatable = Pick<Term, "id" | "word" | "definition">;

export const bulkGenerateDistractors = async (
  terms: Operatable[],
): Promise<DistractorOutput[]> => {
  const wordDistractors = await generateDistractorsInScope(terms, "word");
  const definitionDistractors = await generateDistractorsInScope(
    terms,
    "definition",
  );

  return [...wordDistractors, ...definitionDistractors];
};

const normalizeField = (text: string) => text.trim().toLowerCase();

export const generateDistractorsInScope = async (
  terms: Operatable[],
  type: "word" | "definition",
) => {
  const output = new Array<DistractorOutput>();
  if (terms.length < 2) return output;

  const embeddings = await generateEmbeddings(terms.map((t) => t[type]));

  if (embeddings.length === terms.length && embeddings.length > 0) {
    const vectorStore = new VectorStore(embeddings);

    for (const [i, embedding] of embeddings.entries()) {
      const term = terms[i]!;
      const seenTexts = new Set<string>([normalizeField(term[type])]);
      const seenIds = new Set<string>([term.id]);
      const nearest = vectorStore.search(
        embedding,
        Math.min(terms.length - 1, 8),
        i,
      );

      let added = 0;
      for (const n of nearest) {
        if (added >= 3) break;
        const candidate = terms[n]!;
        const normText = normalizeField(candidate[type]);
        if (seenIds.has(candidate.id) || !normText || seenTexts.has(normText))
          continue;
        seenIds.add(candidate.id);
        seenTexts.add(normText);
        output.push({
          type,
          termId: term.id,
          distractorId: candidate.id,
        });
        added++;
      }

      if (added < 3) {
        for (const candidate of shuffleArray([...terms])) {
          if (added >= 3) break;
          const normText = normalizeField(candidate[type]);
          if (seenIds.has(candidate.id) || !normText || seenTexts.has(normText))
            continue;
          seenIds.add(candidate.id);
          seenTexts.add(normText);
          output.push({
            type,
            termId: term.id,
            distractorId: candidate.id,
          });
          added++;
        }
      }
    }

    return output;
  }

  for (const term of terms) {
    const seenTexts = new Set<string>([normalizeField(term[type])]);
    const seenIds = new Set<string>([term.id]);
    let added = 0;

    for (const candidate of shuffleArray([...terms])) {
      if (added >= 3) break;
      const normText = normalizeField(candidate[type]);
      if (seenIds.has(candidate.id) || !normText || seenTexts.has(normText))
        continue;
      seenIds.add(candidate.id);
      seenTexts.add(normText);
      output.push({
        type,
        termId: term.id,
        distractorId: candidate.id,
      });
      added++;
    }
  }

  return output;
};
