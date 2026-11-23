import { useRouter } from "next/router";
import React from "react";

import { Link } from "@quenti/components";
import { HeadSeo } from "@quenti/components/head-seo";
import { outfit } from "@quenti/lib/chakra-theme";

import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  HStack,
  Heading,
  Icon,
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

import { LazyWrapper } from "../common/lazy-wrapper";
import { PageWrapper } from "../common/page-wrapper";
import { WithFooter } from "../components/with-footer";
import { getLayout } from "../layouts/main-layout";

const PnoPortalPage = () => {
  const router = useRouter();

  const cardBg = useColorModeValue("white", "gray.800");
  const cardBorder = useColorModeValue("gray.200", "gray.700");
  const subTextColor = useColorModeValue("gray.600", "gray.400");
  const pillBg = useColorModeValue("gray.100", "gray.750");
  const heroBg = useColorModeValue(
    "linear(to-b, blue.50, transparent)",
    "linear(to-b, whiteAlpha.50, transparent)",
  );

  return (
    <>
      <HeadSeo
        title="PNO — Học Quiz & Luyện Thi IELTS"
        hideTitleSuffix
      />
      <LazyWrapper>
        <WithFooter>
          <Box
            pos="relative"
            bgGradient={heroBg}
            pt={{ base: 6, md: 12 }}
            pb={{ base: 12, md: 20 }}
          >
            <Container maxW="6xl">
              <VStack spacing={10}>
                {/* Header */}
                <VStack spacing={4} textAlign="center" maxW="3xl">
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
                    <HStack spacing={1.5} display="inline-flex" alignItems="center">
                      <Icon as={IconSparkles} boxSize={3.5} />
                      <span>PNO Learning Ecosystem</span>
                    </HStack>
                  </Badge>
                  <Heading
                    as="h1"
                    fontFamily={outfit.style.fontFamily}
                    fontSize={{ base: "3xl", sm: "4xl", md: "5xl" }}
                    fontWeight={800}
                    lineHeight={1.15}
                  >
                    Chọn không gian học tập của bạn trên{" "}
                    <Text
                      as="span"
                      bgGradient="linear(to-r, blue.400, purple.500)"
                      bgClip="text"
                    >
                      PNO
                    </Text>
                  </Heading>
                  <Text
                    fontSize={{ base: "md", md: "lg" }}
                    color={subTextColor}
                    fontWeight={500}
                  >
                    Ôn luyện thẻ từ vựng thông minh với Flashcards, Anki, Game Blocks hoặc bước vào phòng thi thử IELTS 4 kỹ năng chuẩn máy tính.
                  </Text>
                </VStack>

                {/* 2 Big Choice Cards: QUIZ vs THI IELTS */}
                <SimpleGrid
                  columns={{ base: 1, md: 2 }}
                  spacing={{ base: 6, md: 8 }}
                  w="full"
                >
                  {/* Card 1: QUIZ */}
                  <Box
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
                    transition="all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
                    rounded="3xl"
                    p={{ base: 6, sm: 8 }}
                    shadow="md"
                    cursor="pointer"
                    onClick={() => void router.push("/home")}
                    display="flex"
                    flexDirection="column"
                    justifyContent="space-between"
                  >
                    <Stack spacing={6}>
                      <Flex justify="space-between" align="center">
                        <Flex
                          w={14}
                          h={14}
                          rounded="2xl"
                          bg="blue.500"
                          color="white"
                          align="center"
                          justify="center"
                          shadow="md"
                        >
                          <Icon as={IconCards} boxSize={8} />
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

                      <Stack spacing={2}>
                        <Heading
                          as="h2"
                          fontFamily={outfit.style.fontFamily}
                          fontSize={{ base: "2xl", sm: "3xl" }}
                          fontWeight={800}
                        >
                          Quiz
                        </Heading>
                        <Text color={subTextColor} fontSize="sm" lineHeight="tall">
                          Tạo và học bộ thẻ từ vựng, nhập trực tiếp từ Quizlet &amp; Anki (<code>.apkg</code>), luyện trí nhớ ngắt quãng (SRS) và chơi các chế độ tương tác.
                        </Text>
                      </Stack>

                      <SimpleGrid columns={2} spacing={2.5}>
                        {[
                          { icon: IconCards, label: "Flashcards & Anki SRS" },
                          { icon: IconBrain, label: "Learn & Test tự động" },
                          { icon: IconDeviceGamepad2, label: "Ghép thẻ Match" },
                          { icon: IconCube, label: "Game xếp hình Blocks" },
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

                    <Button
                      as={Link}
                      href="/home"
                      mt={8}
                      size="lg"
                      w="full"
                      colorScheme="blue"
                      rounded="2xl"
                      fontWeight={700}
                      rightIcon={<IconArrowRight size={18} />}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Vào Quiz
                    </Button>
                  </Box>

                  {/* Card 2: THI IELTS */}
                  <Box
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
                    transition="all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
                    rounded="3xl"
                    p={{ base: 6, sm: 8 }}
                    shadow="md"
                    cursor="pointer"
                    onClick={() => void router.push("/ielts")}
                    display="flex"
                    flexDirection="column"
                    justifyContent="space-between"
                  >
                    <Stack spacing={6}>
                      <Flex justify="space-between" align="center">
                        <Flex
                          w={14}
                          h={14}
                          rounded="2xl"
                          bgGradient="linear(to-br, purple.500, blue.600)"
                          color="white"
                          align="center"
                          justify="center"
                          shadow="md"
                        >
                          <Icon as={IconSchool} boxSize={8} />
                        </Flex>
                        <Badge
                          colorScheme="purple"
                          px={3}
                          py={1}
                          rounded="lg"
                          fontSize="xs"
                          fontWeight={700}
                        >
                          4 Kỹ Năng • Chuẩn Máy Tính
                        </Badge>
                      </Flex>

                      <Stack spacing={2}>
                        <Heading
                          as="h2"
                          fontFamily={outfit.style.fontFamily}
                          fontSize={{ base: "2xl", sm: "3xl" }}
                          fontWeight={800}
                        >
                          Thi IELTS
                        </Heading>
                        <Text color={subTextColor} fontSize="sm" lineHeight="tall">
                          Phòng luyện thi IELTS trên máy tính 4 kỹ năng với đồng hồ đếm ngược, tô màu highlight, chấm điểm Band 9.0, thu âm Speaking và tự tạo/nhập kho đề.
                        </Text>
                      </Stack>

                      <SimpleGrid columns={2} spacing={2.5}>
                        {[
                          { icon: IconBook, label: "Reading Split-Pane" },
                          { icon: IconHeadphones, label: "Listening Audio" },
                          { icon: IconPencil, label: "Writing Task 1 & 2" },
                          { icon: IconMicrophone, label: "Speaking & Thu âm" },
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

                    <Button
                      as={Link}
                      href="/ielts"
                      mt={8}
                      size="lg"
                      w="full"
                      colorScheme="purple"
                      bgGradient="linear(to-r, purple.500, blue.600)"
                      _hover={{
                        bgGradient: "linear(to-r, purple.600, blue.700)",
                      }}
                      color="white"
                      rounded="2xl"
                      fontWeight={700}
                      rightIcon={<IconArrowRight size={18} />}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Vào Thi IELTS
                    </Button>
                  </Box>
                </SimpleGrid>
              </VStack>
            </Container>
          </Box>
        </WithFooter>
      </LazyWrapper>
    </>
  );
};

PnoPortalPage.getLayout = getLayout;
PnoPortalPage.PageWrapper = PageWrapper;

export default PnoPortalPage;
