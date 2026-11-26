import { withHighlightConfig } from "@highlight-run/next/config";
import { withAxiom } from "next-axiom";
import nextBuildId from "next-build-id";
import { dirname } from "path";
import { fileURLToPath } from "url";

// @ts-check

/*
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 * This is especially useful for Docker builds.
 */
import "@pno/env/client/client.mjs";
import "@pno/env/server/server.mjs";

import fs from "fs";
const pjson = JSON.parse(
  fs.readFileSync(new URL("./package.json", import.meta.url), "utf-8")
);

const shouldAnalyzeBundles = process.env.ANALYZE === "true";
const withBundleAnalyzer = (await import("@next/bundle-analyzer")).default({
  enabled: shouldAnalyzeBundles,
});

const appVersion = pjson.version;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const domains = ["lh3.googleusercontent.com", "images.unsplash.com"];
if (process.env.USERS_BUCKET_URL)
  domains.push(new URL(process.env.USERS_BUCKET_URL).host);
if (process.env.ASSETS_BUCKET_URL)
  domains.push(new URL(process.env.ASSETS_BUCKET_URL).host);
if (process.env.MEDIA_S3_PUBLIC_URL) {
  try {
    domains.push(new URL(process.env.MEDIA_S3_PUBLIC_URL).host);
  } catch {
    // Ignore invalid MEDIA_S3_PUBLIC_URL during local build
  }
}

const getConsoleRewrites = async () => {
  try {
    return (await import("@pno/console/next.mjs")).INTERNAL_REWRITES;
  } catch {
    return [];
  }
};

