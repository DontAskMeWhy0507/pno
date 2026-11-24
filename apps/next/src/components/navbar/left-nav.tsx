import { useRouter } from "next/router";
import React from "react";

import { Link } from "@pno/components";
import { outfit } from "@pno/lib/chakra-theme";

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
  useColorModeValue,
} from "@chakra-ui/react";

import {
  IconAdjustmentsHorizontal,
  IconBooks,
  IconBrain,
  IconChevronDown,
  IconCloudDownload,
  IconFolder,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";

import { Logo } from "../../../../../packages/components/logo";
import { menuEventChannel } from "../../events/menu";
import {
  CommandDropdownDivider,
  CommandDropdownItem,
  CommandDropdownList,
} from "../command-dropdown";

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
            <CommandDropdownList minW="310px">
              <CommandDropdownItem
                href="/create"
                icon={<IconBooks size={20} />}
                label="Study Set"
                description="Create a new vocabulary study set"
              />
              <CommandDropdownItem
                icon={<IconBrain size={20} />}
                label="Anki Deck"
                description="Custom SRS deck with Fields & HTML Template"
                onClick={() => menuEventChannel.emit("openCreateAnkiDeck")}
              />
              <CommandDropdownItem
                icon={<IconCloudDownload size={20} />}
                label="Import from Quizlet"
                description="Paste & import terms from Quizlet"
                onClick={onImportClick}
              />
              <CommandDropdownItem
                icon={<IconCloudDownload size={20} />}
                label="Import from Anki (.apkg)"
                description="Import flashcards & audio from .apkg"
                onClick={onAnkiImportClick}
              />
              <CommandDropdownDivider />
              <CommandDropdownItem
                icon={<IconFolder size={20} />}
                label="Folder"
                description="Organize study sets into a folder"
                onClick={onFolderClick}
              />
            </CommandDropdownList>
          </Menu>
        </HStack>
      )}

      {isIelts && (
        <HStack display={["none", "none", "flex"]} spacing="3">
          <Button
            fontWeight={700}
            fontSize="sm"
            leftIcon={<IconAdjustmentsHorizontal size={17} />}
            onClick={() => menuEventChannel.emit("openIeltsManage")}
          >
            Manage
          </Button>

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
