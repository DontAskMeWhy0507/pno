import React, { useEffect, useMemo, useState, type FC } from 'react';
import { outfit } from '@pno/lib/chakra-theme';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  IconArrowLeft,
  IconBook,
  IconBulb,
  IconCheck,
  IconClock,
  IconEye,
  IconHeadphones,
  IconListDetails,
  IconMicrophone,
  IconPencil,
  IconPlayerPlay,
  IconRotateClockwise,
  IconTrash,
} from '@tabler/icons-react';
import type { Exam, QuestionType } from '../../types/exam';
import type { WritingExam } from '../../types/writing';
import type { SpeakingExam } from '../../types/speaking';
import type { CloudAttemptRow } from '../../utils/cloudSync';
import {
  getExamCollection,
  getExamPartCount,
  getExamQuestionCount,
  isListeningExam,
  loadFullExam,
} from '../../utils/storage';
import { getSavedExamSummary } from '../../utils/examProgress';
import { getSavedWritingSummary, loadSpeakingProgress } from '../../utils/writingProgress';

export type DetailTarget =
  | { kind: 'exam'; exam: Exam }
  | { kind: 'writing'; exam: WritingExam }
  | { kind: 'speaking'; exam: SpeakingExam };

export interface StartExamOptions {
  mode: 'full' | 'practice';
  selectedParts?: number[];
  timeLimitMinutes?: number | null;
  fresh?: boolean;
}

interface TestDetailViewProps {
  target: DetailTarget;
  attempts: CloudAttemptRow[];
  progressVersion: number;
  onBack: () => void;
  onStartExam: (exam: Exam, options?: StartExamOptions) => void;
  onResumeExam: (exam: Exam) => void;
  onDiscardExam: (exam: Exam) => void;
  onStartWriting: (exam: WritingExam, fresh?: boolean) => void;
  onDiscardWriting: (examId: string, title: string) => void;
  onStartSpeaking: (exam: SpeakingExam, fresh?: boolean) => void;
  onDiscardSpeaking: (examId: string, title: string) => void;
  onViewAttemptDetail: (attempt: CloudAttemptRow, examTarget: DetailTarget) => void;
  onDeleteAttempt?: (attemptId: string) => void;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  TRUE_FALSE_NOT_GIVEN: 'True / False / Not Given',
  YES_NO_NOT_GIVEN: 'Yes / No / Not Given',
  MULTIPLE_CHOICE_SINGLE: 'Multiple Choice',
  MULTIPLE_CHOICE_MULTI: 'Multiple Choice (Multi)',
  FILL_IN_BLANK: 'Note / Summary / Table Completion',
  MATCHING: 'Matching',
};

function formatDurationClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDateEn(dateValue: Date | string): string {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

export const TestDetailView: FC<TestDetailViewProps> = ({
  target,
  attempts,
  progressVersion,
  onBack,
  onStartExam,
  onResumeExam,
  onDiscardExam,
  onStartWriting,
  onDiscardWriting,
  onStartSpeaking,
  onDiscardSpeaking,
  onViewAttemptDetail,
  onDeleteAttempt,
}) => {
  const [fullExam, setFullExam] = useState<Exam | null>(
    target.kind === 'exam' && target.exam.parts?.length ? target.exam : null
  );
  const [infoTab, setInfoTab] = useState<'info' | 'answers'>('info');
  const [modeTab, setModeTab] = useState<'full' | 'practice'>('full');
  const [selectedParts, setSelectedParts] = useState<number[]>([]);
  const [practiceMinutes, setPracticeMinutes] = useState<string>('');
  const [legacySummaryAttempt, setLegacySummaryAttempt] = useState<CloudAttemptRow | null>(null);
  const [writingAttemptDetail, setWritingAttemptDetail] = useState<CloudAttemptRow | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const subtleBg = useColorModeValue('gray.50', 'gray.900');
  const secondaryColor = useColorModeValue('gray.600', 'gray.400');
  const tipBg = useColorModeValue('green.50', 'rgba(56, 161, 105, 0.14)');
  const tipBorder = useColorModeValue('green.200', 'green.700');
  const tipText = useColorModeValue('green.800', 'green.200');
  const inProgBg = useColorModeValue('emerald.50', 'rgba(16, 185, 129, 0.14)');
  const inProgBorder = useColorModeValue('emerald.300', 'emerald.600');
  const tagBg = useColorModeValue('gray.100', 'gray.700');
  const tableHeadBg = useColorModeValue('gray.50', 'gray.750');

  useEffect(() => {
    setInfoTab('info');
    setModeTab('full');
    setPracticeMinutes('');

    if (target.kind !== 'exam') {
      setFullExam(null);
      setSelectedParts([]);
      return;
    }

    let cancelled = false;
    if (target.exam.parts && target.exam.parts.length > 0) {
      setFullExam(target.exam);
      setSelectedParts(target.exam.parts.map((p) => p.partNumber));
      return;
    }

    setFullExam(null);
    const defaultCount = getExamPartCount(target.exam) || 3;
    setSelectedParts(Array.from({ length: defaultCount }, (_, i) => i + 1));

    loadFullExam(target.exam)
      .then((loaded) => {
        if (!cancelled && loaded) {
          setFullExam(loaded);
          if (loaded.parts?.length) {
            setSelectedParts(loaded.parts.map((p) => p.partNumber));
          }
        }
      })
      .catch(() => {
        // Fallback to summary metadata if lazy load fails
      });

    return () => {
      cancelled = true;
    };
  }, [target]);

  const sortedAttempts = useMemo(
    () =>
      [...attempts].sort(
        (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      ),
    [attempts]
  );

  // Derived metadata depending on skill
  const isExam = target.kind === 'exam';
  const isListen = isExam && isListeningExam(target.exam);
  const collectionName =
    target.kind === 'exam'
      ? getExamCollection(target.exam)
      : target.exam.collection || (target.kind === 'writing' ? 'IELTS Writing' : 'IELTS Speaking');
  const skillLabel =
    target.kind === 'exam'
      ? isListen
        ? 'Listening'
        : 'Reading'
      : target.kind === 'writing'
        ? 'Writing'
        : 'Speaking';
  const skillColor =
    target.kind === 'exam'
      ? isListen
        ? 'purple'
        : 'blue'
      : target.kind === 'writing'
        ? 'orange'
        : 'pink';
  const SkillIcon =
    target.kind === 'exam'
      ? isListen
        ? IconHeadphones
        : IconBook
      : target.kind === 'writing'
        ? IconPencil
        : IconMicrophone;

  // In-progress summary
  void progressVersion;
  const savedExam = target.kind === 'exam' ? getSavedExamSummary(target.exam.id) : null;
  const savedWriting = target.kind === 'writing' ? getSavedWritingSummary(target.exam.id) : null;
  const savedSpeaking = target.kind === 'speaking' ? loadSpeakingProgress(target.exam.id) : null;
  const hasInProgress = Boolean(savedExam || savedWriting || savedSpeaking);

  const effectiveExam = fullExam ?? (target.kind === 'exam' ? target.exam : null);
  const totalQuestions = effectiveExam ? getExamQuestionCount(effectiveExam) : 0;
  const totalParts = effectiveExam ? getExamPartCount(effectiveExam) : target.kind === 'writing' ? 2 : 3;
  const durationMinutes =
    target.kind === 'exam'
      ? target.exam.durationMinutes || (isListen ? 30 : 60)
      : target.kind === 'writing'
        ? target.exam.durationMinutes || 60
        : 15;

  const togglePartSelection = (partNumber: number) => {
    setSelectedParts((prev) =>
      prev.includes(partNumber)
        ? prev.filter((n) => n !== partNumber)
        : [...prev, partNumber].sort((a, b) => a - b)
    );
  };

  const handleStartPractice = () => {
    if (target.kind !== 'exam' || selectedParts.length === 0) return;
    const parsedMins = practiceMinutes.trim() ? Number(practiceMinutes) : null;
    onStartExam(target.exam, {
      mode: 'practice',
      selectedParts,
      timeLimitMinutes: parsedMins && Number.isFinite(parsedMins) ? parsedMins : null,
      fresh: true,
    });
  };

  const handleStartFull = () => {
    if (target.kind === 'exam') {
      if (
        hasInProgress &&
        !window.confirm(
          'You have an unfinished session in progress. Starting a new Full Test will overwrite your saved draft. Continue?'
        )
      ) {
        return;
      }
      onStartExam(target.exam, { mode: 'full', fresh: true });
    } else if (target.kind === 'writing') {
      if (
        hasInProgress &&
        !window.confirm(
          'You have an unfinished Writing draft. Starting a new attempt will clear your current draft. Continue?'
        )
      ) {
        return;
      }
      onStartWriting(target.exam, true);
    } else {
      onStartSpeaking(target.exam, true);
    }
  };

  const handleAttemptAction = (attempt: CloudAttemptRow) => {
    if (target.kind === 'exam' && !attempt.details?.answers) {
      setLegacySummaryAttempt(attempt);
      return;
    }
    if (target.kind === 'writing') {
      setWritingAttemptDetail(attempt);
      return;
    }
    onViewAttemptDetail(attempt, target);
  };

  return (
    <Stack spacing={5}>
      {/* Top Back Row */}
      <Flex justify="space-between" align="center" flexWrap="wrap" gap={3}>
        <Button
          size="sm"
          variant="outline"
          rounded="xl"
          leftIcon={<IconArrowLeft size={16} />}
          onClick={onBack}
        >
          Back
        </Button>
      </Flex>

      {/* Main Study4-inspired Detail Card */}
      <Box
        bg={cardBg}
        borderWidth="2px"
        borderColor={cardBorder}
        rounded="2xl"
        p={{ base: 4, md: 6 }}
        shadow="sm"
      >
        <Stack spacing={5}>
          {/* Tags + Title + Completed Badge */}
          <Stack spacing={2.5}>
            <HStack spacing={2} flexWrap="wrap">
              <Badge bg={tagBg} color={secondaryColor} px={2.5} py={0.5} rounded="full" fontSize="xs">
                #{collectionName}
              </Badge>
              <Badge
                colorScheme={skillColor}
                variant="subtle"
                px={2.5}
                py={0.5}
                rounded="full"
                fontSize="xs"
              >
                <HStack spacing={1}>
                  <Icon as={SkillIcon} boxSize={3.5} />
                  <Text>#{skillLabel}</Text>
                </HStack>
              </Badge>
            </HStack>

            <HStack spacing={2.5} align="center" flexWrap="wrap">
              <Heading size="lg" fontFamily={outfit.style.fontFamily}>
                {target.exam.title}
              </Heading>
              {sortedAttempts.length > 0 && (
                <Flex
                  align="center"
                  justify="center"
                  w={6}
                  h={6}
                  rounded="full"
                  bg="green.500"
                  color="white"
                  title={`Completed (${sortedAttempts.length} attempts)`}
                >
                  <IconCheck size={14} stroke={3} />
                </Flex>
              )}
            </HStack>

            {/* Sub-tabs: Test Overview | Answers / Transcript */}
            {isExam && (
              <HStack spacing={2} pt={1}>
                <Button
                  size="xs"
                  rounded="lg"
                  variant={infoTab === 'info' ? 'solid' : 'outline'}
                  colorScheme={infoTab === 'info' ? 'blue' : 'gray'}
                  onClick={() => setInfoTab('info')}
                >
                  Test Overview
                </Button>
                <Button
                  size="xs"
                  rounded="lg"
                  variant={infoTab === 'answers' ? 'solid' : 'outline'}
                  colorScheme={infoTab === 'answers' ? 'blue' : 'gray'}
                  onClick={() => setInfoTab('answers')}
                >
                  {isListen ? 'Answer Key / Transcript' : 'Answer Key'}
                </Button>
              </HStack>
            )}

            {/* Meta Info */}
            <Stack spacing={1} pt={1} fontSize="sm" color={secondaryColor}>
              <HStack spacing={2} flexWrap="wrap">
                <IconClock size={16} />
                {isExam ? (
                  <Text>
                    Duration: <strong>{durationMinutes} min</strong> |{' '}
                    <strong>{totalParts}</strong> {isListen ? 'sections' : 'passages'} |{' '}
                    <strong>{totalQuestions}</strong> questions
                  </Text>
                ) : target.kind === 'writing' ? (
                  <Text>
                    Duration: <strong>{durationMinutes} min</strong> | Task 1 (150+ words) &amp; Task 2 (250+ words)
                  </Text>
                ) : (
                  <Text>
                    3 Parts: Part 1 ({target.exam.part1Questions.length} Qs) • Part 2 Cue Card • Part 3 ({target.exam.part3Questions.length} Qs)
                  </Text>
                )}
              </HStack>
              {isExam && (
                <Text fontSize="xs" color="red.400" fontStyle="italic">
                  Note: To receive an official IELTS Band Score (0–9.0), please choose Full Test mode.
                </Text>
              )}
            </Stack>
          </Stack>

          {infoTab === 'answers' && effectiveExam ? (
            <Stack spacing={4}>
              <Divider />
              {effectiveExam.parts.map((part) => (
                <Box
                  key={part.id}
                  p={4}
                  bg={subtleBg}
                  borderWidth="1px"
                  borderColor={cardBorder}
                  rounded="xl"
                >
                  <Stack spacing={3}>
                    <Heading size="sm" fontFamily={outfit.style.fontFamily}>
                      {isListen ? `Recording ${part.partNumber}` : `Passage ${part.partNumber}`}:{' '}
                      {part.title}
                    </Heading>
                    <Flex flexWrap="wrap" gap={2}>
                      {part.questionGroups
                        .flatMap((g) => g.questions)
                        .sort((a, b) => a.orderNumber - b.orderNumber)
                        .map((q) => (
                          <Badge
                            key={q.id}
                            variant="subtle"
                            colorScheme="blue"
                            px={2.5}
                            py={1}
                            rounded="md"
                            fontSize="xs"
                          >
                            Q{q.orderNumber}:{' '}
                            {Array.isArray(q.correctAnswer)
                              ? q.correctAnswer.join(', ')
                              : q.correctAnswer}
                          </Badge>
                        ))}
                    </Flex>
                    {isListen && part.passage && (
                      <Box
                        mt={1}
                        p={3}
                        bg={cardBg}
                        borderWidth="1px"
                        borderColor={cardBorder}
                        rounded="lg"
                        maxH="200px"
                        overflowY="auto"
                      >
                        <Text fontSize="xs" fontWeight={700} mb={1}>
                          Audio Transcript
                        </Text>
                        <Text fontSize="xs" color={secondaryColor} whiteSpace="pre-line">
                          {part.passage}
                        </Text>
                      </Box>
                    )}
                  </Stack>
                </Box>
              ))}
            </Stack>
          ) : (
            <>
              {/* Active In-Progress Banner (only when user has an unfinished session) */}
              {hasInProgress && (
                <Box
                  bg={inProgBg}
                  borderWidth="2px"
                  borderColor={inProgBorder}
                  rounded="xl"
                  p={4}
                >
                  <Flex
                    justify="space-between"
                    align={{ base: 'start', sm: 'center' }}
                    direction={{ base: 'column', sm: 'row' }}
                    gap={3}
                  >
                    <Stack spacing={0.5}>
                      <HStack spacing={2}>
                        <Box w={2.5} h={2.5} rounded="full" bg="emerald.500" />
                        <Text fontWeight={700} fontSize="sm">
                          You have a session in progress
                        </Text>
                      </HStack>
                      <Text fontSize="xs" color={secondaryColor}>
                        {savedExam
                          ? `Answered ${savedExam.answeredCount}/${totalQuestions} questions • ${Math.ceil(savedExam.timeRemaining / 60)} min left`
                          : savedWriting
                            ? `Task 1: ${savedWriting.task1Words} words • Task 2: ${savedWriting.task2Words} words • ${Math.ceil(savedWriting.timeRemaining / 60)} min left`
                            : savedSpeaking
                              ? `Currently on Part ${savedSpeaking.activePart}`
                              : ''}
                      </Text>
                    </Stack>

                    <HStack spacing={2}>
                      <Button
                        size="sm"
                        colorScheme="green"
                        rounded="xl"
                        leftIcon={<IconPlayerPlay size={15} />}
                        onClick={() => {
                          if (target.kind === 'exam') onResumeExam(target.exam);
                          else if (target.kind === 'writing') onStartWriting(target.exam);
                          else onStartSpeaking(target.exam);
                        }}
                      >
                        Resume Test
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        colorScheme="red"
                        rounded="xl"
                        leftIcon={<IconRotateClockwise size={15} />}
                        onClick={() => {
                          if (target.kind === 'exam') onDiscardExam(target.exam);
                          else if (target.kind === 'writing')
                            onDiscardWriting(target.exam.id, target.exam.title);
                          else onDiscardSpeaking(target.exam.id, target.exam.title);
                        }}
                      >
                        Discard Draft
                      </Button>
                    </HStack>
                  </Flex>
                </Box>
              )}

              {/* Results Table (Multiple Attempts) */}
              <Stack spacing={2.5}>
                <Text fontWeight={700} fontSize="sm">
                  Your Attempt History ({sortedAttempts.length} {sortedAttempts.length === 1 ? 'attempt' : 'attempts'}):
                </Text>

                {sortedAttempts.length === 0 ? (
                  <Box
                    p={4}
                    bg={subtleBg}
                    borderWidth="1px"
                    borderColor={cardBorder}
                    rounded="xl"
                  >
                    <Text fontSize="xs" color={secondaryColor}>
                      You have not completed any attempts for this test yet. Choose a mode below to begin.
                    </Text>
                  </Box>
                ) : (
                  <Box
                    borderWidth="1px"
                    borderColor={cardBorder}
                    rounded="xl"
                    overflowX="auto"
                  >
                    <Table size="sm" variant="simple">
                      <Thead bg={tableHeadBg}>
                        <Tr>
                          <Th>Date</Th>
                          <Th>Result</Th>
                          <Th>Time Spent</Th>
                          <Th isNumeric></Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {sortedAttempts.map((attempt) => {
                          const isPractice = attempt.details?.mode === 'practice';
                          return (
                            <Tr key={attempt.id}>
                              <Td>
                                <Stack spacing={1} align="start">
                                  <Text fontSize="sm" fontWeight={500}>
                                    {formatDateEn(attempt.completedAt)}
                                  </Text>
                                  <Badge
                                    colorScheme={isPractice ? 'orange' : 'green'}
                                    fontSize="10px"
                                    rounded="md"
                                    px={1.5}
                                  >
                                    {isPractice ? 'Practice' : 'Full test'}
                                  </Badge>
                                </Stack>
                              </Td>
                              <Td>
                                {attempt.skill === 'Writing' ? (
                                  <Text fontSize="sm" fontWeight={600}>
                                    Task 1: {attempt.details?.task1Words ?? 0}w • Task 2:{' '}
                                    {attempt.details?.task2Words ?? 0}w
                                  </Text>
                                ) : (
                                  <HStack spacing={2} flexWrap="wrap">
                                    <Text fontSize="sm" fontWeight={600}>
                                      {attempt.totalCorrect}/{attempt.totalQuestions}
                                    </Text>
                                    {!isPractice &&
                                      attempt.bandScore !== null &&
                                      attempt.bandScore !== undefined && (
                                        <Badge colorScheme="blue" rounded="md" fontSize="xs">
                                          Band {attempt.bandScore.toFixed(1)}
                                        </Badge>
                                      )}
                                  </HStack>
                                )}
                              </Td>
                              <Td fontSize="sm">{formatDurationClock(attempt.timeSpentSeconds)}</Td>
                              <Td isNumeric>
                                <HStack spacing={1} justify="flex-end">
                                  <Button
                                    size="xs"
                                    variant="link"
                                    colorScheme="blue"
                                    leftIcon={<IconEye size={14} />}
                                    onClick={() => handleAttemptAction(attempt)}
                                  >
                                    View Details
                                  </Button>
                                  {onDeleteAttempt && (
                                    <IconButton
                                      aria-label="Delete attempt"
                                      icon={<IconTrash size={14} />}
                                      size="xs"
                                      variant="ghost"
                                      colorScheme="red"
                                      onClick={() => onDeleteAttempt(attempt.id)}
                                    />
                                  )}
                                </HStack>
                              </Td>
                            </Tr>
                          );
                        })}
                      </Tbody>
                    </Table>
                  </Box>
                )}
              </Stack>

              <Divider />

              {/* Mode Tabs & Action Controls */}
              {isExam ? (
                <Stack spacing={4}>
                  <HStack borderBottomWidth="1px" borderColor={cardBorder} spacing={4}>
                    <Button
                      variant="unstyled"
                      pb={2.5}
                      fontSize="sm"
                      fontWeight={modeTab === 'full' ? 700 : 500}
                      color={modeTab === 'full' ? 'blue.500' : secondaryColor}
                      borderBottomWidth="2px"
                      borderColor={modeTab === 'full' ? 'blue.500' : 'transparent'}
                      rounded="none"
                      onClick={() => setModeTab('full')}
                    >
                      Full Test
                    </Button>
                    <Button
                      variant="unstyled"
                      pb={2.5}
                      fontSize="sm"
                      fontWeight={modeTab === 'practice' ? 700 : 500}
                      color={modeTab === 'practice' ? 'blue.500' : secondaryColor}
                      borderBottomWidth="2px"
                      borderColor={modeTab === 'practice' ? 'blue.500' : 'transparent'}
                      rounded="none"
                      onClick={() => setModeTab('practice')}
                    >
                      Practice Mode
                    </Button>
                  </HStack>

                  {modeTab === 'full' ? (
                    <Stack spacing={4}>
                      <Box
                        bg={tipBg}
                        borderWidth="1px"
                        borderColor={tipBorder}
                        rounded="xl"
                        p={3.5}
                      >
                        <HStack align="start" spacing={2}>
                          <Icon as={IconBulb} boxSize={4} color="green.500" mt={0.5} flexShrink={0} />
                          <Text fontSize="xs" color={tipText}>
                            Full Test mode includes all <strong>{totalParts} sections</strong> with a{' '}
                            <strong>{durationMinutes}-minute</strong> timer to calculate an accurate IELTS 9.0 Band Score.
                          </Text>
                        </HStack>
                      </Box>

                      <Box>
                        <Button
                          colorScheme="blue"
                          rounded="xl"
                          size="md"
                          leftIcon={<IconPlayerPlay size={16} />}
                          onClick={handleStartFull}
                        >
                          {hasInProgress ? 'Start New Full Test' : 'Start Full Test'}
                        </Button>
                      </Box>
                    </Stack>
                  ) : (
                    <Stack spacing={4}>
                      <Box
                        bg={tipBg}
                        borderWidth="1px"
                        borderColor={tipBorder}
                        rounded="xl"
                        p={3.5}
                      >
                        <HStack align="start" spacing={2}>
                          <Icon as={IconBulb} boxSize={4} color="green.500" mt={0.5} flexShrink={0} />
                          <Text fontSize="xs" color={tipText}>
                            Pro tip: Practicing individual sections with a flexible time limit lets you focus on accuracy without full-exam time pressure.
                          </Text>
                        </HStack>
                      </Box>

                      <Stack spacing={3}>
                        <Text fontSize="sm" fontWeight={700}>
                          Select sections to practice
                        </Text>

                        {effectiveExam?.parts && effectiveExam.parts.length > 0 ? (
                          effectiveExam.parts.map((part) => {
                            const partQCount = part.questionGroups.reduce(
                              (sum, g) => sum + g.questions.length,
                              0
                            );
                            const types = Array.from(
                              new Set(
                                part.questionGroups.flatMap((g) => g.questions.map((q) => q.type))
                              )
                            );
                            const checked = selectedParts.includes(part.partNumber);
                            return (
                              <Box
                                key={part.id}
                                p={3}
                                rounded="xl"
                                borderWidth="1px"
                                borderColor={checked ? 'blue.400' : cardBorder}
                                bg={subtleBg}
                              >
                                <Checkbox
                                  isChecked={checked}
                                  onChange={() => togglePartSelection(part.partNumber)}
                                  colorScheme="blue"
                                  fontWeight={600}
                                >
                                  <Text fontSize="sm" fontWeight={600}>
                                    {isListen ? `Recording ${part.partNumber}` : `Part ${part.partNumber}`}
                                    {part.title ? `: ${part.title}` : ''} ({partQCount} questions)
                                  </Text>
                                </Checkbox>
                                {types.length > 0 && (
                                  <Flex flexWrap="wrap" gap={1.5} mt={2} pl={6}>
                                    {types.map((t) => (
                                      <Badge
                                        key={t}
                                        bg={tagBg}
                                        color={secondaryColor}
                                        fontSize="10px"
                                        px={2}
                                        py={0.5}
                                        rounded="md"
                                        textTransform="none"
                                      >
                                        #[{skillLabel}] {QUESTION_TYPE_LABELS[t] || t}
                                      </Badge>
                                    ))}
                                  </Flex>
                                )}
                              </Box>
                            );
                          })
                        ) : (
                          Array.from({ length: totalParts }, (_, i) => i + 1).map((partNumber) => (
                            <Box
                              key={partNumber}
                              p={3}
                              rounded="xl"
                              borderWidth="1px"
                              borderColor={cardBorder}
                              bg={subtleBg}
                            >
                              <Checkbox
                                isChecked={selectedParts.includes(partNumber)}
                                onChange={() => togglePartSelection(partNumber)}
                                colorScheme="blue"
                              >
                                <Text fontSize="sm" fontWeight={600}>
                                  {isListen ? `Recording ${partNumber}` : `Part ${partNumber}`}
                                </Text>
                              </Checkbox>
                            </Box>
                          ))
                        )}
                      </Stack>

                      <Box maxW="360px">
                        <Text fontSize="sm" fontWeight={600} mb={1.5}>
                          Time Limit (Leave empty for untimed practice)
                        </Text>
                        <Select
                          size="sm"
                          rounded="xl"
                          value={practiceMinutes}
                          onChange={(e) => setPracticeMinutes(e.target.value)}
                          placeholder="-- No Time Limit --"
                        >
                          <option value="10">10 minutes</option>
                          <option value="15">15 minutes</option>
                          <option value="20">20 minutes</option>
                          <option value="30">30 minutes</option>
                          <option value="40">40 minutes</option>
                          <option value="45">45 minutes</option>
                          <option value="60">60 minutes</option>
                        </Select>
                      </Box>

                      <Box>
                        <Button
                          colorScheme="blue"
                          rounded="xl"
                          size="md"
                          isDisabled={selectedParts.length === 0}
                          leftIcon={<IconPlayerPlay size={16} />}
                          onClick={handleStartPractice}
                        >
                          START PRACTICE ({selectedParts.length} {selectedParts.length === 1 ? 'part' : 'parts'})
                        </Button>
                      </Box>
                    </Stack>
                  )}
                </Stack>
              ) : target.kind === 'writing' ? (
                <Stack spacing={4}>
                  <Box p={4} bg={subtleBg} borderWidth="1px" borderColor={cardBorder} rounded="xl">
                    <Stack spacing={2} fontSize="xs" color={secondaryColor}>
                      <Text>
                        <strong>Task 1:</strong> {target.exam.task1.prompt}
                      </Text>
                      <Text>
                        <strong>Task 2:</strong> {target.exam.task2.prompt}
                      </Text>
                    </Stack>
                  </Box>
                  <Box>
                    <Button
                      colorScheme="blue"
                      rounded="xl"
                      leftIcon={<IconPlayerPlay size={16} />}
                      onClick={handleStartFull}
                    >
                      {hasInProgress ? 'Start New Writing Draft' : 'Start Writing Test'}
                    </Button>
                  </Box>
                </Stack>
              ) : (
                <Stack spacing={4}>
                  <Box p={4} bg={subtleBg} borderWidth="1px" borderColor={cardBorder} rounded="xl">
                    <Stack spacing={1.5} fontSize="xs" color={secondaryColor}>
                      <Text>
                        <strong>Part 1:</strong> {target.exam.part1Questions.length} interview questions
                      </Text>
                      <Text>
                        <strong>Part 2 Cue Card:</strong> {target.exam.part2Question.questionText}
                      </Text>
                      <Text>
                        <strong>Part 3:</strong> {target.exam.part3Questions.length} discussion questions
                      </Text>
                    </Stack>
                  </Box>
                  <Box>
                    <Button
                      colorScheme="blue"
                      rounded="xl"
                      leftIcon={<IconMicrophone size={16} />}
                      onClick={() => onStartSpeaking(target.exam, true)}
                    >
                      Start Speaking Practice
                    </Button>
                  </Box>
                </Stack>
              )}
            </>
          )}
        </Stack>
      </Box>

      {/* Legacy Attempt Summary Modal (for Reading/Listening attempts saved without per-question answers) */}
      <Modal
        isOpen={Boolean(legacySummaryAttempt)}
        onClose={() => setLegacySummaryAttempt(null)}
        isCentered
        size="lg"
      >
        <ModalOverlay />
        <ModalContent rounded="2xl">
          <ModalHeader fontFamily={outfit.style.fontFamily}>
            <HStack spacing={2}>
              <Icon as={IconListDetails} color="blue.500" />
              <Text>Attempt Result Summary</Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {legacySummaryAttempt && (
              <Stack spacing={4}>
                <Text fontSize="sm" color={secondaryColor}>
                  {legacySummaryAttempt.examTitle} • {formatDateEn(legacySummaryAttempt.completedAt)}
                </Text>
                <Flex gap={3} flexWrap="wrap">
                  {legacySummaryAttempt.bandScore !== null &&
                    legacySummaryAttempt.bandScore !== undefined && (
                      <Box flex={1} minW="120px" p={3} bg={subtleBg} rounded="xl" borderWidth="1px">
                        <Text fontSize="xs" color={secondaryColor}>
                          Band Score
                        </Text>
                        <Text fontSize="2xl" fontWeight={800} color="blue.500">
                          {legacySummaryAttempt.bandScore.toFixed(1)}
                        </Text>
                      </Box>
                    )}
                  <Box flex={1} minW="120px" p={3} bg={subtleBg} rounded="xl" borderWidth="1px">
                    <Text fontSize="xs" color={secondaryColor}>
                      Correct Answers
                    </Text>
                    <Text fontSize="2xl" fontWeight={800}>
                      {legacySummaryAttempt.totalCorrect}/{legacySummaryAttempt.totalQuestions}
                    </Text>
                  </Box>
                  <Box flex={1} minW="120px" p={3} bg={subtleBg} rounded="xl" borderWidth="1px">
                    <Text fontSize="xs" color={secondaryColor}>
                      Time Spent
                    </Text>
                    <Text fontSize="2xl" fontWeight={800}>
                      {formatDurationClock(legacySummaryAttempt.timeSpentSeconds)}
                    </Text>
                  </Box>
                </Flex>

                {legacySummaryAttempt.details?.partScores && (
                  <Stack spacing={2}>
                    <Text fontSize="xs" fontWeight={700}>
                      Score by Section:
                    </Text>
                    <Flex gap={2} flexWrap="wrap">
                      {Object.entries(legacySummaryAttempt.details.partScores).map(
                        ([partNum, stats]) => (
                          <Badge key={partNum} colorScheme="purple" px={2.5} py={1} rounded="lg">
                            Part {partNum}: {stats.correct}/{stats.total}
                          </Badge>
                        )
                      )}
                    </Flex>
                  </Stack>
                )}

                <Text fontSize="xs" color={secondaryColor} fontStyle="italic">
                  This attempt was saved before per-question review details were enabled. Newer attempts record full answers for Review Mode.
                </Text>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setLegacySummaryAttempt(null)} rounded="xl">
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Writing Attempt Detail Modal */}
      <Modal
        isOpen={Boolean(writingAttemptDetail && target.kind === 'writing')}
        onClose={() => setWritingAttemptDetail(null)}
        isCentered
        size="3xl"
        scrollBehavior="inside"
      >
        <ModalOverlay />
        <ModalContent rounded="2xl">
          <ModalHeader fontFamily={outfit.style.fontFamily}>
            Writing Submission Details
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {writingAttemptDetail && target.kind === 'writing' && (
              <Stack spacing={4}>
                <HStack justify="space-between" flexWrap="wrap">
                  <Text fontSize="sm" color={secondaryColor}>
                    Submitted: {formatDateEn(writingAttemptDetail.completedAt)} • Time:{' '}
                    {formatDurationClock(writingAttemptDetail.timeSpentSeconds)}
                  </Text>
                  <HStack spacing={2}>
                    <Badge colorScheme="orange">
                      Task 1: {writingAttemptDetail.details?.task1Words ?? 0} words
                    </Badge>
                    <Badge colorScheme="purple">
                      Task 2: {writingAttemptDetail.details?.task2Words ?? 0} words
                    </Badge>
                  </HStack>
                </HStack>

                <Box p={4} bg={subtleBg} rounded="xl" borderWidth="1px" borderColor={cardBorder}>
                  <Text fontSize="xs" fontWeight={700} color="blue.500" mb={1}>
                    TASK 1 ({writingAttemptDetail.details?.task1Words ?? 0} words)
                  </Text>
                  <Text fontSize="xs" color={secondaryColor} mb={2}>
                    {target.exam.task1.prompt}
                  </Text>
                  <Box
                    p={3}
                    bg={cardBg}
                    rounded="lg"
                    borderWidth="1px"
                    borderColor={cardBorder}
                    whiteSpace="pre-wrap"
                    fontSize="sm"
                  >
                    {writingAttemptDetail.details?.task1Text || '(No response)'}
                  </Box>
                </Box>

                <Box p={4} bg={subtleBg} rounded="xl" borderWidth="1px" borderColor={cardBorder}>
                  <Text fontSize="xs" fontWeight={700} color="blue.500" mb={1}>
                    TASK 2 ({writingAttemptDetail.details?.task2Words ?? 0} words)
                  </Text>
                  <Text fontSize="xs" color={secondaryColor} mb={2}>
                    {target.exam.task2.prompt}
                  </Text>
                  <Box
                    p={3}
                    bg={cardBg}
                    rounded="lg"
                    borderWidth="1px"
                    borderColor={cardBorder}
                    whiteSpace="pre-wrap"
                    fontSize="sm"
                  >
                    {writingAttemptDetail.details?.task2Text || '(No response)'}
                  </Box>
                </Box>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setWritingAttemptDetail(null)} rounded="xl">
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  );
};