/** @type {import("next").NextConfig} */
let config = {
  generateBuildId: async () => {
    try {
      return await nextBuildId({ dir: __dirname });
    } catch {
      return process.env.VERCEL_GIT_COMMIT_SHA || `build-${Date.now()}`;
    }
  },
  experimental: {
    optimizePackageImports: [
      "@pno/components",
      "@tabler/icons-react",
      "@chakra-ui/react",
      "lucide-react",
      "framer-motion",
    ],
    instrumentationHook: true,
    // sql.js (used by the Anki extractor) is an Emscripten bundle that
    // crashes the build compiler when webpack tries to bundle it
    // (SIGSEGV, 2026-11-03). Keep it external: the server loads it from
    // node_modules at runtime instead.
    serverComponentsExternalPackages: ["sql.js"],
    outputFileTracingIncludes: {
      "/api/**/*": [
        "../../node_modules/sql.js/dist/sql-wasm.wasm",
        "./node_modules/sql.js/dist/sql-wasm.wasm",
        "../../node_modules/sql.js/dist/sql-wasm-browser.wasm",
        "./node_modules/sql.js/dist/sql-wasm-browser.wasm",
        "../../node_modules/sql.js/dist/sql-wasm-browser.js",
        "./node_modules/sql.js/dist/sql-wasm-browser.js",
      ],
    },
    outputFileTracingExcludes: {
      "*": [
        "./public/audio/**/*",
        "./public/ielts-app/**/*",
        "./public/ielts-data/**/*",
        "./public/courses-data/**/*",
        "./public/tests/**/*",
        "./public/uploads/**/*",
        "public/audio/**/*",
        "public/ielts-app/**/*",
        "public/ielts-data/**/*",
        "public/courses-data/**/*",
        "public/tests/**/*",
        "public/uploads/**/*",
        "../../apps/next/public/audio/**/*",
        "../../apps/next/public/ielts-app/**/*",
        "../../apps/next/public/ielts-data/**/*",
        "../../apps/next/public/courses-data/**/*",
        "../../apps/next/public/tests/**/*",
        "../../apps/next/public/uploads/**/*",
      ],
    },
    // Tommy, I love you so much https://holocron.so/blog/optimizing-next.js-cold-starts-for-vercel
    esmExternals: false,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      if (Array.isArray(config.externals)) {
        config.externals.push("sql.js");
      } else if (config.externals) {
        config.externals = [config.externals, "sql.js"];
      } else {
        config.externals = ["sql.js"];
      }
    }
    return config;
  },
  reactStrictMode: true,
  // Deployment fix (2026-11-01): the fork's existing code has prettier /
  // unused-import lint errors that fail `next build` at the lint step.
  // Lint is skipped during production builds; it still runs in dev / CI via `next lint`.
  eslint: {
    ignoreDuringBuilds: true,
  },
  swcMinify: true,
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },
  images: {
    domains,
    formats: ["image/avif", "image/webp"],
  },
  transpilePackages: [
    "@pno/auth",
    "@pno/core",
    "@pno/cortex",
    "@pno/emails",
    "@pno/env",
    "@pno/images",
    "@pno/interfaces",
    "@pno/lib",
    "@pno/components",
    "@pno/branding",
    "@pno/payments",
    "@pno/enterprise",
    "@pno/prisma",
    "@pno/drizzle",
    "@pno/trpc",
    "@pno/inngest",
    "@pno/integrations",
    "@pno/types",
    "@pno/website",
  ],
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "X-Frame-Options",
          value: "SAMEORIGIN",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), geolocation=(), microphone=(self)",
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ],
    },
    {
      source: "/auth/:path*",
      headers: [
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
      ],
    },
    {
      source: "/audio/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
    {
      source: "/ielts-data/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
    {
      source: "/courses-data/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
    {
      source: "/assets/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
  ],
  redirects: async () => [
    {
      source: "/features",
      destination: "/",
      permanent: false,
    },
    {
      source: "/pricing",
      destination: "/",
      permanent: false,
    },
    {
      source: "/solutions",
      destination: "/",
      permanent: false,
    },
    {
      source: "/organizations",
      destination: "/",
      permanent: false,
    },
    {
      source: "/organizations/:path*",
      destination: "/",
      permanent: false,
    },
    {
      source: "/orgs",
      destination: "/",
      permanent: false,
    },
    {
      source: "/orgs/:path*",
      destination: "/",
      permanent: false,
    },
  ],
  rewrites: async () => [
    ...(await getConsoleRewrites()),
    {
      source: "/ielts/:path*",
      destination: "/ielts",
    },
    {
      source: "/courses/:path*",
      destination: "/courses",
    },
    {
      source: "/:id(_[a-zA-Z0-9]{10})",
      destination: "/share-resolver/:id",
    },
    {
      source: "/:id(j[a-zA-Z0-9]{8})",
      destination: "/class-resolver/:id",
    },
    {
      source: "/:profile(@[a-zA-Z0-9-_]+)",
      destination: "/profile/:profile",
    },
    {
      source: "/:profile(@[a-zA-Z0-9-_]+)/folders/:slug",
      destination: "/profile/:profile/folders/:slug",
    },
    {
      source: "/:profile(@[a-zA-Z0-9-_]+)/folders/:slug/flashcards",
      destination: "/profile/:profile/folders/:slug/flashcards",
    },
    {
      source: "/:profile(@[a-zA-Z0-9-_]+)/folders/:slug/match",
      destination: "/profile/:profile/folders/:slug/match",
    },
    {
      source: "/:profile(@[a-zA-Z0-9-_]+)/folders/:slug/match/leaderboard",
      destination: "/profile/:profile/folders/:slug/match/leaderboard",
    },
    {
      source: "/:id(c[a-z0-9]{20,32})",
      destination: "/sets/:id",
    },
    {
      source: "/:id(c[a-z0-9]{20,32})/edit",
      destination: "/sets/:id/edit",
    },
    {
      source: "/:id(c[a-z0-9]{20,32})/create",
      destination: "/sets/:id/create",
    },
    {
      source: "/:id(c[a-z0-9]{20,32})/collab",
      destination: "/sets/:id/collab",
    },
    {
      source: "/:id(c[a-z0-9]{20,32})/flashcards",
      destination: "/sets/:id/flashcards",
    },
    {
      source: "/:id(c[a-z0-9]{20,32})/learn",
      destination: "/sets/:id/learn",
    },
    {
      source: "/:id(c[a-z0-9]{20,32})/match",
      destination: "/sets/:id/match",
    },
    {
      source: "/:id(c[a-z0-9]{20,32})/match/leaderboard",
      destination: "/sets/:id/match/leaderboard",
    },
    {
      source: "/:id(c[a-z0-9]{20,32})/test",
      destination: "/sets/:id/test",
    },
    {
      source: "/:id(c[a-z0-9]{20,32})/anki",
      destination: "/sets/:id/anki",
    },
    {
      source: "/:id(c[a-z0-9]{20,32})/blocks",
      destination: "/sets/:id/blocks",
    },
    {
      source: "/:id(c[a-z0-9]{20,32})/crossword",
      destination: "/sets/:id/crossword",
    },
    {
      source: "/:id(c[a-z0-9]{20,32})/gravity",
      destination: "/sets/:id/gravity",
    },
    {
      source: "/a/:id/:assignmentId",
      destination: "/classes/:id/assignments/:assignmentId",
    },
    {
      source: "/a/:id/:assignmentId/:path*",
      destination: "/classes/:id/assignments/:assignmentId/:path*",
    },
  ],
  productionBrowserSourceMaps: false,
};

config = withAxiom(config);
if (process.env.NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID) {
  config = withHighlightConfig(config, {
    appVersion,
  });
}
if (shouldAnalyzeBundles) {
  config = withBundleAnalyzer(config);
}

export default config;
