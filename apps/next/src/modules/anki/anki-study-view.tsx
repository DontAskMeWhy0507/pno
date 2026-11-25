import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  Badge,
  Box,
  Button,
  Container,
  HStack,
  Heading,
  Icon,
  IconButton,
  Spinner,
  Stack,
  Text,
  Tooltip,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import {
  IconArrowLeft,
  IconChartBar,
  IconClock,
  IconEdit,
  IconRefresh,
  IconSettings,
  IconTrophy,
  IconVolume,
} from "@tabler/icons-react";
import { parseAnkiDeckTemplate } from "@pno/lib/src/anki/presets";
import {
  calculateNextSchedule,
  deckOptionsToScheduleConfig,
  DEFAULT_SCHEDULE_CONFIG,
  getIntervalEstimateLabel,
  resolveDeckOptions,
  type AnkiDeckOptions,
  type AnkiQueue,
  type CardScheduleState,
} from "@pno/lib/src/anki/srs";
import { api } from "@pno/trpc";
import { AnkiCard } from "./anki-card";
import { AnkiRatingBar } from "./anki-rating-bar";

const AnkiCardEditorModal = dynamic(
  () => import("./anki-card-editor-modal").then((m) => m.AnkiCardEditorModal),
  { ssr: false },
);
const AnkiDeckOptionsModal = dynamic(
  () =>
    import("./anki-deck-options-modal").then(
      (m) => m.AnkiDeckOptionsModal,
    ),
  { ssr: false },
);
const AnkiStatsModal = dynamic(
  () => import("./anki-stats-modal").then((m) => m.AnkiStatsModal),
  { ssr: false },
);

export interface AnkiStudyViewProps {
  studySetId: string;
}

interface SessionCard {
  termId: string;
  word: string;
  definition: string;
  wordRichText?: unknown;
  assetUrl: string | null;
  rank: number;
  queue: AnkiQueue;
  step: number;
  interval: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  due: Date | string;
  estimates: {
    again: string;
    hard: string;
    good: string;
    easy: string;
  };
}

function pickNextV3Card(
  pool: SessionCard[],
  nowMs: number,
  learnAheadMinutes: number,
  options?: Pick<AnkiDeckOptions, "newMix" | "interdayLearnMix">,
): { active: SessionCard | null; remaining: SessionCard[] } {
  if (pool.length === 0) {
    return { active: null, remaining: [] };
  }

  const dueIntradayLearn: SessionCard[] = [];
  const dueDayLearn: SessionCard[] = [];
  const review: SessionCard[] = [];
  const newCards: SessionCard[] = [];
  const waitingLearn: SessionCard[] = [];

  for (const card of pool) {
    const dueMs = new Date(card.due).getTime();
    if (card.queue === "Learning") {
      if (dueMs <= nowMs) {
        dueIntradayLearn.push(card);
      } else {
        waitingLearn.push(card);
      }
    } else if (card.queue === "DayLearn") {
      if (dueMs <= nowMs) {
        dueDayLearn.push(card);
      }
    } else if (card.queue === "Review") {
      review.push(card);
    } else if (card.queue === "New") {
      newCards.push(card);
    }
  }

  dueIntradayLearn.sort(
    (a, b) => new Date(a.due).getTime() - new Date(b.due).getTime(),
  );
  dueDayLearn.sort(
    (a, b) => new Date(a.due).getTime() - new Date(b.due).getTime(),
  );
  waitingLearn.sort(
    (a, b) => new Date(a.due).getTime() - new Date(b.due).getTime(),
  );

  let chosen: SessionCard | null = null;
  if (dueIntradayLearn.length > 0) {
    chosen = dueIntradayLearn[0]!;
  } else if (
    options?.interdayLearnMix === "before_reviews" &&
    dueDayLearn.length > 0
  ) {
    chosen = dueDayLearn[0]!;
  } else if (options?.newMix === "before_reviews" && newCards.length > 0) {
    chosen = newCards[0]!;
  } else if (review.length > 0) {
    chosen = review[0]!;
  } else if (dueDayLearn.length > 0) {
    chosen = dueDayLearn[0]!;
  } else if (newCards.length > 0) {
    chosen = newCards[0]!;
  } else if (waitingLearn.length > 0) {
    const nextLearn = waitingLearn[0]!;
    const learnAheadMs = learnAheadMinutes * 60 * 1000;
    if (new Date(nextLearn.due).getTime() <= nowMs + learnAheadMs) {
      chosen = nextLearn;
    }
  }

  if (!chosen) {
    return { active: null, remaining: [] };
  }

  return {
    active: chosen,
    remaining: pool.filter((c) => c.termId !== chosen!.termId),
  };
}

