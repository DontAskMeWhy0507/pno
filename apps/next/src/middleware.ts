import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PREFIXES = [
  "/auth",
  "/unauthorized",
  "/privacy",
  "/privacy-policy",
  "/terms",
  "/api",
  "/_next",
  "/audio",
  "/ielts-data",
  "/courses-data",
  "/assets",
  "/avatars",
];

const PUBLIC_EXACT_FILES = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/site.webmanifest",
  "/browserconfig.xml",
  "/apple-touch-icon.png",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/mstile-150x150.png",
  "/safari-pinned-tab.svg",
  "/logo-large.png",
  "/og-image.png",
  "/og-background.png",
  "/og-line.png",
]);

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (
    PUBLIC_EXACT_FILES.has(pathname) ||
    PUBLIC_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return NextResponse.next();
  }

  const hasSessionCookie = Boolean(
    req.cookies.get("next-auth.session-token")?.value ||
      req.cookies.get("__Secure-next-auth.session-token")?.value,
  );

  if (!hasSessionCookie) {
    const loginUrl = new URL("/auth/login", req.url);
    const callbackUrl = `${pathname}${search}`;
    if (callbackUrl && callbackUrl !== "/auth/login") {
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|site.webmanifest|browserconfig.xml|audio/|ielts-data/|courses-data/|assets/|avatars/|.*\\.(?:png|jpg|jpeg|webp|gif|svg|ico|mp3|mp4|wav|woff2)$).*)",
  ],
};
