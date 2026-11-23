import { useSession } from "next-auth/react";
import React from "react";

import { Link } from "@quenti/components";
import { avatarUrl } from "@quenti/lib/avatar";

import {
  Avatar,
  AvatarBadge,
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Kbd,
  Text,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";

import { IconMenu, IconSearch, IconX } from "@tabler/icons-react";

import { menuEventChannel } from "../events/menu";
import { MOD } from "../lib/tinykeys";
import LeftNav from "./navbar/left-nav";
import MobileMenu from "./navbar/mobile-menu";
import UserMenu from "./navbar/user-menu";

export const Navbar: React.FC = () => {
  const { data: session, status } = useSession();
  const { isOpen: isMobileMenuOpen, onToggle: onMobileMenuToggle } =
    useDisclosure();
  const user = session?.user;

  const cmdBg = useColorModeValue(
    "rgba(255, 255, 255, 0.72)",
    "rgba(26, 32, 44, 0.65)",
  );
  const cmdHoverBg = useColorModeValue(
    "rgba(255, 255, 255, 0.95)",
    "rgba(45, 55, 72, 0.85)",
  );
  const cmdBorder = useColorModeValue("gray.200", "gray.700");

  const openCreateFolder = () => menuEventChannel.emit("createFolder");
  const openImportQuizlet = () =>
    menuEventChannel.emit("openImportDialog", false);
  const openImportAnki = () => menuEventChannel.emit("openAnkiImportDialog");
  const openCreateClass = () => menuEventChannel.emit("createClass");

  return (
    <Flex pos="relative" zIndex={1000} w="full" h="20">
      <HStack
        as="header"
        aria-label="Main navigation"
        w="full"
        mx="auto"
        px={{ base: "6", md: "8" }}
        py="4"
        justify="space-between"
      >
        <LeftNav
          onFolderClick={openCreateFolder}
          onImportClick={openImportQuizlet}
          onAnkiImportClick={openImportAnki}
          onClassClick={openCreateClass}
        />
        <Box display={["block", "block", "none"]}>
          <HStack spacing={2}>
            {user && (
              <IconButton
                aria-label="Open command menu"
                icon={<IconSearch size={18} />}
                size="sm"
                variant="ghost"
                rounded="xl"
                onClick={() => menuEventChannel.emit("openCommandMenu")}
              />
            )}
            {user && (
              <Avatar
                src={avatarUrl({
                  ...user,
                  image: user.image!,
                })}
                size="sm"
                className="highlight-block"
              >
                <AvatarBadge boxSize="1em" bg="green.500" />
              </Avatar>
            )}
            <IconButton
              aria-label={"Open menu"}
              icon={
                isMobileMenuOpen ? (
                  <IconX size={20} />
                ) : (
                  <IconMenu size={20} />
                )
              }
              variant="ghost"
              colorScheme="gray"
              onClick={onMobileMenuToggle}
            />
          </HStack>
          <MobileMenu
            isOpen={isMobileMenuOpen}
            onClose={onMobileMenuToggle}
            onFolderClick={openCreateFolder}
            onClassClick={openCreateClass}
            onImportClick={openImportQuizlet}
            onAnkiImportClick={openImportAnki}
          />
        </Box>
        <HStack
          as="nav"
          display={["none", "none", "flex"]}
          height="12"
          spacing={4}
        >
          {session?.user && (
            <Button
              size="sm"
              variant="outline"
              colorScheme="gray"
              rounded="xl"
              px={3}
              h="36px"
              bg={cmdBg}
              borderWidth="2px"
              borderColor={cmdBorder}
              backdropFilter="blur(12px)"
              _hover={{
                bg: cmdHoverBg,
                borderColor: "blue.400",
              }}
              transition="all 150ms ease"
              onClick={() => menuEventChannel.emit("openCommandMenu")}
              leftIcon={<IconSearch size={15} />}
            >
              <HStack spacing={2.5}>
                <Text fontSize="xs" fontWeight={600} color="gray.500">
                  Search...
                </Text>
                <Text fontSize="xs" fontWeight={700}>
                  <Kbd>{MOD == "Control" ? "Ctrl" : "⌘"}</Kbd> +{" "}
                  <Kbd>K</Kbd>
                </Text>
              </HStack>
            </Button>
          )}
          {session?.user ? (
            <UserMenu />
          ) : status !== "loading" ? (
            <Button
              as={Link}
              href="/auth/login"
              size="sm"
              colorScheme="blue"
              fontWeight={700}
            >
              Sign in
            </Button>
          ) : null}
        </HStack>
      </HStack>
    </Flex>
  );
};

export default Navbar;
