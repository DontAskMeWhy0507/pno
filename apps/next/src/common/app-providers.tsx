import type { Session } from "next-auth";
import type { AppProps as NextAppProps } from "next/app";
import dynamic from "next/dynamic";
import Head from "next/head";

import { env } from "@quenti/env/client";
import { theme } from "@quenti/lib/chakra-theme";

import { ChakraProvider } from "@chakra-ui/provider";

import { ErrorBoundary } from "../components/error-boundary";
import { TELEMETRY_ENABLED } from "../lib/telemetry";
import { PrivateRouteGuard } from "./private-route-guard";
import { ToastWrapper } from "./toast-wrapper";

const HIGHLIGHT_ENABLED = Boolean(env.NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID);

const HighlightInit = dynamic(
  () => import("@highlight-run/next/client").then((mod) => mod.HighlightInit),
  { ssr: false },
);
const SessionListener = dynamic(
  () => import("./session-listener").then((mod) => mod.SessionListener),
  { ssr: false },
);
const EventListeners = dynamic(
  () => import("../lib/telemetry").then((mod) => mod.EventListeners),
  {
    ssr: false,
  },
);
const GlobalShortcutLayer = dynamic(
  () => import("../components/global-shortcut-layer"),
  {
    ssr: false,
  },
);

const TelemetryProvider = dynamic(() =>
  import("../lib/telemetry").then((mod) => mod.TelemetryProvider),
);
const SessionProvider = dynamic(() =>
  import("next-auth/react").then((mod) => mod.SessionProvider),
);

export type AppProps = Omit<
  NextAppProps<{ session: Session } & Record<string, unknown>>,
  "Component"
> & {
  Component: NextAppProps["Component"] & {
    getLayout?: (
      page: React.ReactElement,
      router: NextAppProps["router"],
    ) => React.ReactNode;
    PageWrapper?: (props: AppProps) => JSX.Element;
  };
};

type AppPropsWithChildren = AppProps & { children: React.ReactNode };

export const AppProviders = (props: AppPropsWithChildren) => {
  return (
    <ChakraProvider theme={theme}>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </Head>
      <ToastWrapper>
        <ErrorBoundary>
          <TelemetryProvider>
            {HIGHLIGHT_ENABLED && (
              <HighlightInit
                manualStart
                excludedHostnames={["localhost"]}
                projectId={env.NEXT_PUBLIC_HIGHLIGHT_PROJECT_ID}
                tracingOrigins
                networkRecording={{
                  enabled: true,
                  recordHeadersAndBody: true,
                }}
                environment={env.NEXT_PUBLIC_DEPLOYMENT}
              />
            )}
            <SessionProvider
              session={props.pageProps.session ?? undefined}
              refetchOnWindowFocus={false}
            >
              {HIGHLIGHT_ENABLED && <SessionListener />}
              {TELEMETRY_ENABLED && <EventListeners />}
              <GlobalShortcutLayer />
              <PrivateRouteGuard>{props.children}</PrivateRouteGuard>
            </SessionProvider>
          </TelemetryProvider>
        </ErrorBoundary>
      </ToastWrapper>
    </ChakraProvider>
  );
};
