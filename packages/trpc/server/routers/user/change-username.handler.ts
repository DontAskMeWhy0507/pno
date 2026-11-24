import { invalidateDefaultOwnerSession } from "@pno/auth";
import { failsPrecondition } from "@pno/lib/usernames";
import { Prisma } from "@pno/prisma/client";

import { TRPCError } from "@trpc/server";

import { importConsole } from "../../../console";
import { usernameProfanity } from "../../common/profanity";
import type { NonNullableUserContext } from "../../lib/types";
import type { TChangeUsernameSchema } from "./change-username.schema";

type ChangeUsernameOptions = {
  ctx: NonNullableUserContext;
  input: TChangeUsernameSchema;
};

export const changeUsernameHandler = async ({
  ctx,
  input,
}: ChangeUsernameOptions) => {
  ctx.req.log.debug("user.changeUsername");

  if (usernameProfanity.exists(input.username)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Username contains profanity.",
    });
  }

  if (failsPrecondition(input.username)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Username is not available.",
    });
  }

  let consoleAvailable = true;
  try {
    consoleAvailable = (await importConsole("index")).usernameAvailable(
      input.username,
    );
  } catch {
    // Optional @pno/console submodule may not be installed
  }

  if (!consoleAvailable) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Username is not available.",
    });
  }

  try {
    await ctx.prisma.user.update({
      where: {
        id: ctx.session.user.id,
      },
      data: {
        username: input.username,
      },
    });
    invalidateDefaultOwnerSession();
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Username is already taken.",
      });
    }
    throw e;
  }
};

export default changeUsernameHandler;
