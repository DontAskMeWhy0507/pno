import { invalidateDefaultOwnerSession } from "@pno/auth";
import { env } from "@pno/env/client";
import { deleteAvatar } from "@pno/images/server";

import type { NonNullableUserContext } from "../../lib/types";

type RemoveAvatarOptions = {
  ctx: NonNullableUserContext;
};

export const removeAvatarHandler = async ({ ctx }: RemoveAvatarOptions) => {
  const index = Math.floor(Math.random() * 5);
  const image = `${env.NEXT_PUBLIC_APP_URL}/avatars/default/${index}.png`;

  await deleteAvatar(ctx.session.user.id);

  await ctx.prisma.user.update({
    where: {
      id: ctx.session.user.id,
    },
    data: {
      image,
    },
  });
  invalidateDefaultOwnerSession();

  return { image };
};

export default removeAvatarHandler;
