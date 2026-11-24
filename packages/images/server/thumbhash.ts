import { rgbaToThumbHash } from "thumbhash";

import { env } from "@pno/env/client";

const transform = (url: string, transform: string) => {
  const v = url.includes("?") ? "&" : "?";
  return `${env.NEXT_PUBLIC_CGI_ENDPOINT}/${url}${v}twic=v1/${transform}`;
};

export const thumbhashFromCdn = async (
  url: string,
  width = 256,
  height = 256,
) => {
  if (!env.NEXT_PUBLIC_CGI_ENDPOINT) return null;

  const endpoint = transform(url, `cover=${width}x${height}`);

  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const buffer = await response.arrayBuffer();
  // Scale down the image to have the longest dimension be at most 100 px
  const scaledWidth = Math.floor(width > height ? 100 : (width / height) * 100);
  const scaledHeight = Math.floor(
    height > width ? 100 : (height / width) * 100,
  );
  // Get the raw rgba data from the image, png encoding won't work
  let sharpFn: typeof import("sharp");
  try {
    const mod = await import("sharp");
    sharpFn = (mod.default ?? mod) as typeof import("sharp");
  } catch {
    return null;
  }

  const image = sharpFn(buffer)
    .ensureAlpha()
    .resize(scaledWidth, scaledHeight, { fit: "fill" })
    .raw();

  const imageBuffer = await image.toBuffer();
  const hash = rgbaToThumbHash(
    scaledWidth,
    scaledHeight,
    new Uint8ClampedArray(imageBuffer),
  );

  return Buffer.from(hash).toString("base64").replace(/=+$/, "");
};
