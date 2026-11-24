// eslint-disable-next-line no-restricted-imports
import React from "react";

import { Link } from "@pno/components";

import {
  Box,
  MenuItem,
  type MenuItemProps,
  Text,
  forwardRef,
  useColorModeValue,
} from "@chakra-ui/react";

import type { TablerIconsProps } from "@tabler/icons-react";

export interface MenuOptionProps {
  icon: React.ReactElement<TablerIconsProps, string>;
  label: string;
  href?: string;
  onClick?: () => void;
}

export const MenuOption = forwardRef<MenuItemProps & MenuOptionProps, "div">(
  ({ icon, label, href, onClick, ...props }) => {
    const hover = useColorModeValue(
      "rgba(226, 232, 240, 0.6)",
      "rgba(45, 55, 72, 0.65)",
    );
    const color = useColorModeValue("gray.700", "whiteAlpha.800");
    const hoverColor = useColorModeValue("gray.900", "white");
    const iconColor = useColorModeValue("gray.500", "gray.400");
    const iconHoverColor = useColorModeValue("gray.900", "gray.50");

    return (
      <MenuItem
        role="group"
        icon={
          <Box
            as="span"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            color={iconColor}
            transition="transform cubic-bezier(.4,0,.2,1) 250ms, color 150ms ease"
            _groupHover={{
              transform: "rotate(-8deg) scale(1.1)",
              color: iconHoverColor,
            }}
          >
            {icon}
          </Box>
        }
        as={href ? Link : undefined}
        href={href}
        bg="transparent"
        rounded="lg"
        _hover={{ bg: hover, color: hoverColor }}
        _focus={{ bg: hover, color: hoverColor }}
        transition="background-color 150ms ease, color 150ms ease"
        onClick={onClick}
        py="2"
        px="2.5"
        fontWeight={600}
        color={color}
        {...props}
      >
        <Text>{label}</Text>
      </MenuItem>
    );
  },
);

export const MenuOptionPure = React.memo(MenuOption);
