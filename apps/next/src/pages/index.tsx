import React from "react";

import { Link } from "@quenti/components";
import { HeadSeo } from "@quenti/components/head-seo";
import { outfit } from "@quenti/lib/chakra-theme";

import {
  Badge,
  Box,
  Container,
  Flex,
  HStack,
  Heading,
  Icon,
  LinkBox,
  LinkOverlay,
  SimpleGrid,
  Stack,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";

import {
  IconArrowRight,
  IconBook,
  IconBrain,
  IconCards,
  IconCube,
  IconDeviceGamepad2,
  IconHeadphones,
  IconMicrophone,
  IconPencil,
  IconSchool,
  IconSparkles,
} from "@tabler/icons-react";

import { PageWrapper } from "../common/page-wrapper";
import { Footer } from "../components/footer";
import { getLayout } from "../layouts/main-layout";

const PnoPortalPage = () => {
  const cardBg = useColorModeValue("white", "gray.800");
  const cardBorder = useColorModeValue("gray.200", "gray.700");
  const subTextColor = useColorModeValue("gray.600", "gray.400");
  const pillBg = useColorModeValue("gray.100", "gray.750");
  const heroBg = useColorModeValue(
    "linear(to-b, blue.50 0%, rgba(224, 237, 255, 0.45) 55%, transparent 100%)",
    "linear(to-b, rgba(75, 131, 255, 0.14) 0%, rgba(75, 131, 255, 0.04) 55%, transparent 100%)",
  );

  return (
    <>
      <HeadSeo
        title="PNO — Quiz & IELTS Practice Platform"
        hideTitleSuffix
      />
      <Flex direction="column" minH="calc(100dvh - 80px)" pos="relative">
        {/* Seamless gradient extending behind the 80px Navbar */}
        <Box
          pos="absolute"
          top="-80px"
          left={0}
          right={0}
          h={{ base: "380px", md: "480px" }}
          bgGradient={heroBg}
          pointerEvents="none"
          zIndex={0}
        />

        <Flex
          as="main"
          pos="relative"
          zIndex={1}
          flex="1"
          direction="column"
          justify="center"
          pt={{ base: 2, md: 3 }}
          pb={{ base: 8, md: 10 }}
        >
          <Container maxW="6xl">
            <VStack spacing={{ base: 6, md: 8 }}>
              {/* Header */}
              <VStack spacing={3} textAlign="center" maxW="4xl">
                <Badge
                  colorScheme="blue"
                  px={3}
                  py={1}
                  rounded="full"
                  fontSize="xs"
                  fontWeight={700}
                  letterSpacing="wider"
                  textTransform="uppercase"
                >
                  <HStack
                    spacing={1.5}
                    display="inline-flex"
                    alignItems="center"
                  >
                    <Icon as={IconSparkles} boxSize={3.5} />
                    <span>PNO Learning Ecosystem</span>
                  </HStack>
                </Badge>
                <Heading
                  as="h1"
                  fontFamily={outfit.style.fontFamily}
                  fontSize={{ base: "2xl", sm: "3xl", md: "4xl", lg: "44px" }}
                  fontWeight={800}
                  lineHeight={1.15}
                  letterSpacing="-0.02em"
                >
                  Choose your study workspace on{" "}
                  <Text
                    as="span"
                    bgGradient="linear(to-r, blue.400, purple.500)"
                    bgClip="text"
                  >
                    PNO
                  </Text>
                </Heading>
                <Text
                  fontSize={{ base: "sm", md: "md" }}
                  color={subTextColor}
                  fontWeight={500}
                  maxW="2xl"
                >
                  Master vocabulary with smart Flashcards, Anki SRS, and Blocks
                  Game, or step into the 4-skill Computer-Delivered IELTS Exam
                  Room.
                </Text>
              </VStack>

              {/* 2 Big Choice Cards: QUIZ vs IELTS */}
              <SimpleGrid
                columns={{ base: 1, md: 2 }}
                spacing={{ base: 5, md: 7 }}
                w="full"
              >
                {/* Card 1: QUIZ */}
                <LinkBox
                  as="article"
                  role="group"
                  bg={cardBg}
                  borderWidth="2px"
                  borderColor={cardBorder}
                  _hover={{
                    borderColor: "blue.400",
                    transform: "translateY(-4px)",
                    shadow: "xl",
                  }}
                  _focusWithin={{
                    borderColor: "blue.400",
                    shadow: "xl",
                  }}
                  transition="all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
                  rounded="3xl"
                  p={{ base: 6, sm: 7 }}
                  shadow="md"
                  display="flex"
                  flexDirection="column"
                  justifyContent="space-between"
                >
                  <Stack spacing={5}>
                    <Flex justify="space-between" align="center">
                      <Flex
                        w={13}
                        h={13}
                        rounded="2xl"
                        bg="blue.500"
                        color="white"
                        align="center"
                        justify="center"
                        shadow="md"
                      >
                        <Icon as={IconCards} boxSize={7} />
                      </Flex>
                      <Badge
                        colorScheme="blue"
                        px={3}
                        py={1}
                        rounded="lg"
                        fontSize="xs"
                        fontWeight={700}
                      >
                        Flashcards • Anki • Games
                      </Badge>
                    </Flex>

                    <Stack spacing={1.5}>
                      <Heading
                        as="h2"
                        fontFamily={outfit.style.fontFamily}
                        fontSize={{ base: "2xl", sm: "3xl" }}
                        fontWeight={800}
                      >
                        <LinkOverlay as={Link} href="/home">
                          Quiz
                        </LinkOverlay>
                      </Heading>
                      <Text color={subTextColor} fontSize="sm" lineHeight="tall">
                        Create and study vocabulary sets, import directly from
                        Quizlet &amp; Anki (<code>.apkg</code>), review with
                        spaced repetition (SRS), and play interactive modes.
                      </Text>
                    </Stack>

                    <SimpleGrid columns={2} spacing={2.5}>
                      {[
                        { icon: IconCards, label: "Flashcards & Anki SRS" },
                        { icon: IconBrain, label: "Adaptive Learn & Test" },
                        { icon: IconDeviceGamepad2, label: "Match Game" },
                        { icon: IconCube, label: "Blocks Puzzle Game" },
                      ].map((item) => (
                        <HStack
                          key={item.label}
                          bg={pillBg}
                          px={3}
                          py={2}
                          rounded="xl"
                          spacing={2}
                        >
                          <Icon
                            as={item.icon}
                            boxSize={4}
                            color="blue.400"
                            flexShrink={0}
                          />
                          <Text fontSize="xs" fontWeight={600} noOfLines={1}>
                            {item.label}
                          </Text>
                        </HStack>
                      ))}
                    </SimpleGrid>
                  </Stack>

                  <Flex
                    mt={6}
                    h={11}
                    w="full"
                    bg="blue.400"
                    _groupHover={{ bg: "blue.300" }}
                    color="white"
                    rounded="2xl"
                    fontWeight={700}
                    fontSize="md"
                    align="center"
                    justify="center"
                    gap={2}
                    shadow="inset 0 1px 0 0 rgb(255 255 255/.2)"
                    transition="background-color 0.15s ease"
                  >
                    <span>Open Quiz</span>
                    <IconArrowRight size={18} />
                  </Flex>
                </LinkBox>

                {/* Card 2: IELTS */}
                <LinkBox
                  as="article"
                  role="group"
                  bg={cardBg}
                  borderWidth="2px"
                  borderColor={cardBorder}
                  _hover={{
                    borderColor: "purple.400",
                    transform: "translateY(-4px)",
                    shadow: "xl",
                  }}
                  _focusWithin={{
                    borderColor: "purple.400",
                    shadow: "xl",
                  }}
                  transition="all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
                  rounded="3xl"
                  p={{ base: 6, sm: 7 }}
                  shadow="md"
                  display="flex"
                  flexDirection="column"
                  justifyContent="space-between"
                >
                  <Stack spacing={5}>
                    <Flex justify="space-between" align="center">
                      <Flex
                        w={13}
                        h={13}
                        rounded="2xl"
                        bgGradient="linear(to-br, purple.500, blue.600)"
                        color="white"
                        align="center"
                        justify="center"
                        shadow="md"
                      >
                        <Icon as={IconSchool} boxSize={7} />
                      </Flex>
                      <Badge
                        colorScheme="purple"
                        px={3}
                        py={1}
                        rounded="lg"
                        fontSize="xs"
                        fontWeight={700}
                      >
                        4 Skills • Computer-Delivered
                      </Badge>
                    </Flex>

                    <Stack spacing={1.5}>
                      <Heading
                        as="h2"
                        fontFamily={outfit.style.fontFamily}
                        fontSize={{ base: "2xl", sm: "3xl" }}
                        fontWeight={800}
                      >
                        <LinkOverlay as={Link} href="/ielts">
                          IELTS
                        </LinkOverlay>
                      </Heading>
                      <Text color={subTextColor} fontSize="sm" lineHeight="tall">
                        Full 4-skill Computer-Delivered IELTS practice suite
                        with countdown timers, 4-color passage highlights, Band
                        9.0 scoring, live Speaking recording, and cloud sync.
                      </Text>
                    </Stack>

                    <SimpleGrid columns={2} spacing={2.5}>
                      {[
                        { icon: IconBook, label: "Reading Split-Pane" },
                        { icon: IconHeadphones, label: "Listening Audio" },
                        { icon: IconPencil, label: "Writing Task 1 & 2" },
                        { icon: IconMicrophone, label: "Speaking & Recorder" },
                      ].map((item) => (
                        <HStack
                          key={item.label}
                          bg={pillBg}
                          px={3}
                          py={2}
                          rounded="xl"
                          spacing={2}
                        >
                          <Icon
                            as={item.icon}
                            boxSize={4}
                            color="purple.400"
                            flexShrink={0}
                          />
                          <Text fontSize="xs" fontWeight={600} noOfLines={1}>
                            {item.label}
                          </Text>
                        </HStack>
                      ))}
                    </SimpleGrid>
                  </Stack>

                  <Flex
                    mt={6}
                    h={11}
                    w="full"
                    bgGradient="linear(to-r, purple.500, blue.600)"
                    _groupHover={{
                      bgGradient: "linear(to-r, purple.600, blue.700)",
                    }}
                    color="white"
                    rounded="2xl"
                    fontWeight={700}
                    fontSize="md"
                    align="center"
                    justify="center"
                    gap={2}
                    transition="all 0.15s ease"
                  >
                    <span>Open IELTS</span>
                    <IconArrowRight size={18} />
                  </Flex>
                </LinkBox>
              </SimpleGrid>
            </VStack>
          </Container>
        </Flex>

        <Box pos="relative" zIndex={1}>
          <Footer />
        </Box>
      </Flex>
    </>
  );
};

PnoPortalPage.getLayout = getLayout;
PnoPortalPage.PageWrapper = PageWrapper;

export default PnoPortalPage;
