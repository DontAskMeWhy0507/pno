import type { NonNullableUserContext } from "../../lib/types";
import type { TUnstarTermSchema } from "./unstar-term.schema";

type UnstarTermOptions = {
  ctx: NonNullableUserContext;
  input: TUnstarTermSchema;
};

export const unstarTermHandler = async ({ ctx, input }: UnstarTermOptions) => {
  await ctx.prisma.starredTerm.deleteMany({
    where: {
      termId: input.termId,
      userId: ctx.session.user.id,
    },
  });
};

export default unstarTermHandler;
