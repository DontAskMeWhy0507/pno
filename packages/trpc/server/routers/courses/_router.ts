import { z } from "zod";

import type { Prisma } from "@pno/prisma/client";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

const ZUpsertCourseInput = z.object({
  courseId: z.string().min(1).max(191),
  title: z.string().min(1).max(255),
  track: z.string().min(1).max(64),
  level: z.string().min(1).max(64).default("Beginner"),
  data: z.record(z.unknown()),
});

const ZSaveProgressInput = z.object({
  courseId: z.string().min(1).max(191),
  state: z.record(z.unknown()),
});

function extractUpdatedAt(obj: unknown): number {
  if (!obj || typeof obj !== "object") return 0;
  const val = (obj as Record<string, unknown>).updatedAt;
  return typeof val === "number" && Number.isFinite(val) ? val : 0;
}

export const coursesRouter = createTRPCRouter({
  bootstrap: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [customCourses, progressList] = await Promise.all([
      ctx.prisma.courseCustom.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      }),
      ctx.prisma.courseProgress.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return {
      customCourses,
      progressList,
    };
  }),

  upsertCourse: protectedProcedure
    .input(ZUpsertCourseInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existing = await ctx.prisma.courseCustom.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId: input.courseId,
          },
        },
      });

      const existingUpdatedAt = extractUpdatedAt(existing?.data);
      const incomingUpdatedAt = extractUpdatedAt(input.data);
      if (
        existing &&
        !existing.deleted &&
        existingUpdatedAt > 0 &&
        incomingUpdatedAt > 0 &&
        existingUpdatedAt > incomingUpdatedAt
      ) {
        return existing;
      }

      return ctx.prisma.courseCustom.upsert({
        where: {
          userId_courseId: {
            userId,
            courseId: input.courseId,
          },
        },
        create: {
          userId,
          courseId: input.courseId,
          title: input.title.trim(),
          track: input.track.trim(),
          level: input.level.trim() || "Beginner",
          data: input.data as Prisma.InputJsonValue,
          deleted: false,
        },
        update: {
          title: input.title.trim(),
          track: input.track.trim(),
          level: input.level.trim() || "Beginner",
          data: input.data as Prisma.InputJsonValue,
          deleted: false,
        },
      });
    }),

  deleteCourse: protectedProcedure
    .input(z.object({ courseId: z.string().min(1).max(191) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await ctx.prisma.courseCustom.upsert({
        where: {
          userId_courseId: {
            userId,
            courseId: input.courseId,
          },
        },
        create: {
          userId,
          courseId: input.courseId,
          title: input.courseId,
          track: "Python",
          level: "Beginner",
          data: {},
          deleted: true,
        },
        update: {
          deleted: true,
        },
      });
      await ctx.prisma.courseProgress.deleteMany({
        where: {
          userId,
          courseId: input.courseId,
        },
      });
      return { success: true };
    }),

  restoreDefaults: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    await ctx.prisma.courseCustom.deleteMany({
      where: {
        userId,
        deleted: true,
      },
    });
    return { success: true };
  }),

  saveProgress: protectedProcedure
    .input(ZSaveProgressInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existing = await ctx.prisma.courseProgress.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId: input.courseId,
          },
        },
      });

      const existingUpdatedAt = extractUpdatedAt(existing?.state);
      const incomingUpdatedAt = extractUpdatedAt(input.state);
      if (
        existing &&
        existingUpdatedAt > 0 &&
        incomingUpdatedAt > 0 &&
        existingUpdatedAt > incomingUpdatedAt
      ) {
        return existing;
      }

      return ctx.prisma.courseProgress.upsert({
        where: {
          userId_courseId: {
            userId,
            courseId: input.courseId,
          },
        },
        create: {
          userId,
          courseId: input.courseId,
          state: input.state as Prisma.InputJsonValue,
        },
        update: {
          state: input.state as Prisma.InputJsonValue,
        },
      });
    }),
});
