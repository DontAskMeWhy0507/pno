import { DeleteObjectsCommand, ListObjectsCommand } from "@aws-sdk/client-s3";
import jwt from "jsonwebtoken";

import { env } from "@quenti/env/server";

import { S3, USERS_BUCKET } from ".";

export const getPresignedAvatarJwt = (userId: string) => {
  if (!S3) return "";

  return jwt.sign({ sub: userId }, env.QUENTI_ENCRYPTION_KEY, {
    expiresIn: "120s",
  });
};

export const getUserAvatarUrl = async (userId: string) => {
  if (!S3) return null;

  try {
    const objects = await S3.send(
      new ListObjectsCommand({
        Bucket: USERS_BUCKET,
        Prefix: `${userId}/avatar/`,
      }),
    );

    if (!objects.Contents?.length) return null;
    const keys = objects.Contents.map((object) => object.Key).filter(
      (key) => !!key,
    ) as string[];

    const parsed = keys
      .map((key) => ({
        key,
        ts: Number.parseInt(key.split("/")[2]?.split(".")[0] ?? "", 10),
      }))
      .filter((x) => Number.isFinite(x.ts));

    if (!parsed.length) return null;

    const latestKey = parsed.reduce((a, b) => (b.ts > a.ts ? b : a)).key;
    const toPrune = keys.filter((key) => key !== latestKey);

    if (toPrune.length) {
      await S3.send(
        new DeleteObjectsCommand({
          Bucket: USERS_BUCKET,
          Delete: { Objects: toPrune.map((k) => ({ Key: k })) },
        }),
      );
    }

    return `${env.USERS_BUCKET_URL}/${latestKey}`;
  } catch {
    return null;
  }
};

export const deleteAvatar = async (userId: string) => {
  if (!S3) return;

  try {
    const objects = await S3.send(
      new ListObjectsCommand({
        Bucket: USERS_BUCKET,
        Prefix: `${userId}/avatar/`,
      }),
    );

    if (!objects.Contents?.length) return;
    const keys = objects.Contents.map((object) => object.Key).filter(
      (key) => !!key,
    ) as string[];

    await S3.send(
      new DeleteObjectsCommand({
        Bucket: USERS_BUCKET,
        Delete: { Objects: keys.map((k) => ({ Key: k })) },
      }),
    );
  } catch {
    return;
  }
};
