import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import React from "react";

import { Link } from "@pno/components";
import { outfit } from "@pno/lib/chakra-theme";

import {
  Box,
  Button,
  Divider,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  SimpleGrid,
  Stack,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";

import {
  IconBooks,
  IconBrain,
  IconCloudDownload,
  IconDatabase,
  IconFolder,
  IconFolderPlus,
  IconHome,
  IconPlus,
  IconSchool,
  IconSearch,
} from "@tabler/icons-react";

import { menuEventChannel } from "../../events/menu";
import { MobileUserOptions } from "./mobile-user-options";

export interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onFolderClick: () => void;
  onClassClick: () => void;
  onImportClick: () => void;
  onAnkiImportClick?: () => void;
}

interface MobileActionRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

const MobileActionRow: React.FC<MobileActionRowProps> = ({
  icon,
  title,
  description,
  onClick,
}) => {
  const rowBg = useColorModeValue(
    "rgba(255, 255, 255, 0.72)",
    "rgba(45, 55, 72, 0.55)",
  );
  const borderColor = useColorModeValue("gray.200", "gray.750");
  const subColor = useColorModeValue("gray.600", "gray.400");
  const iconColor = useColorModeValue("blue.500", "blue.300");

  return (
    <Box
      as="button"
      type="button"
      w="full"
      textAlign="left"
      onClick={onClick}
      bg={rowBg}
      borderWidth="1.5px"
      borderColor={borderColor}
      rounded="xl"
      px={3.5}
      py={3}
      transition="all 150ms ease"
      _active={{ transform: "scale(0.99)" }}
    >
      <HStack spacing={3} align="center">
        <Box color={iconColor} flexShrink={0}>
          {icon}
        </Box>
        <Stack spacing={0} minW={0} flex="1">
          <Text
            fontFamily={outfit.style.fontFamily}
            fontWeight={700}
            fontSize="sm"
            noOfLines={1}
          >
            {title}
          </Text>
          <Text fontSize="xs" color={subColor} noOfLines={1}>
            {description}
          </Text>
        </Stack>
      </HStack>
    </Box>
  );
};

