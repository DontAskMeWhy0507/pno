import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import React from "react";

export const useUnauthedRedirect = () => {
  const { status } = useSession();
  const router = useRouter();

  React.useEffect(() => {
    if (status === "unauthenticated") {
      const callbackUrl = encodeURIComponent(router.asPath || "/");
      void router.replace(`/auth/login?callbackUrl=${callbackUrl}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
};
