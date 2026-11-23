import { TRPCError } from "@trpc/server";

import type { NonNullableUserContext } from "../../lib/types";
import type { TEditSchema } from "./edit.schema";

type EditOptions = {
  ctx: NonNullableUserContext;
  input: TEditSchema;
};

export const editHandler = async ({ ctx, input }: EditOptions) => {
  const existingSet = await ctx.prisma.studySet.findUnique({
    where: {
      id_userId: {
        id: input.id,
        userId: ctx.session.user.id,
      },
    },
    select: {
      id: true,
      created: true,
    },
  });

  if (!existingSet) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Study set not found.",
    });
  }

  if (existingSet.created && input.title.trim().length < 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Set title is required.",
    });
  }

  let defaultClassId: string | undefined;

  if (input.visibility == "Class") {
    if (ctx.session.user.type != "Teacher")
      throw new TRPCError({
        code: "FORBIDDEN",
      });

    const existing = await ctx.prisma.allowedClassesOnStudySets.findFirst({
      where: {
        studySetId: input.id,
      },
      select: {
        classId: true,
      },
    });

    if (!existing) {
      const firstTeacherClass = await ctx.prisma.classMembership.findFirst({
        where: {
          userId: ctx.session.user.id,
          type: "Teacher",
          deletedAt: null,
        },
        select: {
          class: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!firstTeacherClass)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No classes found",
        });

      defaultClassId = firstTeacherClass.class.id;
    }
  }

  const studySet = await ctx.prisma.$transaction(async (tx) => {
    if (defaultClassId) {
      await tx.allowedClassesOnStudySets.createMany({
        data: [
          {
            classId: defaultClassId,
            studySetId: input.id,
          },
        ],
        skipDuplicates: true,
      });
    }

    return await tx.studySet.update({
      where: {
        id_userId: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      },
      data: {
        title: input.title,
        description: input.description,
        tags: input.tags,
        wordLanguage: input.wordLanguage,
        definitionLanguage: input.definitionLanguage,
        visibility: input.visibility,
      },
    });
  });

  return studySet;
};

export default editHandler;
