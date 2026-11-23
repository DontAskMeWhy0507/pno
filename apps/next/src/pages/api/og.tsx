/* eslint-disable @next/next/no-img-element */

/* eslint-disable jsx-a11y/alt-text */
import { ImageResponse } from "@vercel/og";
import type { NextRequest } from "next/server";
import type { SatoriOptions } from "satori";
import { z } from "zod";

import { EntityImage, ProfileImage } from "../../lib/og-images";

export const config = {
  runtime: "edge",
};

const outfit = fetch(
  new URL("../../../public/assets/fonts/Outfit-Bold.ttf", import.meta.url),
).then((res) => res.arrayBuffer());
const openSansRegular = fetch(
  new URL("../../../public/assets/fonts/OpenSans-Regular.ttf", import.meta.url),
).then((res) => res.arrayBuffer());

const entitySchema = z.object({
  type: z.enum(["StudySet", "Folder"]),
  title: z.string(),
  description: z.string(),
  numItems: z.number(),
  user: z.object({
    image: z.string(),
    username: z.string(),
  }),
  collaborators: z
    .object({
      total: z.number(),
      avatars: z.array(z.string()),
    })
    .optional(),
});

const profileSchema = z.object({
  username: z.string(),
  image: z.string(),
  name: z.string().nullish(),
  verified: z.boolean(),
});

export default async function handler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageType = searchParams.get("type");

  const [openSansRegularData, outfitData] = await Promise.all([
    openSansRegular,
    outfit,
  ]);

  const ogConfig = {
    width: 1200,
    height: 628,
    fonts: [
      {
        name: "Open Sans",
        data: openSansRegularData,
        style: "normal",
        weight: 400,
      },
      {
        name: "Outfit",
        data: outfitData,
        style: "normal",
      },
    ] as SatoriOptions["fonts"],
  };

  switch (imageType) {
    case "StudySet":
    case "Folder": {
      let parsedInput: z.infer<typeof entitySchema>;
      try {
        const total = searchParams.get("collaborators");
        const avatars = searchParams.get("avatars");
        const collab =
          total && avatars
            ? {
                total: parseInt(total, 10),
                avatars: JSON.parse(avatars) as string[],
              }
            : undefined;

        parsedInput = entitySchema.parse({
          type: searchParams.get("type"),
          title: searchParams.get("title"),
          description: searchParams.get("description"),
          numItems: parseInt(searchParams.get("numItems") ?? "", 10),
          user: {
            image: searchParams.get("userImage"),
            username: searchParams.get("username"),
          },
          collaborators: collab,
        });
      } catch {
        return new Response("Invalid query parameters", { status: 400 });
      }

      const { type, title, description, numItems, user, collaborators } =
        parsedInput;

      const img = new ImageResponse(
        (
          <EntityImage
            type={type}
            title={title}
            description={description}
            numItems={numItems}
            user={user}
            collaborators={collaborators}
          />
        ),
        ogConfig,
      ) as { body: BodyInit };

      return new Response(img.body, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }

    case "profile": {
      let parsedProfile: z.infer<typeof profileSchema>;
      try {
        parsedProfile = profileSchema.parse({
          username: searchParams.get("username"),
          image: searchParams.get("image"),
          name: searchParams.get("name"),
          verified: searchParams.get("verified") === "true",
        });
      } catch {
        return new Response("Invalid query parameters", { status: 400 });
      }

      const { username, image, name, verified } = parsedProfile;

      const img = new ImageResponse(
        (
          <ProfileImage
            username={username}
            image={image}
            name={name ?? null}
            verified={verified}
          />
        ),
        ogConfig,
      ) as { body: BodyInit };

      return new Response(img.body, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }

    default: {
      return new Response(undefined, { status: 404 });
    }
  }
}
