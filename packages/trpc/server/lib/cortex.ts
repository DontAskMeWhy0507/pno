import { bulkGenerateDistractors } from "@quenti/cortex/distractors";
import { prisma } from "@quenti/prisma";

export const markCortexStale = async (id: string) => {
  await prisma.studySet.update({
    where: {
      id,
    },
    data: {
      cortexStale: true,
    },
  });
};

export const regenerateCortex = async (id: string) => {
  const terms = await prisma.term.findMany({
    where: {
      studySetId: id,
    },
    select: {
      ephemeral: true,
      id: true,
      word: true,
      definition: true,
    },
  });

  const operatableTerms = terms.filter((t) => !t.ephemeral);
  const distractors = await bulkGenerateDistractors(operatableTerms);

  const ids = terms.map((d) => d.id);

  await prisma.distractor.deleteMany({
    where: {
      OR: [{ termId: { in: ids } }, { distractingId: { in: ids } }],
    },
  });
  if (distractors.length > 0) {
    await prisma.distractor.createMany({
      data: distractors.map((d) => ({
        type: d.type == "word" ? "Word" : "Definition",
        termId: d.termId,
        distractingId: d.distractorId,
      })),
    });
  }
  await prisma.studySet.update({
    where: {
      id,
    },
    data: {
      cortexStale: operatableTerms.length >= 2 && distractors.length === 0,
    },
  });

  return distractors;
};
