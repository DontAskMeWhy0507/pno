import { TRPCError } from "@trpc/server";

import type { NonNullableUserContext } from "../../lib/types";

export async function assertStudySetReadable(
  ctx: NonNullableUserContext,
  studySetId: string,
): Promise<void> {
  const studySet = await ctx.prisma.studySet.findUnique({
    where: { id: studySetId },
    select: {
      id: true,
      userId: true,
      created: true,
      visibility: true,
    },
  });

  if (!studySet || (!studySet.created && studySet.userId !== ctx.session.user.id)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Study set not found",
    });
  }

  if (
    studySet.visibility === "Private" &&
    studySet.userId !== ctx.session.user.id
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This study set is private.",
    });
  }

  if (
    studySet.visibility === "Class" &&
    studySet.userId !== ctx.session.user.id
  ) {
    const allowed = await ctx.prisma.allowedClassesOnStudySets.findFirst({
      where: {
        studySetId,
        class: {
          members: {
            some: {
              userId: ctx.session.user.id,
              deletedAt: null,
            },
          },
        },
      },
      select: { studySetId: true },
    });
    if (!allowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "This study set is restricted to specific classes.",
      });
    }
  }
}
