import { signOut, useSession } from "next-auth/react";

import { Link, Logo } from "@quenti/components";
import { HeadSeo } from "@quenti/components/head-seo";

import {
  Button,
  Center,
  Container,
  HStack,
  Heading,
  Text,
  VStack,
} from "@chakra-ui/react";

import { IconArrowLeft, IconLogout, IconShieldLock } from "@tabler/icons-react";

import { PageWrapper } from "../common/page-wrapper";
import { EnterWrapper } from "../modules/auth/enter-wrapper";
import { AuthGradient } from "../modules/auth/gradient";

export default function Unauthorized() {
  const { status } = useSession();

  return (
    <>
      <HeadSeo
        title="Access Restricted"
        nextSeoProps={{
          nofollow: true,
          noindex: true,
        }}
      />
      <Center minH="100dvh" w="full" py={8} px={4} position="relative">
        <AuthGradient />
        <EnterWrapper>
          <Container maxW="xl" w="full" zIndex={10}>
            <VStack spacing="6" textAlign="center">
              <Logo width={20} height={20} />
              <HStack
                px={3}
                py={1}
                rounded="full"
                bg="red.50"
                color="red.600"
                _dark={{ bg: "whiteAlpha.100", color: "red.300" }}
                fontSize="xs"
                fontWeight={700}
              >
                <IconShieldLock size={14} />
                <span>Private PNO Workspace</span>
              </HStack>
              <Heading>Access restricted</Heading>
              <Text
                color="gray.600"
                _dark={{
                  color: "gray.400",
                }}
                fontWeight={500}
                maxW="md"
              >
                This personal study &amp; IELTS workspace is restricted to
                authorized accounts only. Your Google account is not on the
                allowlist.
              </Text>
              <HStack spacing={3} pt={2}>
                <Button
                  colorScheme="blue"
                  leftIcon={<IconArrowLeft size={18} />}
                  as={Link}
                  href="/auth/login"
                >
                  Try another account
                </Button>
                {status === "authenticated" && (
                  <Button
                    variant="outline"
                    leftIcon={<IconLogout size={18} />}
                    onClick={() => void signOut({ callbackUrl: "/auth/login" })}
                  >
                    Sign out
                  </Button>
                )}
              </HStack>
            </VStack>
          </Container>
        </EnterWrapper>
      </Center>
    </>
  );
}

Unauthorized.PageWrapper = PageWrapper;
