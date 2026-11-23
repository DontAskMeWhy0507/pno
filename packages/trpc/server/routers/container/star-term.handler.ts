import { TRPCError } from "@trpc/server";

import type { NonNullableUserContext } from "../../lib/types";
import type { TStarTermSchema } from "./star-term.schema";

type StarTermOptions = {
  ctx: NonNullableUserContext;
  input: TStarTermSchema;
};

export const starTermHandler = async ({ ctx, input }: StarTermOptions) => {
  const container = await ctx.prisma.container.findFirst({
    where: {
      id: input.containerId,
      userId: ctx.session.user.id,
    },
    select: { id: true },
  });
  if (!container) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  await ctx.prisma.starredTerm.upsert({
    where: {
      userId_termId: {
        termId: input.termId,
        userId: ctx.session.user.id,
      },
    },
    create: {
      termId: input.termId,
      containerId: input.containerId,
      userId: ctx.session.user.id,
    },
    update: {},
  });
};

export default starTermHandler;
