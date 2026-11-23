import { useRouter } from "next/router";

import { Link, Logo } from "@quenti/components";
import { HeadSeo } from "@quenti/components/head-seo";

import {
  Button,
  Center,
  Container,
  Heading,
  Text,
  VStack,
} from "@chakra-ui/react";

import { IconArrowLeft } from "@tabler/icons-react";

import { PageWrapper } from "../../common/page-wrapper";
import { EnterWrapper } from "../../modules/auth/enter-wrapper";
import { AuthGradient } from "../../modules/auth/gradient";

export default function AuthError() {
  const { error } = useRouter().query;

  const message = () => {
    if (error === "Verification") {
      return (
        <>
          The magic link you&apos;re trying to use is no longer valid.
          <br />
          It may have already been used or expired.
        </>
      );
    }
    if (error === "AccessDenied") {
      return (
        <>
          This Google account is not authorized to access this private PNO
          workspace.
        </>
      );
    }
    if (error === "OAuthAccountNotLinked") {
      return (
        <>
          This email is already associated with another sign-in method. Please
          sign in with the original provider.
        </>
      );
    }
    return <>An unknown error occurred while trying to sign you in.</>;
  };

  return (
    <>
      <HeadSeo
        title="Error"
        nextSeoProps={{
          nofollow: true,
          noindex: true,
        }}
      />
      <Center minH="100dvh" w="full" py={8} px={4} position="relative">
          <AuthGradient />
          <EnterWrapper>
            <Container maxW="xl" w="full" zIndex={10}>
              <VStack spacing="8" textAlign="center">
                <Logo width={20} height={20} />
                <Heading>We couldn&apos;t sign you in</Heading>
                <Text
                  color="gray.600"
                  _dark={{
                    color: "gray.400",
                  }}
                  fontWeight={500}
                >
                  {message()}
                </Text>
                <Button
                  variant="ghost"
                  leftIcon={<IconArrowLeft size={18} />}
                  as={Link}
                  href="/auth/login"
                >
                  Back to log in
                </Button>
              </VStack>
            </Container>
          </EnterWrapper>
        </Center>
    </>
  );
}

AuthError.PageWrapper = PageWrapper;
