import { isClassTeacherOrThrow } from "../../lib/queries/classes";
import type { NonNullableUserContext } from "../../lib/types";
import type { TBanStudentsSchema } from "./ban-students.schema";

type BanStudentsOptions = {
  ctx: NonNullableUserContext;
  input: TBanStudentsSchema;
};

export const banStudentsHandler = async ({
  ctx,
  input,
}: BanStudentsOptions) => {
  await isClassTeacherOrThrow(input.classId, ctx.session.user.id, "mutation");

  const members = await ctx.prisma.classMembership.findMany({
    where: {
      classId: input.classId,
      type: "Student",
      id: {
        in: input.users,
      },
    },
  });

  if (!members.length) return;

  await ctx.prisma.$transaction([
    ctx.prisma.classMembership.deleteMany({
      where: {
        id: {
          in: members.map((member) => member.id),
        },
      },
    }),
    ctx.prisma.classBan.createMany({
      data: members.map((m) => ({
        classId: input.classId,
        userId: m.userId,
        email: m.email,
      })),
      skipDuplicates: true,
    }),
  ]);
};

export default banStudentsHandler;
