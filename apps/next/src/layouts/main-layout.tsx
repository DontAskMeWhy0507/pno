import dynamic from "next/dynamic";

import { Box, useColorModeValue } from "@chakra-ui/react";

import TopLoadingBar from "../common/top-loading-bar";
import { PhotoViewProvider } from "../components/photo-view/provider";

const OnboardingRedirect = dynamic(
  () => import("../common/onboarding-redirect"),
  { ssr: false },
);
const SignupModal = dynamic(() => import("../components/signup-modal"), {
  ssr: false,
});
const CreateClassNotice = dynamic(
  () => import("../components/create-class-notice"),
  {
    ssr: false,
  },
);
const ConfettiLayer = dynamic(() => import("../components/confetti-layer"), {
  ssr: false,
});

const Navbar = dynamic(() =>
  import("../components/navbar").then((mod) => mod.Navbar),
);

export const MainLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const ambientBg = useColorModeValue(
    "linear(to-b, blue.50 0%, rgba(224, 237, 255, 0.45) 55%, transparent 100%)",
    "linear(to-b, rgba(75, 131, 255, 0.14) 0%, rgba(75, 131, 255, 0.04) 55%, transparent 100%)",
  );

  return (
    <Box pos="relative" minH="100dvh">
      {/* Seamless ambient top gradient spanning behind the transparent Navbar */}
      <Box
        pos="absolute"
        top={0}
        left={0}
        right={0}
        h={{ base: "380px", md: "480px" }}
        bgGradient={ambientBg}
        pointerEvents="none"
        zIndex={0}
      />
      <Box pos="relative" zIndex={1}>
        <TopLoadingBar />
        <Box h="20">
          <Navbar />
        </Box>
        <OnboardingRedirect />
        <SignupModal />
        <CreateClassNotice />
        <ConfettiLayer />
        <PhotoViewProvider>{children}</PhotoViewProvider>
      </Box>
    </Box>
  );
};

export const getLayout = (page: React.ReactElement) => (
  <MainLayout>{page}</MainLayout>
);
