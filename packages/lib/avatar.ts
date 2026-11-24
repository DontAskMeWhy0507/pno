import type { User } from "@pno/prisma/client";

/// Legacy
export const avatarUrl = (user: Pick<User, "username" | "image">): string =>
  user.image!;
