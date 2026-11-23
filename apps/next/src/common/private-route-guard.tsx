import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import React from "react";

const PUBLIC_ROUTE_PREFIXES = [
  "/auth",
  "/unauthorized",
  "/privacy",
  "/privacy-policy",
  "/terms",
  "/404",
  "/500",
];

export const PrivateRouteGuard: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const router = useRouter();
  const { status } = useSession();

  const isPublicRoute = PUBLIC_ROUTE_PREFIXES.some(
    (prefix) =>
      router.pathname === prefix || router.pathname.startsWith(`${prefix}/`),
  );

  React.useEffect(() => {
    if (!isPublicRoute && status === "unauthenticated") {
      const callbackUrl = encodeURIComponent(router.asPath || "/");
      void router.replace(`/auth/login?callbackUrl=${callbackUrl}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublicRoute, status]);

  return <>{children}</>;
};
