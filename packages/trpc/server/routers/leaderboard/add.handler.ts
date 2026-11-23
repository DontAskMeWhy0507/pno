import { TRPCError } from "@trpc/server";

import { MATCH_MIN_TIME } from "../../common/constants";
import type { NonNullableUserContext } from "../../lib/types";
import type { TAddSchema } from "./add.schema";
import { validateLeaderboardAccess } from "./utils/access";

type AddOptions = {
  ctx: NonNullableUserContext;
  input: TAddSchema;
};

export const addHandler = async ({ ctx, input }: AddOptions) => {
  const [studySet, folder] = await Promise.all([
    ctx.prisma.studySet.findUnique({
      where: { id: input.entityId },
      select: { id: true, visibility: true, userId: true },
    }),
    ctx.prisma.folder.findUnique({
      where: { id: input.entityId },
      select: {
        id: true,
        userId: true,
        studySets: {
          select: {
            studySet: {
              select: { id: true, userId: true, visibility: true },
            },
          },
        },
      },
    }),
  ]);

  validateLeaderboardAccess({ studySet, folder }, ctx.session.user.id);

  if (studySet?.visibility === "Class" && studySet.userId !== ctx.session.user.id) {
    const allowed = await ctx.prisma.allowedClassesOnStudySets.findFirst({
      where: {
        studySetId: studySet.id,
        class: { members: { some: { userId: ctx.session.user.id, deletedAt: null } } },
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

  const leaderboard = await ctx.prisma.leaderboard.upsert({
    where: {
      entityId_type: {
        entityId: input.entityId,
        type: input.mode,
      },
    },
    create: {
      entityId: input.entityId,
      type: input.mode,
    },
    update: {},
    select: {
      id: true,
    },
  });

  if (input.time < MATCH_MIN_TIME) {
    throw new TRPCError({
      code: "UNPROCESSABLE_CONTENT",
      message: "This site is not for robots.",
    });
  }

  const highscore = await ctx.prisma.highscore.findUnique({
    where: {
      leaderboardId_userId_eligible: {
        leaderboardId: leaderboard.id,
        userId: ctx.session.user.id,
        eligible: input.eligible,
      },
    },
  });

  if (highscore && highscore.time < input.time) {
    return null;
  }

  await ctx.prisma.highscore.upsert({
    where: {
      leaderboardId_userId_eligible: {
        leaderboardId: leaderboard.id,
        userId: ctx.session.user.id,
        eligible: input.eligible,
      },
    },
    create: {
      time: input.time,
      timestamp: new Date(),
      leaderboardId: leaderboard.id,
      userId: ctx.session.user.id,
      eligible: input.eligible,
    },
    update: {
      time: input.time,
      timestamp: new Date(),
    },
  });
};

export default addHandler;
