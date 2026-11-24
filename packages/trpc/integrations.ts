import { prisma } from "@quenti/prisma";
import { fetchQuizletSet } from "@quenti/lib/src/quizlet/parser";

export const importIntegration = async (path: string) => {
  if (path === "quizlet" || path === "quizlet/index") {
    return {
      importFromUrl: async (url: string, userId: string) => {
        const parsed = await fetchQuizletSet(url);
        const studySet = await prisma.studySet.create({
          data: {
            title: parsed.title,
            description: `Imported from Quizlet (${url})`,
            userId,
            created: true,
            tags: ["quizlet"],
          },
        });

        if (parsed.terms.length > 0) {
          const batchSize = 500;
          for (let i = 0; i < parsed.terms.length; i += batchSize) {
            const chunk = parsed.terms.slice(i, i + batchSize);
            await prisma.term.createMany({
              data: chunk.map((t, idx) => ({
                word: t.word.slice(0, 1000),
                definition: t.definition.slice(0, 1000),
                rank: i + idx,
                studySetId: studySet.id,
                assetUrl: t.imageUrl || null,
              })),
            });
          }
        }

        return {
          createdSetId: studySet.id,
          title: studySet.title,
          terms: parsed.terms.length,
        };
      },
    };
  }

  // Graceful fallback for any missing submodules
  throw new Error(`Integration "${path}" is not available.`);
};
