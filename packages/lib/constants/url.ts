import { env } from "@pno/env/client";

export const WEBSITE_URL = env.NEXT_PUBLIC_WEBSITE_URL || "https://pno-app.vercel.app";
export const APP_URL = env.NEXT_PUBLIC_APP_URL;
