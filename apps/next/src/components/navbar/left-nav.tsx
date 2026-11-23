import NextLink from "next/link";
import { useRouter } from "next/router";
import React from "react";

import { Link } from "@quenti/components";
import { outfit } from "@quenti/lib/chakra-theme";

import {
  Button,
  Flex,
  HStack,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
  MenuDivider,
  MenuList,
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

import { Logo } from "../../../../../packages/components/logo";
import { menuEventChannel } from "../../events/menu";
import { MenuOption } from "../menu-option";

export interface LeftNavProps {
  onFolderClick: () => void;
  onImportClick: () => void;
  onAnkiImportClick?: () => void;
  onClassClick: () => void;
}

export const LeftNav: React.FC<LeftNavProps> = ({
  onFolderClick,
  onImportClick,
  onAnkiImportClick,
}) => {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [ieltsSearch, setIeltsSearch] = React.useState("");
  const menuBg = useColorModeValue("white", "gray.800");
  const searchBg = useColorModeValue("white", "gray.800");
  const searchBorder = useColorModeValue("gray.200", "gray.700");

  const isPortal = router.pathname === "/";
  const isIelts = router.pathname.startsWith("/ielts");
  const isQuiz = !isPortal && !isIelts;

  React.useEffect(() => {
    const syncSearch = (q: string) => setIeltsSearch(q);
    menuEventChannel.on("ieltsSearchChange", syncSearch);
    return () => {
      menuEventChannel.off("ieltsSearchChange", syncSearch);
    };
  }, []);

  return (
    <HStack as="nav" spacing="4" height="12">
      <Flex
        align="center"
        justify="space-between"
        className="nav-content__mobile"
      >
        <HStack as={Link} href="/" rel="home" ml="2">
          <Logo boxSize="24px" />
          <Heading
            as="p"
            fontSize="2xl"
            color="black"
            _dark={{
              color: "white",
            }}
            className="notranslate"
            fontFamily={outfit.style.fontFamily}
            fontWeight={700}
            lineHeight={1.33}
          >
            PNO
          </Heading>
        </HStack>
      </Flex>

      {/* Context-aware Create button & Search bar */}
      {isQuiz && (
        <HStack display={["none", "none", "flex"]}>
          <Menu
            placement="bottom-start"
            isOpen={menuOpen}
            onOpen={() => setMenuOpen(true)}
            onClose={() => setMenuOpen(false)}
          >
            <MenuButton>
              <Button
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
              bg={menuBg}
              py={0}
              overflow="hidden"
              w="max"
              marginTop={2}
              shadow="lg"
            >
              <NextLink href="/create" passHref>
                <MenuOption icon={<IconBooks size={20} />} label="Study set" />
              </NextLink>
              <MenuOption
                icon={<IconCloudDownload size={20} />}
                label="Import from Quizlet"
                onClick={onImportClick}
              />
              <MenuOption
                icon={<IconCloudDownload size={20} />}
                label="Import from Anki (.apkg)"
                onClick={onAnkiImportClick}
              />
              <MenuDivider />
              <MenuOption
                icon={<IconFolder size={20} />}
                label="Folder"
                onClick={onFolderClick}
              />
            </MenuList>
          </Menu>
        </HStack>
      )}

      {isIelts && (
        <HStack display={["none", "none", "flex"]} spacing="3">
          <Menu
            placement="bottom-start"
            isOpen={menuOpen}
            onOpen={() => setMenuOpen(true)}
            onClose={() => setMenuOpen(false)}
          >
            <MenuButton>
              <Button
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
              bg={menuBg}
              py={0}
              overflow="hidden"
              w="max"
              marginTop={2}
              shadow="lg"
            >
              <MenuOption
                icon={<IconPlus size={20} />}
                label="Add IELTS Test (4 Skills)"
                onClick={() => menuEventChannel.emit("openIeltsAddTest")}
              />
              <MenuOption
                icon={<IconDatabase size={20} />}
                label="Test Bank"
                onClick={() => menuEventChannel.emit("openIeltsTestBank")}
              />
              <MenuDivider />
              <MenuOption
                icon={<IconFolderPlus size={20} />}
                label="New Collection"
                onClick={() => menuEventChannel.emit("openIeltsNewCollection")}
              />
            </MenuList>
          </Menu>

          <InputGroup size="sm" w={{ md: "220px", lg: "260px" }}>
            <InputLeftElement pointerEvents="none" color="gray.400">
              <IconSearch size={15} />
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
              fontWeight={500}
              _focus={{
                borderColor: "blue.400",
                boxShadow: "none",
              }}
            />
          </InputGroup>
        </HStack>
      )}
    </HStack>
  );
};

export default LeftNav;
