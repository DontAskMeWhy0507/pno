import { FrameLogo, Link } from "@quenti/components";

import {
  Box,
  Button,
  Container,
  Flex,
  HStack,
  Heading,
  Kbd,
  Stack,
  Text,
  useColorMode,
  useColorModeValue,
} from "@chakra-ui/react";

import {
  IconCopyright,
  IconMinusVertical,
  IconMoon,
  IconSun,
} from "@tabler/icons-react";

import pjson from "../../package.json";
import { MOD } from "../lib/tinykeys";
import { Authed } from "./authed";

const { version } = pjson;

export const Footer = () => {
  const textColor = useColorModeValue("gray.900", "whiteAlpha.900");

  return (
    <Container
      maxW="100vw"
      as="footer"
      bg="white"
      _dark={{
        bg: "gray.850",
      }}
      borderTop="1px"
      borderTopColor={useColorModeValue("gray.200", "gray.750")}
    >
      <Container maxW="7xl" py={{ base: "8", md: "10" }}>
        <Stack spacing="6">
          <Flex
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap="4"
          >
            <HStack spacing="3">
              <Link href="/">
                <HStack>
                  <FrameLogo width="18px" height="18px" />
                  <Heading size="md" className="notranslate">
                    PNO
                  </Heading>
                </HStack>
              </Link>
              <HStack
                spacing="1"
                color="gray.600"
                _dark={{
                  color: "gray.400",
                }}
              >
                <IconCopyright size={12} />
                <Text fontSize="sm">2026 PNO</Text>
              </HStack>
              <Box
                color="gray.300"
                _dark={{
                  color: "gray.600",
                }}
                mx="-2"
              >
                <IconMinusVertical strokeWidth={1.5} />
              </Box>
              <Text fontSize="xs" color="gray.500" fontWeight={500}>
                v{version}
              </Text>
            </HStack>
            <HStack spacing="4">
              <Authed nullOnLoad>
                <Button
                  variant="outline"
                  size="sm"
                  color="gray.500"
                  colorScheme="gray"
                  display={{ base: "none", md: "flex" }}
                  onClick={() => {
                    window.dispatchEvent(
                      new KeyboardEvent("keydown", {
                        key: "k",
                        code: "KeyK",
                        ctrlKey: MOD == "Control",
                        metaKey: MOD == "Meta",
                        shiftKey: false,
                      }),
                    );
                  }}
                >
                  <HStack>
                    <Text color={textColor}>Command menu</Text>
                    <Text color={textColor}>
                      <Kbd>{MOD == "Control" ? "Ctrl" : "⌘"}</Kbd> +{" "}
                      <Kbd>K</Kbd>
                    </Text>
                  </HStack>
                </Button>
              </Authed>
              <ThemeSwitcher />
            </HStack>
          </Flex>
          <Flex
            w="full"
            gap={{ base: "4", md: "8" }}
            flexWrap="wrap"
            alignItems="center"
          >
            <FooterLink href="/" text="Trang chủ" />
            <FooterLink href="/home" text="Quiz" />
            <FooterLink href="/ielts" text="Thi IELTS" />
            <FooterLink href="/privacy" text="Chính sách bảo mật" />
            <FooterLink href="/terms" text="Điều khoản sử dụng" />
          </Flex>
        </Stack>
      </Container>
    </Container>
  );
};

const ThemeSwitcher = () => {
  return (
    <HStack color="gray.500" spacing="0">
      <ThemeButton mode="light" />
      <ThemeButton mode="dark" />
    </HStack>
  );
};

const ThemeButton = ({ mode }: { mode: "light" | "dark" }) => {
  const { colorMode, setColorMode } = useColorMode();
  const Icon = mode == "dark" ? IconMoon : IconSun;

  const selected = colorMode == mode;

  return (
    <Box
      cursor="pointer"
      color={selected ? "gray.900" : "gray.400"}
      bg={selected ? "gray.100" : "transparent"}
      _hover={{
        color: "gray.900",
      }}
      _dark={{
        color: selected ? "gray.50" : "gray.500",
        bg: selected ? "gray.750" : "transparent",
        _hover: {
          color: "gray.50",
        },
      }}
      transition="color 0.15s ease-in-out"
      p="7px"
      rounded="full"
      onClick={() => setColorMode(mode)}
    >
      <Icon size={18} />
    </Box>
  );
};

interface FooterLinkProps {
  href: string;
  text: string;
}

const FooterLink: React.FC<FooterLinkProps> = ({ href, text }) => {
  return (
    <Link href={href} w="max">
      <Text
        color="gray.500"
        transition="all ease-in-out 150ms"
        fontSize="sm"
        fontWeight={500}
        _hover={{
          color: "gray.900",
        }}
        _dark={{
          _hover: {
            color: "gray.50",
          },
        }}
      >
        {text}
      </Text>
    </Link>
  );
};
