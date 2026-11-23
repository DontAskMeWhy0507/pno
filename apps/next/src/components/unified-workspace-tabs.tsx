import { useRouter } from "next/router";
import React from "react";

import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";

import { IconCards, IconSchool } from "@tabler/icons-react";

export type WorkspaceTab = "quiz" | "ielts";

export const UnifiedWorkspaceTabs: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const router = useRouter();
  const isIeltsRoute = router.pathname === "/ielts";

  const [activeTab, setActiveTab] = React.useState<WorkspaceTab>(
    isIeltsRoute ? "ielts" : "quiz",
  );
  const [ieltsMounted, setIeltsMounted] = React.useState<boolean>(isIeltsRoute);

  React.useEffect(() => {
    if (router.pathname === "/ielts" || router.query.tab === "ielts") {
      setActiveTab("ielts");
      setIeltsMounted(true);
    }
  }, [router.pathname, router.query.tab]);

  const handleSelectTab = (tab: WorkspaceTab) => {
    if (tab === "ielts") {
      setIeltsMounted(true);
      setActiveTab("ielts");
    } else {
      setActiveTab("quiz");
      if (router.pathname === "/ielts") {
        void router.push("/home");
      }
    }
  };

  const barBg = useColorModeValue("gray.900", "gray.900");
  const pillContainerBg = useColorModeValue("whiteAlpha.200", "whiteAlpha.200");

  return (
    <Flex direction="column" minH="100vh" w="full">
      {/* Global 2-Tab Mode Switcher Bar: Quiz vs Thi IELTS */}
      <Flex
        as="nav"
        aria-label="Workspace mode switcher"
        h="40px"
        px={{ base: 3, md: 6 }}
        bg={barBg}
        color="white"
        align="center"
        justify="space-between"
        borderBottomWidth="1px"
        borderColor="whiteAlpha.200"
        zIndex={1500}
        flexShrink={0}
        userSelect="none"
      >
        <HStack spacing={2}>
          <Text
            fontSize="xs"
            fontWeight={800}
            letterSpacing="wider"
            textTransform="uppercase"
            color="gray.300"
            display={{ base: "none", sm: "inline" }}
          >
            Study Hub
          </Text>
        </HStack>

        <HStack
          spacing={1}
          bg={pillContainerBg}
          p="3px"
          rounded="lg"
          borderWidth="1px"
          borderColor="whiteAlpha.200"
        >
          <Button
            size="xs"
            height="28px"
            px={3.5}
            rounded="md"
            fontWeight={700}
            leftIcon={<IconCards size={15} />}
            bg={activeTab === "quiz" ? "blue.500" : "transparent"}
            color={activeTab === "quiz" ? "white" : "gray.300"}
            _hover={{
              bg: activeTab === "quiz" ? "blue.600" : "whiteAlpha.200",
              color: "white",
            }}
            onClick={() => handleSelectTab("quiz")}
          >
            Quiz
          </Button>
          <Button
            size="xs"
            height="28px"
            px={3.5}
            rounded="md"
            fontWeight={700}
            leftIcon={<IconSchool size={15} />}
            bg={activeTab === "ielts" ? "red.500" : "transparent"}
            color={activeTab === "ielts" ? "white" : "gray.300"}
            _hover={{
              bg: activeTab === "ielts" ? "red.600" : "whiteAlpha.200",
              color: "white",
            }}
            onClick={() => handleSelectTab("ielts")}
          >
            Thi IELTS
            <Badge
              ml={1.5}
              fontSize="9px"
              px={1}
              py={0}
              rounded="sm"
              bg={activeTab === "ielts" ? "whiteAlpha.300" : "red.600"}
              color="white"
            >
              4 Skills
            </Badge>
          </Button>
        </HStack>

        <Box w={{ base: "0px", sm: "70px" }} />
      </Flex>

      {/* Tab 1: Quenti Quiz & Flashcards Workspace (kept mounted so state is preserved) */}
      <Box
        flex="1"
        w="full"
        display={activeTab === "quiz" ? "block" : "none"}
      >
        {children}
      </Box>

      {/* Tab 2: IELTS Practice PRO Workspace (kept mounted once opened so timer/audio/draft state is preserved) */}
      {ieltsMounted && (
        <Box
          flex="1"
          w="full"
          h="calc(100vh - 40px)"
          display={activeTab === "ielts" ? "block" : "none"}
          overflow="hidden"
        >
          <iframe
            src="/ielts-app/index.html"
            title="Thi IELTS - 4 Skills Practice Environment"
            style={{
              width: "100%",
              height: "calc(100vh - 40px)",
              border: "none",
              display: "block",
            }}
            allow="microphone; autoplay; clipboard-read; clipboard-write; fullscreen"
          />
        </Box>
      )}
    </Flex>
  );
};

export default UnifiedWorkspaceTabs;
