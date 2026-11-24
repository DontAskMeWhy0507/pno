import { signOut, useSession } from "next-auth/react";
import React from "react";

import { avatarUrl } from "@quenti/lib/avatar";
import { outfit } from "@quenti/lib/chakra-theme";

import {
  Avatar,
  AvatarBadge,
  HStack,
  Menu,
  MenuButton,
  Stack,
  Text,
  Wrap,
  WrapItem,
  useColorMode,
  useColorModeValue,
} from "@chakra-ui/react";

import {
  IconChevronDown,
  IconLogout,
  IconMoon,
  IconSettings,
  IconSun,
  IconUser,
} from "@tabler/icons-react";

import {
  CommandDropdownDivider,
  CommandDropdownItem,
  CommandDropdownList,
} from "../command-dropdown";

export const UserMenu = () => {
  const session = useSession()!.data!;
  const user = session.user!;

  const color = useColorModeValue("black", "white");
  const emailColor = useColorModeValue("gray.500", "gray.400");

  const { colorMode, toggleColorMode } = useColorMode();
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <Menu
      placement="bottom-end"
      isOpen={menuOpen}
      onOpen={() => setMenuOpen(true)}
      onClose={() => setMenuOpen(false)}
    >
      <MenuButton>
        <Wrap spacing={3} align="center" overflow="visible" color={color}>
          <WrapItem>
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
          </WrapItem>
          <WrapItem>
            <Text fontWeight={700} className="highlight-block">
              {user.username}
            </Text>
          </WrapItem>
          <WrapItem>
            <IconChevronDown
              style={{
                transition: "rotate ease-in-out 200ms",
                rotate: menuOpen ? "180deg" : "0deg",
              }}
            />
          </WrapItem>
        </Wrap>
      </MenuButton>
      <CommandDropdownList
        minW="300px"
        header={
          <HStack spacing={3}>
            <Avatar
              src={avatarUrl({
                ...user,
                image: user.image!,
              })}
              size="sm"
              className="highlight-block"
            />
            <Stack spacing={0} minW={0}>
              <Text
                fontFamily={outfit.style.fontFamily}
                fontWeight={700}
                fontSize="sm"
                noOfLines={1}
                className="highlight-block"
              >
                {user.username}
              </Text>
              {user.email && (
                <Text
                  fontSize="xs"
                  color={emailColor}
                  noOfLines={1}
                  className="highlight-block"
                >
                  {user.email}
                </Text>
              )}
            </Stack>
          </HStack>
        }
      >
        <CommandDropdownItem
          href={`/@${user.username}`}
          icon={<IconUser size={20} />}
          label="Profile"
          description="View your profile & study sets"
        />
        <CommandDropdownItem
          href="/settings"
          icon={<IconSettings size={20} />}
          label="Settings"
          description="Manage account & workspace preferences"
        />
        <CommandDropdownDivider />
        <CommandDropdownItem
          icon={
            colorMode == "dark" ? <IconSun size={20} /> : <IconMoon size={20} />
          }
          label={colorMode == "dark" ? "Light mode" : "Dark mode"}
          description="Switch between light and dark theme"
          onClick={toggleColorMode}
        />
        <CommandDropdownDivider />
        <CommandDropdownItem
          isDanger
          icon={<IconLogout size={20} />}
          label="Sign out"
          description="Sign out of your PNO account"
          onClick={() => void signOut({ callbackUrl: "/auth/login" })}
        />
      </CommandDropdownList>
    </Menu>
  );
};

export default UserMenu;
