import { createTRPCRouter, protectedProcedure } from "../trpc";

export const syncRouter = createTRPCRouter({
  versions: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [
      sets,
      containers,
      folders,
      ieltsExams,
      ieltsCols,
      ieltsProg,
      ieltsAttempts,
    ] = await Promise.all([
      ctx.prisma.studySet.aggregate({
        where: { userId },
        _max: { savedAt: true },
        _count: { _all: true },
      }),
      ctx.prisma.container.aggregate({
        where: { userId },
        _max: { viewedAt: true },
        _count: { _all: true },
      }),
      ctx.prisma.folder.aggregate({
        where: { userId },
        _max: { createdAt: true },
        _count: { _all: true },
      }),
      ctx.prisma.ieltsCustomExam.aggregate({
        where: { userId },
        _max: { updatedAt: true },
        _count: { _all: true },
      }),
      ctx.prisma.ieltsCollection.aggregate({
        where: { userId },
        _max: { updatedAt: true },
        _count: { _all: true },
      }),
      ctx.prisma.ieltsProgress.aggregate({
        where: { userId },
        _max: { updatedAt: true },
        _count: { _all: true },
      }),
      ctx.prisma.ieltsAttempt.aggregate({
        where: { userId },
        _max: { completedAt: true },
        _count: { _all: true },
      }),
    ]);

    return {
      quizVersion: `${sets._count._all}:${sets._max.savedAt?.getTime() ?? 0}:${containers._count._all}:${containers._max.viewedAt?.getTime() ?? 0}:${folders._count._all}:${folders._max.createdAt?.getTime() ?? 0}`,
      ieltsVersion: `${ieltsExams._count._all}:${ieltsExams._max.updatedAt?.getTime() ?? 0}:${ieltsCols._count._all}:${ieltsCols._max.updatedAt?.getTime() ?? 0}:${ieltsProg._count._all}:${ieltsProg._max.updatedAt?.getTime() ?? 0}:${ieltsAttempts._count._all}:${ieltsAttempts._max.completedAt?.getTime() ?? 0}`,
      serverTime: Date.now(),
    };
  }),
});
