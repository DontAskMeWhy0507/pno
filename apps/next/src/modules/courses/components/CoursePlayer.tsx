import React from "react";

import { outfit } from "@pno/lib/chakra-theme";

import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  Container,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  HStack,
  Heading,
  Icon,
  Progress,
  Stack,
  Text,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";

import {
  IconArrowLeft,
  IconArrowRight,
  IconBook,
  IconCheck,
  IconChecklist,
  IconCode,
  IconEdit,
  IconList,
} from "@tabler/icons-react";

import type {
  CourseDetail,
  CourseLesson,
  CourseUserProgress,
  LessonType,
  QuizLessonProgress,
} from "../types";
import { PracticeWorkbench } from "./PracticeWorkbench";
import { QuizInteractive } from "./QuizInteractive";
import { SanitizedHtml } from "./SanitizedHtml";

interface CoursePlayerProps {
  course: CourseDetail;
  activeLessonId: string;
  userProgress: CourseUserProgress;
  onBackCatalog: () => void;
  onSelectLesson: (lessonId: string) => void;
  onToggleComplete: (lessonId: string, force?: boolean) => void;
  onSaveQuiz: (lessonId: string, state: QuizLessonProgress) => void;
  onSavePracticeDraft: (lessonId: string, code: string) => void;
  onEditCourse?: () => void;
}

const LESSON_TYPE_META: Record<
  LessonType,
  { label: string; color: string; icon: React.ElementType }
> = {
  theory: { label: "Theory", color: "blue", icon: IconBook },
  practice: { label: "Practice", color: "green", icon: IconCode },
  quiz: { label: "Quiz", color: "orange", icon: IconChecklist },
};

