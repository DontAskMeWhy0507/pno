import { env } from "@pno/env/server";
import { deleteTermAssets } from "@pno/images/server";

import { TRPCError } from "@trpc/server";

import { markCortexStale } from "../../lib/cortex";
import type { NonNullableUserContext } from "../../lib/types";
import type { TBulkDeleteSchema } from "./bulk-delete.schema";
import { reorder } from "./mutations/reorder";

type BulkDeleteOptions = {
  ctx: NonNullableUserContext;
  input: TBulkDeleteSchema;
};

export const bulkDeleteHandler = async ({ ctx, input }: BulkDeleteOptions) => {
  const studySet = await ctx.prisma.studySet.findUnique({
    where: {
      id_userId: {
        id: input.studySetId,
        userId: ctx.session.user.id,
      },
    },
    select: {
      id: true,
      created: true,
      _count: {
        select: {
          terms: {
            where: {
              ephemeral: false,
            },
          },
        },
      },
    },
  });

  if (!studySet) {
    throw new TRPCError({
      code: "NOT_FOUND",
    });
  }

  const targets = await ctx.prisma.term.findMany({
    where: {
      studySetId: studySet.id,
      ephemeral: false,
      id: {
        in: input.terms,
      },
    },
    select: {
      id: true,
      assetUrl: true,
    },
  });

  if (!targets.length) return;

  if (studySet.created && studySet._count.terms - targets.length < 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Set must contain at least one term",
    });
  }

  await ctx.prisma.term.deleteMany({
    where: {
      studySetId: studySet.id,
      ephemeral: false,
      id: {
        in: targets.map((t) => t.id),
      },
    },
  });

  await reorder(ctx.prisma, input.studySetId);
  await markCortexStale(input.studySetId);

  if (env.ASSETS_BUCKET_URL) {
    const assetKeys = targets
      .filter((t) => t.assetUrl?.startsWith(env.ASSETS_BUCKET_URL!))
      .map((t) => new URL(t.assetUrl!).pathname.slice(1));
    if (assetKeys.length) {
      await deleteTermAssets(assetKeys).catch(() => undefined);
    }
  }
};

export default bulkDeleteHandler;
