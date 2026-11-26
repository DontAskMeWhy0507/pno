import React from "react";

import { outfit } from "@pno/lib/chakra-theme";

import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Progress,
  Stack,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";

import {
  IconBulb,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";

import type { QuizLessonProgress, QuizQuestion } from "../types";

interface QuizInteractiveProps {
  questions: QuizQuestion[];
  progress?: QuizLessonProgress;
  onChangeProgress: (next: QuizLessonProgress) => void;
  onMarkLessonComplete?: () => void;
}

export const QuizInteractive: React.FC<QuizInteractiveProps> = ({
  questions,
  progress,
  onChangeProgress,
  onMarkLessonComplete,
}) => {
  const [revealAll, setRevealAll] = React.useState(false);

  const answers = progress?.answers ?? {};
  const checked = progress?.checked ?? {};

  const cardBg = useColorModeValue("white", "gray.800");
  const cardBorder = useColorModeValue("gray.200", "gray.700");
  const subText = useColorModeValue("gray.600", "gray.400");
  const optionBg = useColorModeValue("gray.50", "gray.750");
  const optionHoverBg = useColorModeValue(
    "blue.50",
    "rgba(75, 131, 255, 0.14)",
  );
  const selectedBg = useColorModeValue("blue.50", "rgba(75, 131, 255, 0.2)");
  const correctBg = useColorModeValue("green.50", "rgba(72, 187, 120, 0.16)");
  const wrongBg = useColorModeValue("red.50", "rgba(245, 101, 101, 0.16)");
  const explainBg = useColorModeValue("amber.50", "rgba(236, 201, 75, 0.12)");
  const explainBorder = useColorModeValue("yellow.300", "yellow.600");
  const explainText = useColorModeValue("gray.800", "gray.100");

  if (questions.length === 0) {
    return (
      <Box
        bg={cardBg}
        borderWidth="2px"
        borderColor={cardBorder}
        rounded="2xl"
        p={6}
      >
        <Stack spacing={4} align="flex-start">
          <Alert status="info" rounded="xl">
            <AlertIcon />
            <Text fontSize="sm">
              No quiz questions are available for this lesson.
            </Text>
          </Alert>
          {onMarkLessonComplete && (
            <Button
              size="sm"
              colorScheme="blue"
              rounded="xl"
              leftIcon={<IconCheck size={16} />}
              onClick={onMarkLessonComplete}
            >
              Mark complete
            </Button>
          )}
        </Stack>
      </Box>
    );
  }

  const checkedCount = questions.filter(
    (q) => checked[q.id] || revealAll,
  ).length;
  const correctCount = questions.filter((q) => {
    const isChecked = checked[q.id] || revealAll;
    return isChecked && answers[q.id] === q.correctIndex;
  }).length;
  const answeredCount = questions.filter(
    (q) => answers[q.id] !== undefined,
  ).length;
  const scorePct = Math.round((correctCount / questions.length) * 100);

  const handleSelect = (qId: string, optionIdx: number) => {
    if (checked[qId]) return;
    onChangeProgress({
      answers: { ...answers, [qId]: optionIdx },
      checked,
    });
  };

  const handleCheckOne = (qId: string) => {
    if (answers[qId] === undefined) return;
    const nextChecked = { ...checked, [qId]: true };
    onChangeProgress({ answers, checked: nextChecked });

    const allChecked = questions.every((q) => nextChecked[q.id]);
    if (allChecked && onMarkLessonComplete) {
      onMarkLessonComplete();
    }
  };

  const handleSubmitAll = () => {
    const nextChecked: Record<string, boolean> = {};
    for (const q of questions) {
      if (answers[q.id] !== undefined) {
        nextChecked[q.id] = true;
      }
    }
    onChangeProgress({ answers, checked: nextChecked });
    if (questions.every((q) => nextChecked[q.id]) && onMarkLessonComplete) {
      onMarkLessonComplete();
    }
  };

  const handleReset = () => {
    setRevealAll(false);
    onChangeProgress({ answers: {}, checked: {} });
  };

  return (
    <Stack spacing={6}>
      {/* Score & Action Summary Bar */}
      <Box
        bg={cardBg}
        borderWidth="2px"
        borderColor={cardBorder}
        rounded="2xl"
        p={4}
      >
        <Flex
          justify="space-between"
          align={{ base: "stretch", md: "center" }}
          direction={{ base: "column", md: "row" }}
          gap={4}
        >
          <Stack spacing={1.5} flex={1}>
            <HStack spacing={2.5} flexWrap="wrap">
              <Text
                fontFamily={outfit.style.fontFamily}
                fontWeight={700}
                fontSize="md"
              >
                Interactive Quiz ({questions.length} questions)
              </Text>
              <Badge colorScheme="blue" rounded="md" px={2} py={0.5}>
                Answered {answeredCount}/{questions.length}
              </Badge>
              {checkedCount > 0 && (
                <Badge
                  colorScheme={scorePct >= 70 ? "green" : "orange"}
                  rounded="md"
                  px={2}
                  py={0.5}
                >
                  Score {correctCount}/{questions.length} ({scorePct}%)
                </Badge>
              )}
            </HStack>
            <Progress
              value={(checkedCount / Math.max(1, questions.length)) * 100}
              size="sm"
              rounded="full"
              colorScheme={scorePct >= 70 ? "green" : "blue"}
            />
          </Stack>

          <HStack spacing={2} flexWrap="wrap">
            <Button
              size="sm"
              colorScheme="blue"
              rounded="xl"
              isDisabled={answeredCount === 0}
              onClick={handleSubmitAll}
              leftIcon={<IconCheck size={16} />}
            >
              Check Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              rounded="xl"
              onClick={() => setRevealAll((v) => !v)}
              leftIcon={
                revealAll ? <IconEyeOff size={16} /> : <IconEye size={16} />
              }
            >
              {revealAll ? "Hide Answers" : "Show Answers"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              rounded="xl"
              onClick={handleReset}
              leftIcon={<IconRefresh size={16} />}
            >
              Reset
            </Button>
          </HStack>
        </Flex>
      </Box>

      {/* Questions */}
      {questions.map((q) => {
        const picked = answers[q.id];
        const isRevealed = Boolean(checked[q.id] || revealAll);
        const isCorrect = picked === q.correctIndex;

        return (
          <Box
            key={q.id}
            bg={cardBg}
            borderWidth="2px"
            borderColor={
              isRevealed
                ? picked === undefined
                  ? "blue.300"
                  : isCorrect
                    ? "green.400"
                    : "red.400"
                : cardBorder
            }
            rounded="2xl"
            p={{ base: 4, md: 6 }}
            shadow="sm"
          >
            <Stack spacing={4}>
              <Flex justify="space-between" align="flex-start" gap={3}>
                <Stack spacing={1} flex={1}>
                  <Text
                    fontSize="xs"
                    fontWeight={800}
                    textTransform="uppercase"
                    color={subText}
                  >
                    Question {q.number}
                  </Text>
                  <Text
                    fontWeight={700}
                    fontSize="md"
                    whiteSpace="pre-wrap"
                    fontFamily="inherit"
                    lineHeight="1.6"
                  >
                    {q.prompt}
                  </Text>
                </Stack>
                {isRevealed && picked !== undefined && (
                  <Badge
                    flexShrink={0}
                    colorScheme={isCorrect ? "green" : "red"}
                    rounded="lg"
                    px={2.5}
                    py={1}
                    fontSize="xs"
                  >
                    {isCorrect ? "Correct" : "Incorrect"}
                  </Badge>
                )}
              </Flex>

              <Stack spacing={2.5}>
                {q.options.map((opt, idx) => {
                  const isSelected = picked === idx;
                  const isAnswer = idx === q.correctIndex;

                  let bg = optionBg;
                  let borderColor = cardBorder;
                  if (isRevealed) {
                    if (isAnswer) {
                      bg = correctBg;
                      borderColor = "green.500";
                    } else if (isSelected && !isAnswer) {
                      bg = wrongBg;
                      borderColor = "red.500";
                    }
                  } else if (isSelected) {
                    bg = selectedBg;
                    borderColor = "blue.500";
                  }

                  return (
                    <Box
                      key={`${q.id}-${opt.label}`}
                      as="button"
                      type="button"
                      w="full"
                      textAlign="left"
                      px={4}
                      py={3}
                      rounded="xl"
                      bg={bg}
                      borderWidth="2px"
                      borderColor={borderColor}
                      cursor={checked[q.id] ? "default" : "pointer"}
                      transition="all 0.15s ease"
                      _hover={
                        checked[q.id]
                          ? undefined
                          : { bg: isSelected ? selectedBg : optionHoverBg }
                      }
                      onClick={() => handleSelect(q.id, idx)}
                      aria-pressed={isSelected}
                    >
                      <Flex align="center" justify="space-between" gap={3}>
                        <HStack align="flex-start" spacing={3}>
                          <Badge
                            colorScheme={
                              isRevealed && isAnswer
                                ? "green"
                                : isRevealed && isSelected && !isAnswer
                                  ? "red"
                                  : isSelected
                                    ? "blue"
                                    : "gray"
                            }
                            rounded="md"
                            px={2}
                            py={0.5}
                            mt={0.5}
                            fontWeight={700}
                          >
                            {opt.label}
                          </Badge>
                          <Text
                            fontSize="sm"
                            fontWeight={
                              isSelected || (isRevealed && isAnswer) ? 600 : 500
                            }
                            lineHeight="1.55"
                          >
                            {opt.text}
                          </Text>
                        </HStack>

                        {isRevealed && isAnswer && (
                          <HStack spacing={1} color="green.500" flexShrink={0}>
                            <Icon as={IconCheck} boxSize={4} />
                            <Text fontSize="xs" fontWeight={700}>
                              Correct
                            </Text>
                          </HStack>
                        )}
                        {isRevealed && isSelected && !isAnswer && (
                          <HStack spacing={1} color="red.500" flexShrink={0}>
                            <Icon as={IconX} boxSize={4} />
                            <Text fontSize="xs" fontWeight={700}>
                              Wrong
                            </Text>
                          </HStack>
                        )}
                      </Flex>
                    </Box>
                  );
                })}
              </Stack>

              {!checked[q.id] && !revealAll && (
                <Flex justify="flex-end">
                  <Button
                    size="sm"
                    colorScheme="blue"
                    variant="outline"
                    rounded="xl"
                    isDisabled={picked === undefined}
                    onClick={() => handleCheckOne(q.id)}
                    leftIcon={<IconCheck size={15} />}
                  >
                    Check Question {q.number}
                  </Button>
                </Flex>
              )}

              {isRevealed && q.explanation && (
                <Box
                  bg={explainBg}
                  borderWidth="1px"
                  borderColor={explainBorder}
                  rounded="xl"
                  p={4}
                >
                  <HStack
                    spacing={2}
                    mb={1.5}
                    color="yellow.600"
                    _dark={{ color: "yellow.300" }}
                  >
                    <Icon as={IconBulb} boxSize={4} />
                    <Text
                      fontSize="xs"
                      fontWeight={800}
                      textTransform="uppercase"
                    >
                      Explanation
                    </Text>
                  </HStack>
                  <Text
                    fontSize="sm"
                    color={explainText}
                    lineHeight="1.65"
                    whiteSpace="pre-wrap"
                  >
                    {q.explanation}
                  </Text>
                </Box>
              )}
              {!isRevealed && picked === undefined && (
                <Text fontSize="xs" color={subText}>
                  Select an option to check your answer.
                </Text>
              )}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
};
