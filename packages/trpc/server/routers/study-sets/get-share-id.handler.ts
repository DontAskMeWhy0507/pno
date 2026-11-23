import { TRPCError } from "@trpc/server";

import { shortId } from "../../common/generator";
import type { DefaultContext } from "../../lib/types";
import type { TGetShareIdSchema } from "./get-share-id.schema";

type GetShareIdOptions = {
  ctx: DefaultContext;
  input: TGetShareIdSchema;
};

export const getShareIdHandler = async ({ ctx, input }: GetShareIdOptions) => {
  const studySet = await ctx.prisma.studySet.findUnique({
    where: {
      id: input.studySetId,
    },
    select: {
      userId: true,
      visibility: true,
      created: true,
    },
  });

  if (!studySet || !studySet.created) {
    throw new TRPCError({
      code: "NOT_FOUND",
    });
  }

  if (
    studySet.visibility === "Private" &&
    studySet.userId !== ctx.session?.user?.id
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This set is private.",
    });
  }

  if (
    studySet.visibility === "Class" &&
    studySet.userId !== ctx.session?.user?.id
  ) {
    if (!ctx.session?.user?.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "This set is restricted to specific classes.",
      });
    }
    const allowed = await ctx.prisma.allowedClassesOnStudySets.findFirst({
      where: {
        studySetId: input.studySetId,
        class: {
          members: {
            some: {
              userId: ctx.session.user.id,
              deletedAt: null,
            },
          },
        },
      },
      select: { classId: true },
    });
    if (!allowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "This set is restricted to specific classes.",
      });
    }
  }

  return (
    await ctx.prisma.entityShare.upsert({
      where: {
        entityId: input.studySetId,
      },
      create: {
        entityId: input.studySetId,
        id: shortId.rnd(),
        type: "StudySet",
      },
      update: {},
    })
  ).id;
};

export default getShareIdHandler;