export const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  onFolderClick,
  onImportClick,
  onAnkiImportClick,
}) => {
  const router = useRouter();
  React.useEffect(() => {
    if (isOpen) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname]);

  const { data: session } = useSession()!;
  const searchBg = useColorModeValue("white", "gray.800");
  const searchBorder = useColorModeValue("gray.200", "gray.700");
  const drawerBg = useColorModeValue(
    "rgba(247, 250, 252, 0.94)",
    "rgba(23, 25, 35, 0.94)",
  );
  const sectionLabelColor = useColorModeValue("gray.500", "gray.400");

  const isPortal = router.pathname === "/";
  const isIelts = router.pathname.startsWith("/ielts");
  const isCourses = router.pathname.startsWith("/courses");
  const isQuiz = !isPortal && !isIelts && !isCourses;

  const [ieltsSearch, setIeltsSearch] = React.useState("");
  const [coursesSearch, setCoursesSearch] = React.useState("");

  React.useEffect(() => {
    const syncSearch = (q: string) => setIeltsSearch(q);
    const syncCoursesSearch = (q: string) => setCoursesSearch(q);
    menuEventChannel.on("ieltsSearchChange", syncSearch);
    menuEventChannel.on("coursesSearchChange", syncCoursesSearch);
    return () => {
      menuEventChannel.off("ieltsSearchChange", syncSearch);
      menuEventChannel.off("coursesSearchChange", syncCoursesSearch);
    };
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <Box
      position="fixed"
      top="80px"
      insetX={0}
      bottom={0}
      zIndex={999}
      pointerEvents={isOpen ? "auto" : "none"}
      opacity={isOpen ? 1 : 0}
      transition="opacity ease-in-out 200ms"
      bg={drawerBg}
      backdropFilter="blur(20px)"
      overflowY="auto"
      px={5}
      pt={4}
      pb="max(24px, env(safe-area-inset-bottom))"
    >
      <Stack spacing={6} maxW="lg" mx="auto">
        {/* Workspace Switcher */}
        <Stack spacing={2}>
          <Text
            fontSize="2xs"
            fontWeight={800}
            textTransform="uppercase"
            letterSpacing="wider"
            color={sectionLabelColor}
          >
            Workspace
          </Text>
          <SimpleGrid columns={2} spacing={2}>
            <Button
              size="sm"
              h="40px"
              rounded="xl"
              variant={isPortal ? "solid" : "outline"}
              colorScheme={isPortal ? "blue" : "gray"}
              leftIcon={<IconHome size={16} />}
              onClick={async () => {
                onClose();
                await router.push("/");
              }}
            >
              Portal
            </Button>
            <Button
              size="sm"
              h="40px"
              rounded="xl"
              variant={isQuiz ? "solid" : "outline"}
              colorScheme={isQuiz ? "blue" : "gray"}
              leftIcon={<IconBooks size={16} />}
              onClick={async () => {
                onClose();
                await router.push("/home");
              }}
            >
              Quiz
            </Button>
            <Button
              size="sm"
              h="40px"
              rounded="xl"
              variant={isIelts ? "solid" : "outline"}
              colorScheme={isIelts ? "blue" : "gray"}
              leftIcon={<IconSchool size={16} />}
              onClick={async () => {
                onClose();
                await router.push("/ielts");
              }}
            >
              IELTS
            </Button>
            <Button
              size="sm"
              h="40px"
              rounded="xl"
              variant={isCourses ? "solid" : "outline"}
              colorScheme={isCourses ? "teal" : "gray"}
              leftIcon={<IconDatabase size={16} />}
              onClick={async () => {
                onClose();
                await router.push("/courses");
              }}
            >
              Courses
            </Button>
          </SimpleGrid>
        </Stack>

        {/* Quick Search / IELTS & Courses Filter */}
        {isIelts && (
          <InputGroup size="md">
            <InputLeftElement pointerEvents="none" color="gray.400">
              <IconSearch size={16} />
            </InputLeftElement>
            <Input
              value={ieltsSearch}
              onChange={(e) => {
                setIeltsSearch(e.target.value);
                menuEventChannel.emit("ieltsSearchChange", e.target.value);
              }}
              placeholder="Search IELTS tests..."
              rounded="xl"
              fontSize="md"
              bg={searchBg}
              borderWidth="2px"
              borderColor={searchBorder}
            />
          </InputGroup>
        )}

        {isCourses && (
          <InputGroup size="md">
            <InputLeftElement pointerEvents="none" color="gray.400">
              <IconSearch size={16} />
            </InputLeftElement>
            <Input
              value={coursesSearch}
              onChange={(e) => {
                setCoursesSearch(e.target.value);
                menuEventChannel.emit("coursesSearchChange", e.target.value);
              }}
              placeholder="Search Data Courses..."
              rounded="xl"
              fontSize="md"
              bg={searchBg}
              borderWidth="2px"
              borderColor={searchBorder}
            />
          </InputGroup>
        )}

        {/* Workspace Actions */}
        {isQuiz && (
          <Stack spacing={2}>
            <Text
              fontSize="2xs"
              fontWeight={800}
              textTransform="uppercase"
              letterSpacing="wider"
              color={sectionLabelColor}
            >
              Create &amp; Import
            </Text>
            <Stack spacing={2}>
              <MobileActionRow
                icon={<IconBooks size={20} />}
                title="Study Set"
                description="Create a new vocabulary study set"
                onClick={async () => {
                  onClose();
                  await router.push("/create");
                }}
              />
              <MobileActionRow
                icon={<IconBrain size={20} />}
                title="Anki Deck (SRS)"
                description="Custom Fields & HTML/CSS Template"
                onClick={() => {
                  onClose();
                  menuEventChannel.emit("openCreateAnkiDeck");
                }}
              />
              <MobileActionRow
                icon={<IconCloudDownload size={20} />}
                title="Import from Quizlet"
                description="Paste & import terms from Quizlet"
                onClick={() => {
                  onClose();
                  onImportClick();
                }}
              />
              {onAnkiImportClick && (
                <MobileActionRow
                  icon={<IconCloudDownload size={20} />}
                  title="Import from Anki (.apkg)"
                  description="Import cards, audio & images from .apkg"
                  onClick={() => {
                    onClose();
                    onAnkiImportClick();
                  }}
                />
              )}
              <MobileActionRow
                icon={<IconFolder size={20} />}
                title="Folder"
                description="Organize study sets into a folder"
                onClick={() => {
                  onClose();
                  onFolderClick();
                }}
              />
            </Stack>
          </Stack>
        )}

        {isIelts && (
          <Stack spacing={2}>
            <Text
              fontSize="2xs"
              fontWeight={800}
              textTransform="uppercase"
              letterSpacing="wider"
              color={sectionLabelColor}
            >
              IELTS Actions
            </Text>
            <Stack spacing={2}>
              <MobileActionRow
                icon={<IconPlus size={20} />}
                title="Add IELTS Test (4 Skills)"
                description="Create or import Reading, Listening, Writing & Speaking"
                onClick={() => {
                  onClose();
                  menuEventChannel.emit("openIeltsAddTest");
                }}
              />
              <MobileActionRow
                icon={<IconDatabase size={20} />}
                title="Test Bank"
                description="Manage & edit IELTS tests"
                onClick={() => {
                  onClose();
                  menuEventChannel.emit("openIeltsTestBank");
                }}
              />
              <MobileActionRow
                icon={<IconFolderPlus size={20} />}
                title="New Collection"
                description="Group IELTS tests into a collection"
                onClick={() => {
                  onClose();
                  menuEventChannel.emit("openIeltsNewCollection");
                }}
              />
            </Stack>
          </Stack>
        )}

        <Divider />

        {session?.user ? (
          <MobileUserOptions closeMenu={onClose} />
        ) : (
          <Button
            as={Link}
            href="/auth/login"
            colorScheme="blue"
            fontWeight={700}
            h="46px"
            rounded="xl"
            onClick={onClose}
          >
            Sign in
          </Button>
        )}
      </Stack>
    </Box>
  );
};

export default MobileMenu;
