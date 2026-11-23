import { TRPCError } from "@trpc/server";

import type { NonNullableUserContext } from "../../lib/types";
import type { TJoinSchema } from "./join.schema";

type JoinOptions = {
  ctx: NonNullableUserContext;
  input: TJoinSchema;
};

export const joinHandler = async ({ ctx, input }: JoinOptions) => {
  const userEmail = ctx.session.user.email;
  if (!userEmail) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Account email required.",
    });
  }

  const assertNotBanned = async (classId: string) => {
    const ban = await ctx.prisma.classBan.findFirst({
      where: {
        classId,
        OR: [{ userId: ctx.session.user.id }, { email: userEmail }],
      },
      select: { id: true },
    });
    if (ban) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You have been banned from this class.",
      });
    }
  };

  if (input.code) {
    const joinCode = await ctx.prisma.classJoinCode.findUnique({
      where: {
        code: input.code,
      },
    });

    if (!joinCode) throw new TRPCError({ code: "NOT_FOUND" });

    await assertNotBanned(joinCode.classId);

    const membership = await ctx.prisma.classMembership.findFirst({
      where: {
        classId: joinCode.classId,
        userId: ctx.session.user.id,
        deletedAt: null,
      },
    });

    if (membership) return;

    await ctx.prisma.classMembership.upsert({
      where: {
        classId_userId: {
          classId: joinCode.classId,
          userId: ctx.session.user.id,
        },
      },
      create: {
        classId: joinCode.classId,
        userId: ctx.session.user.id,
        email: userEmail,
        type: "Student",
        sectionId: joinCode.sectionId,
      },
      update: {
        deletedAt: null,
        email: userEmail,
        sectionId: joinCode.sectionId,
      },
    });
  } else if (input.id) {
    await assertNotBanned(input.id);

    const invite = await ctx.prisma.pendingClassInvite.findUnique({
      where: {
        classId_email: {
          classId: input.id,
          email: userEmail,
        },
      },
    });

    if (!invite) throw new TRPCError({ code: "NOT_FOUND" });

    await ctx.prisma.$transaction([
      ctx.prisma.pendingClassInvite.delete({
        where: {
          id: invite.id,
        },
      }),
      ctx.prisma.classMembership.upsert({
        where: {
          classId_userId: {
            classId: input.id,
            userId: ctx.session.user.id,
          },
        },
        create: {
          classId: input.id,
          userId: ctx.session.user.id,
          email: userEmail,
          type: invite.type,
          sectionId: invite.sectionId,
        },
        update: {
          deletedAt: null,
          email: userEmail,
          type: invite.type,
          sectionId: invite.sectionId,
        },
      }),
    ]);
  }
};

export default joinHandler;
