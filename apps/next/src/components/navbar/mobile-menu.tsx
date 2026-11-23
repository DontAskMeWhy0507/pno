import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import React from "react";

import { Link } from "@quenti/components";

import {
  Box,
  Button,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
  MenuDivider,
  MenuList,
  Stack,
  useColorModeValue,
} from "@chakra-ui/react";

import {
  IconBooks,
  IconChevronDown,
  IconCloudDownload,
  IconDatabase,
  IconFolder,
  IconFolderPlus,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";

import { menuEventChannel } from "../../events/menu";
import { MenuOption } from "../menu-option";
import { MobileUserOptions } from "./mobile-user-options";

export interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onFolderClick: () => void;
  onClassClick: () => void;
  onImportClick: () => void;
  onAnkiImportClick?: () => void;
}

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

  const isPortal = router.pathname === "/";
  const isIelts = router.pathname.startsWith("/ielts");
  const isQuiz = !isPortal && !isIelts;

  const [ieltsSearch, setIeltsSearch] = React.useState("");

  React.useEffect(() => {
    const syncSearch = (q: string) => setIeltsSearch(q);
    menuEventChannel.on("ieltsSearchChange", syncSearch);
    return () => {
      menuEventChannel.off("ieltsSearchChange", syncSearch);
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

  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <>
      <Box
        position="absolute"
        top="80px"
        left="0"
        w="full"
        h="calc(100vh - 80px)"
        pointerEvents={isOpen ? "auto" : "none"}
        className="backdrop-blur-sm"
        bg="rgba(247, 250, 252, 0.75)"
        _dark={{
          bg: "rgba(23, 25, 35, 0.75)",
        }}
        opacity={isOpen ? 1 : 0}
        transition="opacity ease-in-out 200ms"
        onClick={() => {
          onClose();
        }}
      />
      <Stack
        pos="absolute"
        insetX={0}
        opacity={isOpen ? 1 : 0}
        transition="opacity ease-in-out 200ms"
        pointerEvents={isOpen ? "auto" : "none"}
        className="backdrop-blur-2xl"
        px="6"
        py="6"
        pt="10"
        spacing={8}
      >
        <Stack spacing={4}>
          <Button
            variant="outline"
            colorScheme="gray"
            fontWeight={700}
            fontSize="sm"
            onClick={async () => {
              onClose();
              await router.push("/");
            }}
          >
            PNO Home
          </Button>

          {isQuiz && (
            <Menu
              boundary="scrollParent"
              placement="bottom"
              isOpen={menuOpen}
              onOpen={() => setMenuOpen(true)}
              onClose={() => setMenuOpen(false)}
            >
              <MenuButton>
                <Button
                  w="full"
                  fontWeight={700}
                  fontSize="sm"
                  rightIcon={
                    <IconChevronDown
                      style={{
                        transition: "rotate ease-in-out 200ms",
                        rotate: menuOpen ? "180deg" : "0deg",
                      }}
                    />
                  }
                  as="div"
                >
                  Create
                </Button>
              </MenuButton>
              <MenuList
                overflow="hidden"
                w="calc(100vw - 48px)"
              >
                <MenuOption
                  href="/create"
                  icon={<IconBooks size={20} />}
                  label="Study set"
                  onClick={() => {
                    onClose();
                  }}
                />
                <MenuOption
                  icon={<IconCloudDownload size={20} />}
                  label="Import from Quizlet"
                  onClick={() => {
                    onClose();
                    onImportClick();
                  }}
                />
                {onAnkiImportClick && (
                  <MenuOption
                    icon={<IconCloudDownload size={20} />}
                    label="Import from Anki (.apkg)"
                    onClick={() => {
                      onClose();
                      onAnkiImportClick();
                    }}
                  />
                )}
                <MenuDivider />
                <MenuOption
                  icon={<IconFolder size={20} />}
                  label="Folder"
                  onClick={() => {
                    onClose();
                    onFolderClick();
                  }}
                />
              </MenuList>
            </Menu>
          )}

          {isIelts && (
            <>
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
                  bg={searchBg}
                  borderWidth="2px"
                  borderColor={searchBorder}
                />
              </InputGroup>

              <Menu
                boundary="scrollParent"
                placement="bottom"
                isOpen={menuOpen}
                onOpen={() => setMenuOpen(true)}
                onClose={() => setMenuOpen(false)}
              >
                <MenuButton>
                  <Button
                    w="full"
                    fontWeight={700}
                    fontSize="sm"
                    rightIcon={
                      <IconChevronDown
                        style={{
                          transition: "rotate ease-in-out 200ms",
                          rotate: menuOpen ? "180deg" : "0deg",
                        }}
                      />
                    }
                    as="div"
                  >
                    Create
                  </Button>
                </MenuButton>
                <MenuList
                  overflow="hidden"
                  w="calc(100vw - 48px)"
                >
                  <MenuOption
                    icon={<IconPlus size={20} />}
                    label="Add IELTS Test (4 Skills)"
                    onClick={() => {
                      onClose();
                      menuEventChannel.emit("openIeltsAddTest");
                    }}
                  />
                  <MenuOption
                    icon={<IconDatabase size={20} />}
                    label="Test Bank"
                    onClick={() => {
                      onClose();
                      menuEventChannel.emit("openIeltsTestBank");
                    }}
                  />
                  <MenuDivider />
                  <MenuOption
                    icon={<IconFolderPlus size={20} />}
                    label="New Collection"
                    onClick={() => {
                      onClose();
                      menuEventChannel.emit("openIeltsNewCollection");
                    }}
                  />
                </MenuList>
              </Menu>
            </>
          )}
        </Stack>
        {session?.user ? (
          <MobileUserOptions closeMenu={onClose} />
        ) : (
          <Button
            as={Link}
            href="/auth/login"
            colorScheme="blue"
            fontWeight={700}
            onClick={onClose}
          >
            Sign in
          </Button>
        )}
      </Stack>
    </>
  );
};

export default MobileMenu;
