import type { SetFolderEntity } from "@quenti/interfaces";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { getBelongingClasses } from "./classes/utils/get-belonging";
import { getRecentFolders } from "./folders/utils/recent";
import { getRecentDrafts, getRecentStudySets } from "./study-sets/utils/recent";

export const recentRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session!.user.id;
    const [sets, folders, drafts, classes] = await Promise.all([
      getRecentStudySets(ctx.prisma, userId),
      getRecentFolders(ctx.prisma, userId),
      getRecentDrafts(ctx.prisma, userId),
      getBelongingClasses(userId),
    ]);
    const entities = new Array<SetFolderEntity>();

    for (const set of sets) {
      entities.push({
        ...set,
        entityType: "set",
        slug: null,
        numItems: set._count.terms,
      });
    }
    for (const draft of drafts) {
      entities.push({
        ...draft,
        draft: true,
        entityType: "set",
        viewedAt: draft.savedAt,
        slug: null,
        numItems: draft._count.terms,
      });
    }
    for (const folder of folders) {
      entities.push({
        ...folder,
        entityType: "folder",
        numItems: folder._count.studySets,
      });
    }

    return {
      sets,
      folders,
      classes,
      entities: entities
        .sort((a, b) => {
          const tA = new Date(a.viewedAt || a.createdAt).getTime();
          const tB = new Date(b.viewedAt || b.createdAt).getTime();
          return tB - tA;
        })
        .slice(0, 16),
      drafts,
    };
  }),
});
