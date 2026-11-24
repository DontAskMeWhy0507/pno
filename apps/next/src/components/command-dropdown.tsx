import React from "react";

import { Link } from "@quenti/components";
import { outfit } from "@quenti/lib/chakra-theme";

import {
  Box,
  Flex,
  MenuDivider,
  MenuItem,
  type MenuItemProps,
  MenuList,
  type MenuListProps,
  Stack,
  Text,
  forwardRef,
  useColorModeValue,
} from "@chakra-ui/react";

interface PillState {
  id: string | null;
  top: number;
  height: number;
  visible: boolean;
  isDanger: boolean;
}

interface CommandDropdownContextValue {
  activeId: string | null;
  registerActive: (id: string, el: HTMLElement, isDanger: boolean) => void;
}

const CommandDropdownContext =
  React.createContext<CommandDropdownContextValue>({
    activeId: null,
    registerActive: () => undefined,
  });

export interface CommandDropdownListProps extends MenuListProps {
  header?: React.ReactNode;
  minW?: string | number;
}

export const CommandDropdownList: React.FC<CommandDropdownListProps> = ({
  header,
  minW = "300px",
  children,
  ...props
}) => {
  const [pill, setPill] = React.useState<PillState>({
    id: null,
    top: 0,
    height: 0,
    visible: false,
    isDanger: false,
  });

  const bg = useColorModeValue(
    "rgba(247, 250, 252, 0.92)",
    "rgba(23, 25, 35, 0.88)",
  );
  const borderColor = useColorModeValue("gray.200", "gray.750");
  const cursorBg = useColorModeValue("gray.100", "gray.750");
  const dangerCursorBg = useColorModeValue(
    "rgba(254, 215, 215, 0.55)",
    "rgba(155, 44, 44, 0.28)",
  );

  const registerActive = React.useCallback(
    (id: string, el: HTMLElement, isDanger: boolean) => {
      const top = el.offsetTop;
      const height = el.offsetHeight;
      setPill((prev) => {
        if (
          prev.id === id &&
          prev.top === top &&
          prev.height === height &&
          prev.visible &&
          prev.isDanger === isDanger
        ) {
          return prev;
        }
        return {
          id,
          top,
          height,
          visible: true,
          isDanger,
        };
      });
    },
    [],
  );

  const clearActive = React.useCallback(() => {
    setPill((prev) => (prev.visible ? { ...prev, id: null, visible: false } : prev));
  }, []);

  const contextValue = React.useMemo(
    () => ({
      activeId: pill.id,
      registerActive,
    }),
    [pill.id, registerActive],
  );

  return (
    <MenuList
      bg={bg}
      backdropFilter="blur(16px)"
      borderWidth="2px"
      borderColor={borderColor}
      rounded="2xl"
      shadow="2xl"
      p="0"
      overflow="hidden"
      minW={minW}
      w="max"
      marginTop={2}
      {...props}
    >
      {header && (
        <Box px="4" py="3" borderBottomWidth="1px" borderBottomColor={borderColor}>
          {header}
        </Box>
      )}
      <Box pos="relative" p="2" onMouseLeave={clearActive}>
        <Box
          pos="absolute"
          left="2"
          right="2"
          top="0"
          rounded="xl"
          pointerEvents="none"
          bg={pill.isDanger ? dangerCursorBg : cursorBg}
          opacity={pill.visible ? 1 : 0}
          transition="transform cubic-bezier(.4,0,.2,1) 200ms, height cubic-bezier(.4,0,.2,1) 200ms, opacity 150ms ease, background-color 150ms ease"
          style={{
            height: pill.height,
            transform: `translateY(${pill.top}px)`,
          }}
        />
        <CommandDropdownContext.Provider value={contextValue}>
          {children}
        </CommandDropdownContext.Provider>
      </Box>
    </MenuList>
  );
};

export interface CommandDropdownItemProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  isDanger?: boolean;
}

export const CommandDropdownItem = forwardRef<
  MenuItemProps & CommandDropdownItemProps,
  "button"
>(
  (
    {
      icon,
      label,
      description,
      href,
      onClick,
      isDanger = false,
      onPointerEnter,
      onFocus,
      ...props
    },
    ref,
  ) => {
    const id = React.useId();
    const { activeId, registerActive } = React.useContext(
      CommandDropdownContext,
    );
    const isActive = activeId === id;

    const baseIconColor = useColorModeValue("gray.500", "gray.400");
    const activeIconColor = useColorModeValue("gray.900", "gray.50");
    const dangerIconColor = useColorModeValue("red.500", "red.300");

    const baseTextColor = useColorModeValue("gray.700", "whiteAlpha.800");
    const activeTextColor = useColorModeValue("gray.900", "whiteAlpha.900");
    const dangerTextColor = useColorModeValue("red.600", "red.300");

    const subColor = useColorModeValue("gray.500", "gray.400");

    const resolvedIconColor = isDanger
      ? dangerIconColor
      : isActive
        ? activeIconColor
        : baseIconColor;
    const resolvedTextColor = isDanger
      ? dangerTextColor
      : isActive
        ? activeTextColor
        : baseTextColor;

    return (
      <MenuItem
        ref={ref}
        as={href ? Link : undefined}
        href={href}
        bg="transparent"
        _hover={{ bg: "transparent" }}
        _focus={{ bg: "transparent" }}
        _active={{ bg: "transparent" }}
        pos="relative"
        zIndex={1}
        px="3"
        py="2.5"
        rounded="xl"
        onClick={onClick}
        onPointerEnter={(e) => {
          registerActive(id, e.currentTarget, isDanger);
          onPointerEnter?.(e);
        }}
        onFocus={(e) => {
          registerActive(id, e.currentTarget, isDanger);
          onFocus?.(e);
        }}
        {...props}
      >
        <Flex align="center" gap="3.5" w="full" minW={0}>
          <Box
            flexShrink={0}
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            color={resolvedIconColor}
            transition="all cubic-bezier(.4,0,.2,1) 300ms"
            transform={
              isActive ? "rotate(-10deg) scale(1.1)" : "rotate(0deg) scale(1)"
            }
          >
            {icon}
          </Box>
          <Stack spacing={0.5} minW={0} flex="1" textAlign="left">
            <Text
              fontFamily={outfit.style.fontFamily}
              fontSize="md"
              fontWeight={600}
              lineHeight="1.25"
              noOfLines={1}
              transition="color cubic-bezier(.4,0,.2,1) 300ms"
              color={resolvedTextColor}
            >
              {label}
            </Text>
            {description && (
              <Text fontSize="xs" color={subColor} lineHeight="1.3" noOfLines={1}>
                {description}
              </Text>
            )}
          </Stack>
        </Flex>
      </MenuItem>
    );
  },
);

export const CommandDropdownDivider: React.FC = () => {
  const borderColor = useColorModeValue("gray.200", "gray.750");
  return <MenuDivider my="1.5" mx="2" borderColor={borderColor} />;
};
