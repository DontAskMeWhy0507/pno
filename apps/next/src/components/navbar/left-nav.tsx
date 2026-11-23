import NextLink from "next/link";
import React from "react";

import { Link } from "@quenti/components";
import { outfit } from "@quenti/lib/chakra-theme";

import {
  Button,
  Flex,
  HStack,
  Heading,
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
  IconFolder,
  IconSchool,
} from "@tabler/icons-react";

import { Logo } from "../../../../../packages/components/logo";
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
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuBg = useColorModeValue("white", "gray.800");

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
      <HStack display={["none", "none", "flex"]} spacing="1">
        <Button
          as={Link}
          href="/home"
          variant="ghost"
          colorScheme="gray"
          fontWeight={700}
          fontSize="sm"
        >
          Quiz
        </Button>
        <Button
          as={Link}
          href="/ielts"
          variant="ghost"
          colorScheme="gray"
          fontWeight={700}
          fontSize="sm"
          leftIcon={<IconSchool size={17} />}
        >
          Thi IELTS
        </Button>
      </HStack>
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
    </HStack>
  );
};

export default LeftNav;
