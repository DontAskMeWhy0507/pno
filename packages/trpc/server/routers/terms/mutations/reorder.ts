import { chunkArray } from "@pno/lib/array";
import { Prisma, type PrismaClient } from "@pno/prisma/client";

export const reorder = async (
  prisma: Pick<PrismaClient, "term" | "$executeRaw">,
  studySetId: string,
  submissionId?: string,
) => {
  // Sort all of the terms by rank, and update the ranks to be consecutive
  const terms = await prisma.term.findMany({
    where: {
      studySetId: studySetId,
      ...(submissionId
        ? { submissionId, ephemeral: true }
        : { ephemeral: false }),
    },
    orderBy: {
      rank: "asc",
    },
    select: {
      id: true,
      studySetId: true,
    },
  });

  if (!terms.length) return;

  const vals = terms.map((term, i) => [
    term.id,
    term.studySetId,
    "",
    "",
    i,
  ]);

  for (const batch of chunkArray(vals, 250)) {
    const formatted = batch.map((x) => Prisma.sql`(${Prisma.join(x)})`);

    // Query assumes that the update clause will always run
    // word and definition are included as they are required properties for the "insertion"
    const query = Prisma.sql`
      INSERT INTO Term (id, studySetId, word, definition, \`rank\`)
      VALUES ${Prisma.join(formatted)}
      ON DUPLICATE KEY UPDATE Term.\`rank\` = VALUES(\`rank\`)
    `;

    await prisma.$executeRaw(query);
  }
};
