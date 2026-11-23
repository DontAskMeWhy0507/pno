import { TRPCError } from "@trpc/server";

import { isClassTeacherOrThrow } from "../../lib/queries/classes";
import type { NonNullableUserContext } from "../../lib/types";
import type { TUpdateStudentsSchema } from "./update-students.schema";

type UpdateStudentsOptions = {
  ctx: NonNullableUserContext;
  input: TUpdateStudentsSchema;
};

export const updateStudentsHandler = async ({
  ctx,
  input,
}: UpdateStudentsOptions) => {
  await isClassTeacherOrThrow(input.classId, ctx.session.user.id, "mutation");

  const section = await ctx.prisma.section.findFirst({
    where: {
      id: input.sectionId,
      classId: input.classId,
    },
    select: { id: true },
  });
  if (!section) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Section does not exist in this class",
    });
  }

  await ctx.prisma.classMembership.updateMany({
    where: {
      classId: input.classId,
      type: "Student",
      deletedAt: null,
      id: {
        in: input.members,
      },
    },
    data: {
      sectionId: input.sectionId,
    },
  });
};

export default updateStudentsHandler;
