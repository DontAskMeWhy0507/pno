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
  IconEdit,
  IconRefresh,
  IconTrophy,
  IconVolume,
} from "@tabler/icons-react";
import { parseAnkiDeckTemplate } from "@quenti/lib/src/anki/presets";
import {
  calculateNextSchedule,
  getIntervalEstimateLabel,
  type AnkiQueue,
  type CardScheduleState,
} from "@quenti/lib/src/anki/srs";
import { api } from "@quenti/trpc";
import { AnkiCard } from "./anki-card";
import { AnkiRatingBar } from "./anki-rating-bar";

const AnkiCardEditorModal = dynamic(
  () => import("./anki-card-editor-modal").then((m) => m.AnkiCardEditorModal),
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

export const AnkiStudyView: React.FC<AnkiStudyViewProps> = ({ studySetId }) => {
  const router = useRouter();
  const toast = useToast();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnswerShown, setIsAnswerShown] = useState(false);
  const [sessionCards, setSessionCards] = useState<SessionCard[]>([]);
  const [liveCounts, setLiveCounts] = useState({ new: 0, learn: 0, review: 0 });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [replaySignal, setReplaySignal] = useState(0);
  const inFlightTermsRef = useRef<Set<string>>(new Set());
  const lastLoadedUpdatedAtRef = useRef<number>(0);
  const cardScrollRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  const utils = api.useContext();
  const queueQuery = api.anki.getReviewQueue.useQuery(
    { studySetId },
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
  const isOwner = Boolean(deckInfo?.isOwner);

  // Reset local session state whenever navigating between decks
  useEffect(() => {
    setCurrentIndex(0);
    setIsAnswerShown(false);
    setSessionCards([]);
    setLiveCounts({ new: 0, learn: 0, review: 0 });
    inFlightTermsRef.current.clear();
    lastLoadedUpdatedAtRef.current = 0;
  }, [studySetId]);

  useEffect(() => {
    if (
      queueQuery.data &&
      !queueQuery.isFetching &&
      queueQuery.dataUpdatedAt !== lastLoadedUpdatedAtRef.current &&
      sessionCards.length === 0
    ) {
      lastLoadedUpdatedAtRef.current = queueQuery.dataUpdatedAt;
      setSessionCards(queueQuery.data.cards as SessionCard[]);
      setLiveCounts({
        new: queueQuery.data.counts.new,
        learn: queueQuery.data.counts.learn,
        review: queueQuery.data.counts.review,
      });
    }
  }, [
    queueQuery.data,
    queueQuery.isFetching,
    queueQuery.dataUpdatedAt,
    sessionCards.length,
  ]);

  const submitReviewMutation = api.anki.submitReview.useMutation({
    onSuccess: (_data, variables) => {
      inFlightTermsRef.current.delete(variables.termId);
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

  const cards = sessionCards;
  const currentCard = cards[currentIndex];
  const isFinished =
    !queueQuery.isLoading &&
    (cards.length === 0 || currentIndex >= cards.length);

  // Invalidate queue when finishing a batch so remaining due cards or hub counts stay fresh
  useEffect(() => {
    if (isFinished && cards.length > 0) {
      void utils.anki.getReviewQueue.invalidate({ studySetId });
    }
  }, [isFinished, cards.length, studySetId, utils.anki.getReviewQueue]);

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

      submitReviewMutation.mutate({
        studySetId,
        termId: ratedCard.termId,
        rating,
      });

      setIsAnswerShown(false);

      const now = new Date();
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
      const nextState = calculateNextSchedule(prevState, rating, now);
      const stayInSession = rating === 1 || nextState.queue === "Learning";

      setLiveCounts((prev) => {
        const next = { ...prev };
        if (ratedCard.queue === "New") next.new = Math.max(0, next.new - 1);
        else if (ratedCard.queue === "Review")
          next.review = Math.max(0, next.review - 1);
        else next.learn = Math.max(0, next.learn - 1);
        if (stayInSession) next.learn += 1;
        return next;
      });

      if (stayInSession) {
        const requeued: SessionCard = {
          ...ratedCard,
          ...nextState,
          estimates: {
            again: getIntervalEstimateLabel(nextState, 1, now),
            hard: getIntervalEstimateLabel(nextState, 2, now),
            good: getIntervalEstimateLabel(nextState, 3, now),
            easy: getIntervalEstimateLabel(nextState, 4, now),
          },
        };
        setSessionCards((prev) => [...prev, requeued]);
      }
      setCurrentIndex((prev) => prev + 1);
    },
    [currentCard, studySetId, submitReviewMutation],
  );

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished || queueQuery.isLoading || !currentCard || editModalOpen)
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
  const counts = liveCounts;

  // Reset card scroll position when advancing to a new card or switching decks
  useEffect(() => {
    cardScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [currentIndex, studySetId]);

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
  }, [isAnswerShown, currentIndex]);

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
    return (
      <Container maxW="2xl" py={20} textAlign="center">
        <Stack spacing={6} align="center">
          <Icon as={IconTrophy} boxSize={16} color="orange.400" />
          <Heading size="lg">Congratulations!</Heading>
          <Text color={secondaryText} fontSize="md">
            You have finished all due cards in this deck for now.
          </Text>
          <HStack spacing={4}>
            <Button
              leftIcon={<IconRefresh size={18} />}
              isLoading={queueQuery.isFetching}
              onClick={() => {
                lastLoadedUpdatedAtRef.current = queueQuery.dataUpdatedAt;
                setCurrentIndex(0);
                setSessionCards([]);
                setIsAnswerShown(false);
                void queueQuery.refetch();
              }}
            >
              Check Again
            </Button>
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
            key={`${currentCard.termId}-${currentIndex}`}
            frontHtml={currentCard.word}
            backHtml={currentCard.definition}
            assetUrl={currentCard.assetUrl}
            customCss={deckTemplate?.css}
            replaySignal={replaySignal}
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
            setSessionCards((prev) =>
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
    </Container>
  );
};

export default AnkiStudyView;
