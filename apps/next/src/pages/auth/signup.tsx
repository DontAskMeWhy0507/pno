import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";

import { getServerAuthSession } from "@quenti/auth";
import { isMagicLinkConfigured } from "@quenti/auth/allowlist";

import { PageWrapper } from "../../common/page-wrapper";
import { AuthLayout } from "../../components/auth-layout";
import { getSafeRedirectUrl } from "../../lib/urls";

interface SignupProps {
  magicLinkEnabled: boolean;
}

export default function Signup({ magicLinkEnabled }: SignupProps) {
  const router = useRouter();

  return (
    <AuthLayout
      mode="signup"
      magicLinkEnabled={magicLinkEnabled}
      onUserExists={(callbackUrl) => {
        void router.replace(callbackUrl);
      }}
    />
  );
}

export const getServerSideProps: GetServerSideProps<SignupProps> = async (
  ctx,
) => {
  const session = await getServerAuthSession(ctx);
  if (session?.user) {
    const rawCallback =
      typeof ctx.query.callbackUrl === "string" ? ctx.query.callbackUrl : "/";
    return {
      redirect: {
        destination: getSafeRedirectUrl(rawCallback),
        permanent: false,
      },
    };
  }

  return {
    props: {
      magicLinkEnabled:
        isMagicLinkConfigured() || process.env.NODE_ENV === "development",
    },
  };
};

Signup.PageWrapper = PageWrapper;
