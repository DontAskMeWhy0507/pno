import { z } from "zod";

import { UserType } from "@pno/prisma/client";

import { createTRPCRouter, devProcedure } from "../trpc";

export const devRouter = createTRPCRouter({
  setAccountType: devProcedure
    .input(z.nativeEnum(UserType))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { type: input },
      });
    }),
});
