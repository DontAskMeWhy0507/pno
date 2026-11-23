import { JitsuContext, JitsuProvider } from "@jitsu/jitsu-react";
import { emptyAnalytics } from "@jitsu/js";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import React from "react";

import { env } from "@quenti/env/client";

export const JitsuTelemetryProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <JitsuProvider
      options={{
        host: env.NEXT_PUBLIC_TELEMETRY_HOST || "",
        writeKey: env.NEXT_PUBLIC_TELEMETRY_KEY,
        disabled: false,
      }}
    >
      {children}
    </JitsuProvider>
  );
};

export const useJitsuClient = () => {
  const instance = React.useContext(JitsuContext);
  if (instance?.analytics) return instance;
  return { analytics: emptyAnalytics };
};

export const JitsuEventListeners = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const { analytics } = useJitsuClient();

  React.useEffect(() => {
    void analytics.page({
      pathname: router.pathname,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.asPath]);

  React.useEffect(() => {
    if (!session?.user) return;
    void analytics.identify(session.user.id, {
      name: session.user.name,
      username: session.user.username,
      email: session.user.email!,
      flags: session.user.flags,
      organizationId: session.user.organizationId,
      banned: session.user.banned,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user]);

  return null;
};
