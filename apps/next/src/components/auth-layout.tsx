import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import React from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";

import { Link } from "@quenti/components";
import { HeadSeo } from "@quenti/components/head-seo";

import {
  Badge,
  Box,
  Button,
  Center,
  Container,
  Fade,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Heading,
  Input,
  Stack,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";

import {
  IconBrandGoogleFilled,
  IconShieldLock,
  IconWand,
} from "@tabler/icons-react";

import { Logo } from "../../../../packages/components/logo";
import { useTelemetry } from "../lib/telemetry";
import { getSafeRedirectUrl } from "../lib/urls";
import { Loading } from "./loading";

export interface AuthLayoutProps {
  mode: "login" | "signup";
  magicLinkEnabled?: boolean;
  onUserExists: (callbackUrl: string) => void;
}

interface EmailFormInputs {
  email: string;
}

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
});

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  mode,
  magicLinkEnabled = false,
  onUserExists,
}) => {
  const router = useRouter();
  const { event } = useTelemetry();
  const { data: session } = useSession();
  const callbackUrl =
    typeof router.query.callbackUrl == "string"
      ? router.query.callbackUrl
      : "/";
  const safeCallbackUrl = getSafeRedirectUrl(callbackUrl);

  React.useEffect(() => {
    if (session?.user) onUserExists(safeCallbackUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user]);

  const loading = Boolean(session?.user);

  const emailMethods = useForm<EmailFormInputs>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
    },
  });
  const {
    formState: { errors },
  } = emailMethods;

  const [expanded, setExpanded] = React.useState(false);
  const [animationFinished, setAnimationFinished] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = React.useState(false);

  const emailInputRef = React.useRef<HTMLInputElement>(null);

  const onSubmit: SubmitHandler<EmailFormInputs> = async (data) => {
    setMagicLinkLoading(true);
    try {
      await signIn("magic", {
        email: data.email,
        callbackUrl: safeCallbackUrl,
      });
    } finally {
      setMagicLinkLoading(false);
    }
  };

  const verb = mode == "signup" ? "up" : "in";
  const gradient = useColorModeValue(
    "linear(to-t, gray.50, blue.300)",
    "linear(to-t, gray.1000, blue.300)",
  );
  const gradientOpacity = useColorModeValue("0.3", "0.1");
  const termsColor = useColorModeValue("gray.500", "gray.500");

  return (
    <>
      <HeadSeo title={mode == "login" ? "Sign in" : "Sign up"} />
      <Center minH="100dvh" w="full" py={8} px={4} position="relative">
        <Fade
          in
          transition={{
            enter: {
              duration: 1.0,
              delay: 0.1,
              ease: "easeOut",
            },
          }}
        >
          <Box
            position="absolute"
            top="0"
            left="0"
            w="full"
            h="50vh"
            opacity={gradientOpacity}
            bgGradient={gradient}
            pointerEvents="none"
          />
        </Fade>
        {!loading ? (
          <Container maxW="sm" w="full" zIndex={10}>
            <Fade
              in
              initial={{
                opacity: 0,
                transform: "translateY(-12px)",
              }}
              animate={{
                opacity: 1,
                transform: "translateY(0)",
                transition: {
                  delay: 0.05,
                  duration: 0.25,
                  ease: "easeOut",
                },
              }}
            >
              <VStack spacing="7">
                <Logo width={28} height={28} />
                <VStack spacing={2} textAlign="center">
                  <Heading fontSize="24px">
                    {mode == "signup"
                      ? "Create your PNO account"
                      : "Sign in to PNO"}
                  </Heading>
                  <Badge
                    colorScheme="blue"
                    variant="subtle"
                    px={2.5}
                    py={1}
                    rounded="full"
                    fontSize="xs"
                    fontWeight={600}
                  >
                    <HStack spacing={1.5} display="inline-flex">
                      <IconShieldLock size={13} />
                      <span>Private workspace — authorized accounts only</span>
                    </HStack>
                  </Badge>
                </VStack>

                <form
                  style={{
                    width: "100%",
                  }}
                  onSubmit={emailMethods.handleSubmit(onSubmit)}
                >
                  <Stack spacing="3" w="full">
                    <Button
                      size="lg"
                      fontSize="sm"
                      shadow="0 4px 6px -1px rgba(0, 0, 0, 0.04),0 2px 4px -1px rgba(0, 0, 0, 0.01)"
                      leftIcon={<IconBrandGoogleFilled size={18} />}
                      isLoading={googleLoading}
                      loadingText="Connecting to Google..."
                      onClick={async () => {
                        setGoogleLoading(true);
                        try {
                          if (mode == "signup") {
                            await event("signup", {});
                          } else {
                            await event("login", {});
                          }
                          await signIn("google", {
                            callbackUrl: safeCallbackUrl,
                          });
                        } catch {
                          setGoogleLoading(false);
                        }
                      }}
                    >
                      Continue with Google
                    </Button>

                    {process.env.NODE_ENV === "development" && (
                      <Button
                        w="full"
                        size="lg"
                        fontSize="sm"
                        colorScheme="purple"
                        variant="outline"
                        onClick={() => {
                          window.location.href = `/api/auth/dev-login?callbackUrl=${encodeURIComponent(
                            safeCallbackUrl,
                          )}`;
                        }}
                      >
                        Quick Dev Login
                      </Button>
                    )}

                    {magicLinkEnabled && (
                      <Box>
                        <Stack
                          my={expanded ? 4 : 0}
                          mb={expanded ? 3 : 0}
                          minH={expanded ? "84px" : "0px"}
                          maxH={expanded ? "120px" : "0px"}
                          overflow="hidden"
                          px="1"
                          w="calc(100% + 8px)"
                          ml="-1"
                          transition="all 0.15s ease-in-out"
                        >
                          <Box
                            top="0"
                            w="full"
                            minH="2px"
                            bg="gray.100"
                            _dark={{
                              bg: "gray.750",
                            }}
                            rounded="full"
                            mb="3"
                          />
                          <Controller
                            name="email"
                            control={emailMethods.control}
                            render={({ field: { value, onChange } }) => (
                              <FormControl isInvalid={!!errors.email}>
                                <FormLabel htmlFor="email" srOnly>
                                  Email address
                                </FormLabel>
                                <Input
                                  ref={emailInputRef}
                                  id="email"
                                  name="email"
                                  type="email"
                                  autoComplete="username"
                                  inputMode="email"
                                  spellCheck={false}
                                  enterKeyHint="done"
                                  required={expanded}
                                  value={value}
                                  onChange={onChange}
                                  mt="2"
                                  minH="40px"
                                  placeholder="Enter your email address"
                                  fontSize="sm"
                                  borderColor="gray.300"
                                  _dark={{
                                    borderColor: "gray.600",
                                  }}
                                />
                                {errors.email && (
                                  <FormErrorMessage fontSize="xs">
                                    {errors.email.message}
                                  </FormErrorMessage>
                                )}
                              </FormControl>
                            )}
                          />
                        </Stack>
                        <Button
                          w="full"
                          size="lg"
                          fontSize="sm"
                          variant="outline"
                          shadow="0 4px 6px -1px rgba(0, 0, 0, 0.04),0 2px 4px -1px rgba(0, 0, 0, 0.01)"
                          colorScheme="gray"
                          onClick={() => {
                            if (!expanded) {
                              setExpanded(true);
                              setTimeout(() => {
                                setAnimationFinished(true);
                                emailInputRef.current?.focus();
                              }, 200);
                            }
                          }}
                          type={animationFinished ? "submit" : "button"}
                          overflow="hidden"
                          isLoading={magicLinkLoading}
                        >
                          <Stack
                            h="48px"
                            transform={
                              expanded
                                ? "translateY(0px)"
                                : "translateY(-48px)"
                            }
                            transition="all 0.5s cubic-bezier(0.25, 1, 0.5, 1)"
                            spacing="0"
                          >
                            <Center minH="48px">
                              <HStack>
                                <IconWand size={16} />
                                <Text>Send me a magic link</Text>
                              </HStack>
                            </Center>
                            <Center minH="48px">
                              <Text>Sign {verb} with email</Text>
                            </Center>
                          </Stack>
                        </Button>
                      </Box>
                    )}
                  </Stack>
                </form>

                <Text
                  textAlign="center"
                  fontSize="xs"
                  color={termsColor}
                  maxW="280px"
                >
                  By signing {verb}, you agree to the{" "}
                  <Link
                    href="/privacy"
                    _hover={{
                      textDecoration: "underline",
                    }}
                  >
                    Privacy Policy
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/terms"
                    _hover={{
                      textDecoration: "underline",
                    }}
                  >
                    Terms of Service
                  </Link>
                  .
                </Text>
              </VStack>
            </Fade>
          </Container>
        ) : (
          <Loading />
        )}
      </Center>
    </>
  );
};
