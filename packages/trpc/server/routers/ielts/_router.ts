import { z } from "zod";

import type { Prisma } from "@pno/prisma/client";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

const ZSkill = z.enum(["Reading", "Listening", "Writing", "Speaking"]);

const ZExamInput = z.object({
  examId: z.string().min(1).max(191),
  skill: ZSkill,
  title: z.string().min(1).max(255),
  collection: z.string().min(1).max(120).default("My Tests"),
  data: z.record(z.unknown()),
});

const ZCollectionInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

const ZProgressInput = z.object({
  examId: z.string().min(1).max(191),
  skill: ZSkill,
  state: z.record(z.unknown()),
});

export const ieltsRouter = createTRPCRouter({
  bootstrap: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [customExams, collections, progressList, recentAttempts] =
      await Promise.all([
        ctx.prisma.ieltsCustomExam.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
        }),
        ctx.prisma.ieltsCollection.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
        }),
        ctx.prisma.ieltsProgress.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
        }),
        ctx.prisma.ieltsAttempt.findMany({
          where: { userId },
          orderBy: { completedAt: "desc" },
          take: 200,
          select: {
            id: true,
            examId: true,
            examTitle: true,
            skill: true,
            bandScore: true,
            totalCorrect: true,
            totalQuestions: true,
            timeSpentSeconds: true,
            details: true,
            completedAt: true,
          },
        }),
      ]);

    return {
      customExams,
      collections,
      progressList,
      recentAttempts,
    };
  }),

  upsertExam: protectedProcedure
    .input(ZExamInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      return ctx.prisma.ieltsCustomExam.upsert({
        where: {
          userId_examId_skill: {
            userId,
            examId: input.examId,
            skill: input.skill,
          },
        },
        create: {
          userId,
          examId: input.examId,
          skill: input.skill,
          title: input.title,
          collection: input.collection,
          data: input.data as Prisma.InputJsonValue,
          deleted: false,
        },
        update: {
          title: input.title,
          collection: input.collection,
          data: input.data as Prisma.InputJsonValue,
          deleted: false,
        },
      });
    }),

  deleteExam: protectedProcedure
    .input(
      z.object({
        examId: z.string().min(1).max(191),
        skill: ZSkill,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await ctx.prisma.ieltsCustomExam.upsert({
        where: {
          userId_examId_skill: {
            userId,
            examId: input.examId,
            skill: input.skill,
          },
        },
        create: {
          userId,
          examId: input.examId,
          skill: input.skill,
          title: input.examId,
          collection: "Deleted",
          data: {},
          deleted: true,
        },
        update: {
          deleted: true,
        },
      });
      await ctx.prisma.ieltsProgress.deleteMany({
        where: {
          userId,
          examId: input.examId,
          skill: input.skill,
        },
      });
      return { success: true };
    }),

  upsertCollection: protectedProcedure
    .input(ZCollectionInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      return ctx.prisma.ieltsCollection.upsert({
        where: {
          userId_name: {
            userId,
            name: input.name.trim(),
          },
        },
        create: {
          userId,
          name: input.name.trim(),
          description: input.description,
          deleted: false,
        },
        update: {
          description: input.description,
          deleted: false,
        },
      });
    }),

  deleteCollection: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        examsToTombstone: z
          .array(
            z.object({
              examId: z.string().min(1).max(191),
              skill: ZSkill,
            }),
          )
          .default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const trimmed = input.name.trim();

      await ctx.prisma.$transaction(async (tx) => {
        await tx.ieltsCollection.upsert({
          where: {
            userId_name: {
              userId,
              name: trimmed,
            },
          },
          create: {
            userId,
            name: trimmed,
            deleted: true,
          },
          update: {
            deleted: true,
          },
        });

        for (const ex of input.examsToTombstone) {
          await tx.ieltsCustomExam.upsert({
            where: {
              userId_examId_skill: {
                userId,
                examId: ex.examId,
                skill: ex.skill,
              },
            },
            create: {
              userId,
              examId: ex.examId,
              skill: ex.skill,
              title: ex.examId,
              collection: trimmed,
              data: {},
              deleted: true,
            },
            update: {
              deleted: true,
            },
          });
          await tx.ieltsProgress.deleteMany({
            where: {
              userId,
              examId: ex.examId,
              skill: ex.skill,
            },
          });
        }
      });

      return { success: true };
    }),

  saveProgress: protectedProcedure
    .input(ZProgressInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      return ctx.prisma.ieltsProgress.upsert({
        where: {
          userId_examId_skill: {
            userId,
            examId: input.examId,
            skill: input.skill,
          },
        },
        create: {
          userId,
          examId: input.examId,
          skill: input.skill,
          state: input.state as Prisma.InputJsonValue,
        },
        update: {
          state: input.state as Prisma.InputJsonValue,
        },
      });
    }),

  clearProgress: protectedProcedure
    .input(
      z.object({
        examId: z.string().min(1).max(191),
        skill: ZSkill,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await ctx.prisma.ieltsProgress.deleteMany({
        where: {
          userId,
          examId: input.examId,
          skill: input.skill,
        },
      });
      return { success: true };
    }),

  recordAttempt: protectedProcedure
    .input(
      z.object({
        examId: z.string().min(1).max(191),
        examTitle: z.string().min(1).max(255),
        skill: ZSkill,
        bandScore: z.number().min(0).max(9).nullable().optional(),
        totalCorrect: z.number().int().min(0).default(0),
        totalQuestions: z.number().int().min(0).default(0),
        timeSpentSeconds: z.number().int().min(0).default(0),
        details: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      return ctx.prisma.$transaction(async (tx) => {
        const attempt = await tx.ieltsAttempt.create({
          data: {
            userId,
            examId: input.examId,
            examTitle: input.examTitle,
            skill: input.skill,
            bandScore: input.bandScore ?? null,
            totalCorrect: input.totalCorrect,
            totalQuestions: input.totalQuestions,
            timeSpentSeconds: input.timeSpentSeconds,
            details: input.details as Prisma.InputJsonValue | undefined,
          },
        });
        await tx.ieltsProgress.deleteMany({
          where: {
            userId,
            examId: input.examId,
            skill: input.skill,
          },
        });
        return attempt;
      });
    }),

  deleteAttempt: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.ieltsAttempt.deleteMany({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      });
      return { success: true };
    }),

  bulkSyncLocal: protectedProcedure
    .input(
      z.object({
        customExams: z.array(ZExamInput).max(200).default([]),
        deletedExams: z
          .array(z.object({ examId: z.string().min(1).max(191), skill: ZSkill }))
          .max(200)
          .default([]),
        collections: z.array(ZCollectionInput).max(100).default([]),
        deletedCollections: z.array(z.string().min(1).max(120)).max(100).default([]),
        progressList: z.array(ZProgressInput).max(200).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const existingExams = await ctx.prisma.ieltsCustomExam.findMany({
        where: { userId },
        select: { examId: true, skill: true },
      });
      const existingExamKeys = new Set(
        existingExams.map((e) => `${e.skill}:${e.examId}`),
      );

      for (const exam of input.customExams) {
        if (!existingExamKeys.has(`${exam.skill}:${exam.examId}`)) {
          await ctx.prisma.ieltsCustomExam.create({
            data: {
              userId,
              examId: exam.examId,
              skill: exam.skill,
              title: exam.title,
              collection: exam.collection,
              data: exam.data as Prisma.InputJsonValue,
              deleted: false,
            },
          });
          existingExamKeys.add(`${exam.skill}:${exam.examId}`);
        }
      }

      for (const del of input.deletedExams) {
        if (!existingExamKeys.has(`${del.skill}:${del.examId}`)) {
          await ctx.prisma.ieltsCustomExam.create({
            data: {
              userId,
              examId: del.examId,
              skill: del.skill,
              title: del.examId,
              collection: "Deleted",
              data: {},
              deleted: true,
            },
          });
          existingExamKeys.add(`${del.skill}:${del.examId}`);
        }
      }

      const existingCols = await ctx.prisma.ieltsCollection.findMany({
        where: { userId },
        select: { name: true },
      });
      const existingColNames = new Set(
        existingCols.map((c) => c.name.toLowerCase()),
      );

      for (const col of input.collections) {
        const trimmed = col.name.trim();
        if (!existingColNames.has(trimmed.toLowerCase())) {
          await ctx.prisma.ieltsCollection.create({
            data: {
              userId,
              name: trimmed,
              description: col.description,
              deleted: false,
            },
          });
          existingColNames.add(trimmed.toLowerCase());
        }
      }

      for (const colName of input.deletedCollections) {
        const trimmed = colName.trim();
        if (!existingColNames.has(trimmed.toLowerCase())) {
          await ctx.prisma.ieltsCollection.create({
            data: {
              userId,
              name: trimmed,
              deleted: true,
            },
          });
          existingColNames.add(trimmed.toLowerCase());
        }
      }

      const existingProgress = await ctx.prisma.ieltsProgress.findMany({
        where: { userId },
        select: { examId: true, skill: true },
      });
      const existingProgressKeys = new Set(
        existingProgress.map((p) => `${p.skill}:${p.examId}`),
      );

      for (const prog of input.progressList) {
        if (!existingProgressKeys.has(`${prog.skill}:${prog.examId}`)) {
          await ctx.prisma.ieltsProgress.create({
            data: {
              userId,
              examId: prog.examId,
              skill: prog.skill,
              state: prog.state as Prisma.InputJsonValue,
            },
          });
          existingProgressKeys.add(`${prog.skill}:${prog.examId}`);
        }
      }

      const [customExams, collections, progressList, recentAttempts] =
        await Promise.all([
          ctx.prisma.ieltsCustomExam.findMany({
            where: { userId },
            orderBy: { updatedAt: "desc" },
          }),
          ctx.prisma.ieltsCollection.findMany({
            where: { userId },
            orderBy: { updatedAt: "desc" },
          }),
          ctx.prisma.ieltsProgress.findMany({
            where: { userId },
            orderBy: { updatedAt: "desc" },
          }),
          ctx.prisma.ieltsAttempt.findMany({
            where: { userId },
            orderBy: { completedAt: "desc" },
            take: 200,
            select: {
              id: true,
              examId: true,
              examTitle: true,
              skill: true,
              bandScore: true,
              totalCorrect: true,
              totalQuestions: true,
              timeSpentSeconds: true,
              details: true,
              completedAt: true,
            },
          }),
        ]);

      return {
        customExams,
        collections,
        progressList,
        recentAttempts,
      };
    }),
});
