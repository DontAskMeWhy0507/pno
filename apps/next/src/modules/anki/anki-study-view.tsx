import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import {
  Box,
  Button,
  Container,
  HStack,
  Heading,
  Stack,
  Text,
  Badge,
  Spinner,
  Icon,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import { IconArrowLeft, IconTrophy, IconRefresh } from "@tabler/icons-react";
import {
  calculateNextSchedule,
  getIntervalEstimateLabel,
  type AnkiQueue,
  type CardScheduleState,
} from "@quenti/lib/src/anki/srs";
import { api } from "@quenti/trpc";
import { AnkiCard } from "./anki-card";
import { AnkiRatingBar } from "./anki-rating-bar";

export interface AnkiStudyViewProps {
  studySetId: string;
}

interface SessionCard {
  termId: string;
  word: string;
  definition: string;
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
  const inFlightTermsRef = useRef<Set<string>>(new Set());
  const lastLoadedUpdatedAtRef = useRef<number>(0);

  const utils = api.useContext();
  const queueQuery = api.anki.getReviewQueue.useQuery(
    { studySetId },
    {
      refetchOnWindowFocus: false,
      staleTime: 60000,
    },
  );

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
  }, [queueQuery.data, queueQuery.isFetching, queueQuery.dataUpdatedAt, sessionCards.length]);

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

      // Fire mutation in the background (optimistic UI with toast error reporting)
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

      // Update live New/Learn/Review counters
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

  // Global Keyboard shortcuts (disabled when finished or focused on text inputs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished || queueQuery.isLoading || !currentCard) return;
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
    handleShowAnswer,
    handleRate,
  ]);

  const secondaryText = useColorModeValue("gray.600", "gray.400");
  const counts = liveCounts;

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
    <Container maxW="4xl" py={6}>
      <Stack spacing={6}>
        {/* Header Bar */}
        <HStack justify="space-between" align="center">
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<IconArrowLeft size={16} />}
            onClick={() => router.push(`/${studySetId}`)}
          >
            Back to Deck
          </Button>

          {/* Anki Review Counters: Blue (New), Red (Learn), Green (Review) */}
          <HStack spacing={3}>
            <Badge colorScheme="blue" px={2.5} py={1} rounded="md" fontSize="sm">
              New: {counts.new}
            </Badge>
            <Badge colorScheme="red" px={2.5} py={1} rounded="md" fontSize="sm">
              Learn: {counts.learn}
            </Badge>
            <Badge colorScheme="green" px={2.5} py={1} rounded="md" fontSize="sm">
              Review: {counts.review}
            </Badge>
          </HStack>
        </HStack>

        {/* Card View */}
        {currentCard && (
          <AnkiCard
            key={`${currentCard.termId}-${currentIndex}`}
            frontHtml={currentCard.word}
            backHtml={currentCard.definition}
            assetUrl={currentCard.assetUrl}
            isAnswerShown={isAnswerShown}
            onFlip={handleShowAnswer}
          />
        )}

        {/* Action Controls */}
        <Box pt={2}>
          {!isAnswerShown ? (
            <Button
              w="full"
              h="54px"
              colorScheme="orange"
              fontSize="md"
              fontWeight={700}
              onClick={handleShowAnswer}
            >
              Show Answer (Space)
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
      </Stack>
    </Container>
  );
};

export default AnkiStudyView;