export const CoursePlayer: React.FC<CoursePlayerProps> = ({
  course,
  activeLessonId,
  userProgress,
  onBackCatalog,
  onSelectLesson,
  onToggleComplete,
  onSaveQuiz,
  onSavePracticeDraft,
  onEditCourse,
}) => {
  const {
    isOpen: isDrawerOpen,
    onOpen: onDrawerOpen,
    onClose: onDrawerClose,
  } = useDisclosure();

  const cardBg = useColorModeValue("white", "gray.800");
  const cardBorder = useColorModeValue("gray.200", "gray.700");
  const subText = useColorModeValue("gray.600", "gray.400");
  const activeItemBg = useColorModeValue("blue.50", "rgba(75, 131, 255, 0.18)");
  const hoverItemBg = useColorModeValue("gray.100", "gray.750");

  const flatLessons = React.useMemo(() => {
    const out: Array<{
      chapterTitle: string;
      chapterIndex: number;
      lesson: CourseLesson;
    }> = [];
    course.chapters.forEach((ch, chIdx) => {
      ch.lessons.forEach((lesson) => {
        out.push({ chapterTitle: ch.title, chapterIndex: chIdx, lesson });
      });
    });
    return out;
  }, [course]);

  const currentIdx = Math.max(
    0,
    flatLessons.findIndex((item) => item.lesson.id === activeLessonId),
  );
  const currentEntry = flatLessons[currentIdx];
  const prevEntry = currentIdx > 0 ? flatLessons[currentIdx - 1] : null;
  const nextEntry =
    currentIdx >= 0 && currentIdx < flatLessons.length - 1
      ? flatLessons[currentIdx + 1]
      : null;

  const activeLesson = currentEntry?.lesson;
  const isCompleted = activeLesson
    ? userProgress.completedLessons.includes(activeLesson.id)
    : false;

  const doneCount = userProgress.completedLessons.length;
  const progressPct =
    course.lessonCount > 0
      ? Math.round((doneCount / course.lessonCount) * 100)
      : 0;

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeLessonId]);

  const renderCurriculum = (onAfterSelect?: () => void) => {
    const defaultOpenIdx = currentEntry ? [currentEntry.chapterIndex] : [0];
    return (
      <Stack spacing={3}>
        <Box pb={3} borderBottomWidth="1px" borderColor={cardBorder}>
          <Text
            fontFamily={outfit.style.fontFamily}
            fontWeight={800}
            fontSize="md"
            mb={1}
          >
            {course.title}
          </Text>
          <Flex justify="space-between" fontSize="xs" color={subText} mb={1.5}>
            <span>Course progress</span>
            <Text fontWeight={700}>
              {doneCount}/{course.lessonCount} ({progressPct}%)
            </Text>
          </Flex>
          <Progress
            value={progressPct}
            size="xs"
            rounded="full"
            colorScheme={progressPct === 100 ? "green" : "blue"}
          />
        </Box>

        <Accordion allowMultiple defaultIndex={defaultOpenIdx}>
          {course.chapters.map((ch) => {
            const chDone = ch.lessons.filter((l) =>
              userProgress.completedLessons.includes(l.id),
            ).length;
            return (
              <AccordionItem key={ch.id} border="none" mb={1.5}>
                <AccordionButton
                  px={2.5}
                  py={2}
                  rounded="xl"
                  _hover={{ bg: hoverItemBg }}
                >
                  <Flex
                    flex="1"
                    textAlign="left"
                    align="center"
                    justify="space-between"
                    gap={2}
                  >
                    <Text fontSize="xs" fontWeight={700} lineHeight="1.35">
                      {ch.number}. {ch.title}
                    </Text>
                    <Badge
                      fontSize="10px"
                      rounded="md"
                      colorScheme={
                        chDone === ch.lessons.length ? "green" : "gray"
                      }
                    >
                      {chDone}/{ch.lessons.length}
                    </Badge>
                  </Flex>
                  <AccordionIcon ml={1} />
                </AccordionButton>
                <AccordionPanel px={1} py={1.5}>
                  <Stack spacing={1}>
                    {ch.lessons.map((l) => {
                      const isActive = l.id === activeLesson?.id;
                      const done = userProgress.completedLessons.includes(l.id);
                      const typeMeta = LESSON_TYPE_META[l.type];

                      return (
                        <Box
                          key={l.id}
                          as="button"
                          type="button"
                          w="full"
                          textAlign="left"
                          px={2.5}
                          py={2}
                          rounded="lg"
                          bg={isActive ? activeItemBg : "transparent"}
                          _hover={{
                            bg: isActive ? activeItemBg : hoverItemBg,
                          }}
                          onClick={() => {
                            onSelectLesson(l.id);
                            onAfterSelect?.();
                          }}
                        >
                          <HStack align="flex-start" spacing={2}>
                            <Flex
                              w={5}
                              h={5}
                              rounded="md"
                              mt={0.5}
                              flexShrink={0}
                              align="center"
                              justify="center"
                              bg={
                                done
                                  ? "green.500"
                                  : isActive
                                    ? "blue.500"
                                    : hoverItemBg
                              }
                              color={done || isActive ? "white" : subText}
                              fontSize="10px"
                              fontWeight={800}
                            >
                              {done ? (
                                <Icon as={IconCheck} boxSize={3} />
                              ) : (
                                l.globalIndex
                              )}
                            </Flex>
                            <Stack spacing={0.5} minW={0} flex={1}>
                              <Text
                                fontSize="xs"
                                fontWeight={isActive ? 700 : 500}
                                lineHeight="1.35"
                                noOfLines={2}
                              >
                                {l.title}
                              </Text>
                              <HStack
                                spacing={1}
                                fontSize="10px"
                                color={`${typeMeta.color}.500`}
                              >
                                <Icon as={typeMeta.icon} boxSize={3} />
                                <span>{typeMeta.label}</span>
                              </HStack>
                            </Stack>
                          </HStack>
                        </Box>
                      );
                    })}
                  </Stack>
                </AccordionPanel>
              </AccordionItem>
            );
          })}
        </Accordion>
      </Stack>
    );
  };

  if (!activeLesson) {
    return null;
  }

  const lessonMeta = LESSON_TYPE_META[activeLesson.type];

  return (
    <Container maxW="1400px" py={{ base: 3, md: 5 }}>
      <Flex gap={6} align="flex-start">
        {/* Desktop Sticky Curriculum Sidebar */}
        <Box
          display={{ base: "none", lg: "block" }}
          w="320px"
          flexShrink={0}
          position="sticky"
          top="20px"
          maxH="calc(100vh - 40px)"
          overflowY="auto"
          bg={cardBg}
          borderWidth="2px"
          borderColor={cardBorder}
          rounded="2xl"
          p={4}
          shadow="sm"
        >
          <Button
            size="sm"
            variant="ghost"
            mb={3}
            leftIcon={<IconArrowLeft size={16} />}
            onClick={onBackCatalog}
          >
            All courses
          </Button>
          {renderCurriculum()}
        </Box>

        {/* Main Lesson Area */}
        <Box flex={1} minW={0}>
          <Stack spacing={5}>
            {/* Top Bar */}
            <Flex
              bg={cardBg}
              borderWidth="2px"
              borderColor={cardBorder}
              rounded="2xl"
              p={{ base: 4, md: 5 }}
              justify="space-between"
              align={{ base: "flex-start", md: "center" }}
              direction={{ base: "column", md: "row" }}
              gap={4}
            >
              <Stack spacing={1.5} minW={0}>
                <HStack spacing={2} flexWrap="wrap">
                  <Button
                    display={{ base: "inline-flex", lg: "none" }}
                    size="xs"
                    variant="outline"
                    rounded="lg"
                    leftIcon={<IconArrowLeft size={14} />}
                    onClick={onBackCatalog}
                  >
                    Courses
                  </Button>
                  <Button
                    display={{ base: "inline-flex", lg: "none" }}
                    size="xs"
                    colorScheme="blue"
                    variant="outline"
                    rounded="lg"
                    leftIcon={<IconList size={14} />}
                    onClick={onDrawerOpen}
                  >
                    Curriculum ({currentIdx + 1}/{flatLessons.length})
                  </Button>
                  <Badge
                    colorScheme={lessonMeta.color}
                    rounded="md"
                    px={2}
                    py={0.5}
                  >
                    <HStack spacing={1}>
                      <Icon as={lessonMeta.icon} boxSize={3} />
                      <span>{lessonMeta.label}</span>
                    </HStack>
                  </Badge>
                  <Text
                    fontSize="xs"
                    color={subText}
                    fontWeight={600}
                    noOfLines={1}
                  >
                    {currentEntry?.chapterTitle}
                  </Text>
                </HStack>

                <Heading
                  as="h1"
                  fontFamily={outfit.style.fontFamily}
                  fontSize={{ base: "xl", md: "2xl" }}
                  fontWeight={800}
                >
                  Lesson {activeLesson.globalIndex}: {activeLesson.title}
                </Heading>
              </Stack>

              <HStack spacing={2} flexShrink={0} flexWrap="wrap">
                {onEditCourse && (
                  <Button
                    size="sm"
                    variant="outline"
                    rounded="xl"
                    leftIcon={<IconEdit size={16} />}
                    onClick={onEditCourse}
                  >
                    Edit
                  </Button>
                )}
                <Button
                  size="sm"
                  colorScheme={isCompleted ? "green" : "gray"}
                  variant={isCompleted ? "solid" : "outline"}
                  rounded="xl"
                  leftIcon={<IconCheck size={16} />}
                  onClick={() => onToggleComplete(activeLesson.id)}
                >
                  {isCompleted ? "Completed" : "Mark complete"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  rounded="xl"
                  isDisabled={!prevEntry}
                  onClick={() =>
                    prevEntry && onSelectLesson(prevEntry.lesson.id)
                  }
                  leftIcon={<IconArrowLeft size={16} />}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  colorScheme="blue"
                  rounded="xl"
                  isDisabled={!nextEntry}
                  onClick={() => {
                    if (!isCompleted) onToggleComplete(activeLesson.id, true);
                    if (nextEntry) onSelectLesson(nextEntry.lesson.id);
                  }}
                  rightIcon={<IconArrowRight size={16} />}
                >
                  Next
                </Button>
              </HStack>
            </Flex>

            {/* Lesson Body by Type */}
            {activeLesson.type === "theory" && activeLesson.theory && (
              <Box
                bg={cardBg}
                borderWidth="2px"
                borderColor={cardBorder}
                rounded="2xl"
                p={{ base: 4, md: 8 }}
                shadow="sm"
              >
                <SanitizedHtml html={activeLesson.theory.contentHtml} />
              </Box>
            )}

            {activeLesson.type === "quiz" && (
              <QuizInteractive
                questions={activeLesson.questions ?? []}
                progress={userProgress.quizzes[activeLesson.id]}
                onChangeProgress={(next) => onSaveQuiz(activeLesson.id, next)}
                onMarkLessonComplete={() =>
                  onToggleComplete(activeLesson.id, true)
                }
              />
            )}

            {activeLesson.type === "practice" && activeLesson.practice && (
              <PracticeWorkbench
                track={course.track}
                practice={activeLesson.practice}
                draftCode={userProgress.practiceDrafts[activeLesson.id]}
                isCompleted={isCompleted}
                onSaveDraft={(c) => onSavePracticeDraft(activeLesson.id, c)}
                onToggleComplete={() => onToggleComplete(activeLesson.id)}
              />
            )}

            {/* Bottom Prev / Next Bar */}
            <Flex
              bg={cardBg}
              borderWidth="2px"
              borderColor={cardBorder}
              rounded="2xl"
              p={4}
              direction={{ base: "column", sm: "row" }}
              justify="space-between"
              align={{ base: "stretch", sm: "center" }}
              gap={3}
            >
              <Button
                variant="outline"
                rounded="xl"
                w={{ base: "full", sm: "auto" }}
                maxW={{ base: "full", sm: "360px" }}
                isDisabled={!prevEntry}
                leftIcon={<IconArrowLeft size={16} />}
                onClick={() => prevEntry && onSelectLesson(prevEntry.lesson.id)}
              >
                <Text as="span" isTruncated>
                  {prevEntry
                    ? `Lesson ${prevEntry.lesson.globalIndex}: ${prevEntry.lesson.title}`
                    : "Start of course"}
                </Text>
              </Button>

              <Button
                colorScheme="blue"
                rounded="xl"
                w={{ base: "full", sm: "auto" }}
                isDisabled={!nextEntry}
                rightIcon={<IconArrowRight size={16} />}
                onClick={() => {
                  if (!isCompleted) onToggleComplete(activeLesson.id, true);
                  if (nextEntry) onSelectLesson(nextEntry.lesson.id);
                }}
              >
                {nextEntry
                  ? `Next: Lesson ${nextEntry.lesson.globalIndex}`
                  : "End of course"}
              </Button>
            </Flex>
          </Stack>
        </Box>
      </Flex>

      {/* Mobile Curriculum Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        placement="left"
        onClose={onDrawerClose}
        size="sm"
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader fontFamily={outfit.style.fontFamily}>
            Course curriculum
          </DrawerHeader>
          <DrawerBody pb={8}>{renderCurriculum(onDrawerClose)}</DrawerBody>
        </DrawerContent>
      </Drawer>
    </Container>
  );
};