function countPool(
  active: SessionCard | null,
  remaining: SessionCard[],
): { new: number; learn: number; review: number } {
  let newCount = 0;
  let learnCount = 0;
  let reviewCount = 0;
  const all = active ? [active, ...remaining] : remaining;
  for (const c of all) {
    if (c.queue === "New") newCount += 1;
    else if (c.queue === "Review") reviewCount += 1;
    else if (c.queue === "Learning" || c.queue === "DayLearn") learnCount += 1;
  }
  return { new: newCount, learn: learnCount, review: reviewCount };
}

export const AnkiStudyView: React.FC<AnkiStudyViewProps> = ({ studySetId }) => {
  const router = useRouter();
  const toast = useToast();

  const [reviewStepCount, setReviewStepCount] = useState(0);
  const [isAnswerShown, setIsAnswerShown] = useState(false);
  const [activeCard, setActiveCard] = useState<SessionCard | null>(null);
  const [remainingCards, setRemainingCards] = useState<SessionCard[]>([]);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [ignoreDailyLimit, setIgnoreDailyLimit] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [replaySignal, setReplaySignal] = useState(0);
  const cardShownAtRef = useRef<number>(Date.now());
  const inFlightTermsRef = useRef<Set<string>>(new Set());
  const lastLoadedUpdatedAtRef = useRef<number>(0);
  const cardScrollRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  const timezoneOffsetMinutes = useMemo(
    () => new Date().getTimezoneOffset(),
    [],
  );

  const utils = api.useContext();
  const queueQuery = api.anki.getReviewQueue.useQuery(
    { studySetId, timezoneOffsetMinutes, ignoreDailyLimit },
    {
      refetchOnWindowFocus: false,
      staleTime: 60000,
    },
  );

  const deckInfo = queueQuery.data?.deck ?? null;
  const deckTemplate = useMemo(
    () => parseAnkiDeckTemplate(deckInfo?.ankiTemplate),
    [deckInfo?.ankiTemplate],
  );
  const deckOptions = useMemo(
    () => resolveDeckOptions(deckInfo?.options ?? deckTemplate?.options),
    [deckInfo?.options, deckTemplate?.options],
  );
  const isOwner = Boolean(deckInfo?.isOwner);

  // Reset local session state whenever navigating between decks
  useEffect(() => {
    setReviewStepCount(0);
    setIsAnswerShown(false);
    setActiveCard(null);
    setRemainingCards([]);
    setSessionInitialized(false);
    setIgnoreDailyLimit(false);
    inFlightTermsRef.current.clear();
    lastLoadedUpdatedAtRef.current = 0;
  }, [studySetId]);

  useEffect(() => {
    if (
      queueQuery.data &&
      !queueQuery.isFetching &&
      queueQuery.dataUpdatedAt !== lastLoadedUpdatedAtRef.current &&
      !sessionInitialized
    ) {
      lastLoadedUpdatedAtRef.current = queueQuery.dataUpdatedAt;
      const opts = resolveDeckOptions(queueQuery.data.deck?.options);
      const picked = pickNextV3Card(
        queueQuery.data.cards as SessionCard[],
        Date.now(),
        opts.learnAheadMinutes,
        opts,
      );
      setActiveCard(picked.active);
      setRemainingCards(picked.remaining);
      setSessionInitialized(true);
    }
  }, [
    queueQuery.data,
    queueQuery.isFetching,
    queueQuery.dataUpdatedAt,
    sessionInitialized,
  ]);

  const submitReviewMutation = api.anki.submitReview.useMutation({
    onSuccess: (res, variables) => {
      inFlightTermsRef.current.delete(variables.termId);
      if (res.schedule?.queue === "Suspended") {
        toast({
          title: "Card marked as Leech & suspended",
          description: `Forgotten ${res.schedule.lapses} times. You can review your deck in the hub anytime.`,
          status: "warning",
          duration: 4000,
          isClosable: true,
        });
      }
    },
    onError: (err, variables) => {
      inFlightTermsRef.current.delete(variables.termId);
      toast({
        title: "Could not save review",
        description: err.message || "Check your connection and try again.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    },
  });

  const currentCard = activeCard;
  const isFinished =
    !queueQuery.isLoading && sessionInitialized && currentCard === null;

  // Track answer timing per card (capped by deckOptions.capAnswerTimeSecs)
  useEffect(() => {
    if (!currentCard) return;
    cardShownAtRef.current = Date.now();
    setElapsedSecs(0);
    if (!deckOptions.showTimer) return;
    const id = window.setInterval(() => {
      const secs = Math.min(
        deckOptions.capAnswerTimeSecs,
        Math.floor((Date.now() - cardShownAtRef.current) / 1000),
      );
      setElapsedSecs(secs);
    }, 1000);
    return () => window.clearInterval(id);
  }, [currentCard?.termId, reviewStepCount, deckOptions.showTimer, deckOptions.capAnswerTimeSecs]);

  // Invalidate queue when finishing a batch so remaining due cards or hub counts stay fresh
  useEffect(() => {
    if (isFinished && reviewStepCount > 0) {
      void utils.anki.getReviewQueue.invalidate({ studySetId });
    }
  }, [isFinished, reviewStepCount, studySetId, utils.anki.getReviewQueue]);

  const handleShowAnswer = useCallback(() => {
    setIsAnswerShown(true);
  }, []);

  const handleRate = useCallback(
    (rating: 1 | 2 | 3 | 4) => {
      if (!currentCard || inFlightTermsRef.current.has(currentCard.termId)) {
        return;
      }
      const ratedCard = currentCard;
      inFlightTermsRef.current.add(ratedCard.termId);

      const now = new Date();
      const takenMillis = Math.min(
        Math.max(0, now.getTime() - cardShownAtRef.current),
        deckOptions.capAnswerTimeSecs * 1000,
      );

      submitReviewMutation.mutate({
        studySetId,
        termId: ratedCard.termId,
        rating,
        takenMillis,
        timezoneOffsetMinutes,
      });

      setIsAnswerShown(false);

      const prevState: CardScheduleState = {
        queue: ratedCard.queue,
        step: ratedCard.step,
        interval: ratedCard.interval,
        easeFactor: ratedCard.easeFactor,
        reps: ratedCard.reps,
        lapses: ratedCard.lapses,
        due: new Date(ratedCard.due),
        lastReviewedAt: null,
      };
      const schedCfg = deckOptionsToScheduleConfig(
        deckOptions,
        timezoneOffsetMinutes,
        false,
      );
      const nextState = calculateNextSchedule(prevState, rating, now, schedCfg);
      const stayInIntradaySession = nextState.queue === "Learning";

      const nextPool = stayInIntradaySession
        ? [
            ...remainingCards,
            {
              ...ratedCard,
              ...nextState,
              estimates: {
                again: getIntervalEstimateLabel(nextState, 1, now, schedCfg),
                hard: getIntervalEstimateLabel(nextState, 2, now, schedCfg),
                good: getIntervalEstimateLabel(nextState, 3, now, schedCfg),
                easy: getIntervalEstimateLabel(nextState, 4, now, schedCfg),
              },
            },
          ]
        : remainingCards;

      const picked = pickNextV3Card(
        nextPool,
        now.getTime(),
        deckOptions.learnAheadMinutes,
        deckOptions,
      );
      setActiveCard(picked.active);
      setRemainingCards(picked.remaining);
      setReviewStepCount((prev) => prev + 1);
    },
    [
      currentCard,
      deckOptions,
      remainingCards,
      studySetId,
      submitReviewMutation,
      timezoneOffsetMinutes,
    ],
  );

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        isFinished ||
        queueQuery.isLoading ||
        !currentCard ||
        editModalOpen ||
        optionsModalOpen ||
        statsModalOpen
      )
        return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        if (!isAnswerShown) {
          handleShowAnswer();
        } else {
          handleRate(3);
        }
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        setReplaySignal((s) => s + 1);
      } else if (e.key.toLowerCase() === "e" && isOwner) {
        e.preventDefault();
        setEditModalOpen(true);
      } else if (isAnswerShown) {
        if (e.key === "1") handleRate(1);
        else if (e.key === "2") handleRate(2);
        else if (e.key === "3") handleRate(3);
        else if (e.key === "4") handleRate(4);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isFinished,
    queueQuery.isLoading,
    currentCard,
    isAnswerShown,
    editModalOpen,
    optionsModalOpen,
    statsModalOpen,
    isOwner,
    handleShowAnswer,
    handleRate,
  ]);

  const secondaryText = useColorModeValue("gray.600", "gray.400");
  const stickyBg = useColorModeValue(
    "rgba(247, 250, 252, 0.86)",
    "rgba(23, 25, 35, 0.86)",
  );
  const barBorderColor = useColorModeValue("gray.200", "gray.700");
  const counts = useMemo(
    () => countPool(activeCard, remainingCards),
    [activeCard, remainingCards],
  );

  // Reset card scroll position when advancing to a new card or switching decks
  useEffect(() => {
    cardScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [reviewStepCount, studySetId]);

  // Smoothly scroll the card pane to bring the answer side into view on Show Answer
  useEffect(() => {
    if (!isAnswerShown) return;
    const scrollToAnswer = () => {
      const scroller = cardScrollRef.current;
      const ans = answerRef.current;
      if (!scroller || !ans) return;
      const containerRect = scroller.getBoundingClientRect();
      const ansRect = ans.getBoundingClientRect();
      const targetTop = scroller.scrollTop + (ansRect.top - containerRect.top) - 12;
      scroller.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
      });
    };
    const rafId = window.requestAnimationFrame(scrollToAnswer);
    const timerId = window.setTimeout(scrollToAnswer, 80);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [isAnswerShown, reviewStepCount]);

  if (queueQuery.isLoading) {
    return (
      <Container maxW="3xl" py={20} textAlign="center">
        <Spinner size="xl" color="orange.400" />
        <Text mt={4} color={secondaryText}>
          Loading Anki review queue...
        </Text>
      </Container>
    );
  }

  if (queueQuery.isError) {
    return (
      <Container maxW="2xl" py={20} textAlign="center">
        <Stack spacing={4} align="center">
          <Heading size="md" color="red.400">
            Error Loading Review Queue
          </Heading>
          <Text color={secondaryText}>
            {queueQuery.error.message || "Failed to load study cards."}
          </Text>
          <HStack spacing={3}>
            <Button
              variant="outline"
              leftIcon={<IconArrowLeft size={18} />}
              onClick={() => router.push(`/${studySetId}`)}
            >
              Back to Deck
            </Button>
            <Button
              leftIcon={<IconRefresh size={18} />}
              colorScheme="orange"
              onClick={() => void queueQuery.refetch()}
            >
              Retry
            </Button>
          </HStack>
        </Stack>
      </Container>
    );
  }

  if (isFinished) {
    const dailyStats = queueQuery.data?.dailyStats;
    const hasMoreBeyondDailyLimit =
      Boolean(dailyStats) &&
      (dailyStats!.remainingNewAvailable > 0 ||
        dailyStats!.remainingReviewAvailable > 0);
    return (
      <Container maxW="2xl" py={20} textAlign="center">
        <Stack spacing={6} align="center">
          <Icon as={IconTrophy} boxSize={16} color="orange.400" />
          <Heading size="lg">Congratulations!</Heading>
          <Text color={secondaryText} fontSize="md">
            You have finished all due cards in this deck for now.
          </Text>
          {dailyStats && (
            <Text color={secondaryText} fontSize="sm">
              Today&apos;s limit: {dailyStats.newStudiedToday}/{dailyStats.newLimit} new
              {" • "}
              {dailyStats.reviewsStudiedToday}/{dailyStats.reviewLimit} review
              {dailyStats.suspendedCount > 0
                ? ` • ${dailyStats.suspendedCount} suspended`
                : ""}
            </Text>
          )}
          <HStack spacing={4} flexWrap="wrap" justify="center">
            <Button
              leftIcon={<IconRefresh size={18} />}
              isLoading={queueQuery.isFetching}
              onClick={() => {
                lastLoadedUpdatedAtRef.current = queueQuery.dataUpdatedAt;
                setReviewStepCount(0);
                setActiveCard(null);
                setRemainingCards([]);
                setSessionInitialized(false);
                setIsAnswerShown(false);
                void queueQuery.refetch();
              }}
            >
              Check Again
            </Button>
            {hasMoreBeyondDailyLimit && (
              <Button
                variant="outline"
                colorScheme="orange"
                isLoading={queueQuery.isFetching}
                onClick={() => {
                  lastLoadedUpdatedAtRef.current = 0;
                  setIgnoreDailyLimit(true);
                  setReviewStepCount(0);
                  setActiveCard(null);
                  setRemainingCards([]);
                  setSessionInitialized(false);
                  setIsAnswerShown(false);
                }}
              >
                Study More (
                {(dailyStats?.remainingNewAvailable ?? 0) +
                  (dailyStats?.remainingReviewAvailable ?? 0)}
                )
              </Button>
            )}
            <Button
              colorScheme="orange"
              onClick={() => router.push(`/${studySetId}`)}
            >
              Back to Deck
            </Button>
          </HStack>
        </Stack>
      </Container>
    );
  }

  return (
    <Container
      maxW="4xl"
      px={{ base: 3, sm: 6 }}
      pt={{ base: 2, md: 4 }}
      pb={0}
      h="calc(100dvh - 80px)"
      maxH="calc(100dvh - 80px)"
      overflow="hidden"
      display="flex"
      flexDirection="column"
    >
      {/* Header Bar */}
      <HStack
        flexShrink={0}
        pb={{ base: 2, md: 3 }}
        justify="space-between"
        align="center"
        flexWrap="wrap"
        gap={2}
      >
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<IconArrowLeft size={16} />}
          onClick={() => router.push(`/${studySetId}`)}
        >
          <Box as="span" display={{ base: "none", sm: "inline" }}>
            Back to Deck
          </Box>
          <Box as="span" display={{ base: "inline", sm: "none" }}>
            Deck
          </Box>
        </Button>

        {/* Anki Review Counters + Replay/Edit */}
        <HStack spacing={{ base: 1.5, sm: 2.5 }}>
          <Badge
            colorScheme="blue"
            px={{ base: 2, sm: 2.5 }}
            py={1}
            rounded="md"
            fontSize={{ base: "xs", sm: "sm" }}
          >
            New: {counts.new}
          </Badge>
          <Badge
            colorScheme="red"
            px={{ base: 2, sm: 2.5 }}
            py={1}
            rounded="md"
            fontSize={{ base: "xs", sm: "sm" }}
          >
            Learn: {counts.learn}
          </Badge>
          <Badge
            colorScheme="green"
            px={{ base: 2, sm: 2.5 }}
            py={1}
            rounded="md"
            fontSize={{ base: "xs", sm: "sm" }}
          >
            Review: {counts.review}
          </Badge>

          {deckOptions.showTimer && (
            <Badge
              colorScheme="gray"
              variant="subtle"
              px={2}
              py={1}
              rounded="md"
              fontSize="xs"
            >
              <HStack spacing={1}>
                <IconClock size={12} />
                <Text>
                  {Math.floor(elapsedSecs / 60)}:
                  {String(elapsedSecs % 60).padStart(2, "0")}
                </Text>
              </HStack>
            </Badge>
          )}

          <Tooltip label="Statistics">
            <IconButton
              aria-label="Anki Statistics"
              icon={<IconChartBar size={17} />}
              size="sm"
              variant="ghost"
              rounded="lg"
              onClick={() => setStatsModalOpen(true)}
            />
          </Tooltip>

          {isOwner && (
            <Tooltip label="Deck Options">
              <IconButton
                aria-label="Deck Options"
                icon={<IconSettings size={17} />}
                size="sm"
                variant="ghost"
                rounded="lg"
                onClick={() => setOptionsModalOpen(true)}
              />
            </Tooltip>
          )}

          <Tooltip label="Replay audio (R)">
            <IconButton
              aria-label="Replay audio"
              icon={<IconVolume size={17} />}
              size="sm"
              variant="ghost"
              rounded="lg"
              onClick={() => setReplaySignal((s) => s + 1)}
            />
          </Tooltip>

          {isOwner && currentCard && (
            <Tooltip label="Edit card (E)">
              <IconButton
                aria-label="Edit card"
                icon={<IconEdit size={17} />}
                size="sm"
                variant="outline"
                rounded="lg"
                onClick={() => setEditModalOpen(true)}
              />
            </Tooltip>
          )}
        </HStack>
      </HStack>

      {/* Scrollable Card Pane */}
      <Box
        ref={cardScrollRef}
        flex="1"
        minH={0}
        overflowY="auto"
        overscrollBehavior="contain"
        pb={{ base: 4, md: 6 }}
      >
        {currentCard && (
          <AnkiCard
            key={`${currentCard.termId}-${reviewStepCount}`}
            frontHtml={currentCard.word}
            backHtml={currentCard.definition}
            assetUrl={currentCard.assetUrl}
            customCss={deckTemplate?.css}
            replaySignal={replaySignal}
            disableAutoPlay={deckOptions.disableAutoplay}
            isAnswerShown={isAnswerShown}
            onFlip={handleShowAnswer}
            answerRef={answerRef}
          />
        )}
      </Box>

      {/* Docked Bottom Action Controls */}
      <Box
        flexShrink={0}
        bg={stickyBg}
        backdropFilter="blur(12px)"
        borderTopWidth="1px"
        borderColor={barBorderColor}
        pt={{ base: 2.5, md: 3 }}
        pb={{ base: "max(12px, env(safe-area-inset-bottom))", md: 4 }}
        mx={{ base: -3, sm: 0 }}
        px={{ base: 3, sm: 0 }}
      >
        {!isAnswerShown ? (
          <Button
            w="full"
            h={{ base: "50px", md: "54px" }}
            colorScheme="orange"
            fontSize="md"
            fontWeight={700}
            rounded="xl"
            onClick={handleShowAnswer}
          >
            Show Answer
            <Box as="span" display={{ base: "none", sm: "inline" }} ml={1}>
              (Space)
            </Box>
          </Button>
        ) : (
          currentCard && (
            <AnkiRatingBar
              estimates={currentCard.estimates}
              onRate={handleRate}
              isLoading={inFlightTermsRef.current.has(currentCard.termId)}
            />
          )
        )}
      </Box>

      {isOwner && currentCard && editModalOpen && (
        <AnkiCardEditorModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          studySetId={studySetId}
          deckTemplate={deckTemplate}
          card={{
            termId: currentCard.termId,
            word: currentCard.word,
            definition: currentCard.definition,
            wordRichText: currentCard.wordRichText,
            assetUrl: currentCard.assetUrl,
          }}
          onSaved={(updated) => {
            setActiveCard((prev) =>
              prev && prev.termId === updated.id
                ? {
                    ...prev,
                    word: updated.word,
                    definition: updated.definition,
                    wordRichText: updated.wordRichText,
                    assetUrl: updated.assetUrl,
                  }
                : prev,
            );
            setRemainingCards((prev) =>
              prev.map((c) =>
                c.termId === updated.id
                  ? {
                      ...c,
                      word: updated.word,
                      definition: updated.definition,
                      wordRichText: updated.wordRichText,
                      assetUrl: updated.assetUrl,
                    }
                  : c,
              ),
            );
          }}
        />
      )}

      {isOwner && optionsModalOpen && (
        <AnkiDeckOptionsModal
          isOpen={optionsModalOpen}
          onClose={() => setOptionsModalOpen(false)}
          studySetId={studySetId}
          initialOptions={deckOptions}
          dayKey={queueQuery.data?.dailyStats?.dayKey}
          newStudiedToday={queueQuery.data?.dailyStats?.newStudiedToday ?? 0}
          reviewsStudiedToday={
            queueQuery.data?.dailyStats?.reviewsStudiedToday ?? 0
          }
        />
      )}

      {statsModalOpen && (
        <AnkiStatsModal
          isOpen={statsModalOpen}
          onClose={() => setStatsModalOpen(false)}
          studySetId={studySetId}
        />
      )}
    </Container>
  );
};

export default AnkiStudyView;
