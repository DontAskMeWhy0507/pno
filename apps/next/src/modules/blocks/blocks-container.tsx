import { useRouter } from "next/router";
import React, { useEffect, useMemo, useState } from "react";

import { Link } from "@quenti/components";

import {
  Badge,
  Box,
  Button,
  Center,
  Container,
  Flex,
  HStack,
  Heading,
  IconButton,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
  useColorModeValue,
} from "@chakra-ui/react";

import {
  IconArrowLeft,
  IconBrain,
  IconCube,
  IconFlame,
  IconRotateClockwise,
  IconTrophy,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";

import { effectChannel } from "../../events/effects";
import { useSet } from "../../hooks/use-set";
import { playSound } from "./blocks-audio";
import {
  BlockPiece,
  GRID_SIZE,
  canPieceFitAnywhere,
  canPlacePiece,
  checkAndClearLines,
  createEmptyBoard,
  getRandomPiece,
} from "./blocks-shapes";

interface QuestionData {
  prompt: string;
  correctAnswer: string;
  choices: string[];
}

export const BlocksContainer: React.FC = () => {
  const router = useRouter();
  const set = useSet();
  const terms = set?.terms || [];

  // Audio preference
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Game state
  const [board, setBoard] = useState<(string | null)[][]>(createEmptyBoard);
  const [pieces, setPieces] = useState<BlockPiece[]>([]);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ r: number; c: number } | null>(
    null,
  );

  // Stats
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [linesCleared, setLinesCleared] = useState(0);
  const [streak, setStreak] = useState(0);
  const [cardsAnswered, setCardsAnswered] = useState(0);

  // Phase: 'question' | 'placing' | 'gameover'
  const [phase, setPhase] = useState<"question" | "placing" | "gameover">(
    "question",
  );
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(
    null,
  );
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);

  // LocalStorage high score key
  const highScoreKey = `quenti_blocks_highscore_${set?.id || "default"}`;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(highScoreKey);
      if (saved) setHighScore(Number(saved));
    }
  }, [highScoreKey]);

  const updateScore = (delta: number) => {
    setScore((prev) => {
      const next = prev + delta;
      if (next > highScore) {
        setHighScore(next);
        if (typeof window !== "undefined") {
          localStorage.setItem(highScoreKey, next.toString());
        }
      }
      return next;
    });
  };

  // Generate a multiple choice question from set terms
  const generateQuestion = (): QuestionData | null => {
    if (terms.length === 0) return null;
    const targetIdx = Math.floor(Math.random() * terms.length);
    const target = terms[targetIdx]!;

    const isTermPrompt = Math.random() > 0.4;
    const prompt = isTermPrompt
      ? target.word || target.definition
      : target.definition || target.word;
    const correctAnswer = isTermPrompt
      ? target.definition || target.word
      : target.word || target.definition;

    // Pick 3 distractors
    const otherAnswers = terms
      .filter((_, idx) => idx !== targetIdx)
      .map((t) =>
        isTermPrompt
          ? t.definition || t.word
          : t.word || t.definition,
      )
      .filter((a) => a !== correctAnswer);

    // Shuffle and pick up to 3
    const shuffledOthers = [...otherAnswers].sort(() => 0.5 - Math.random());
    const distractors = shuffledOthers.slice(0, 3);

    const choices = [...distractors, correctAnswer].sort(
      () => 0.5 - Math.random(),
    );

    return {
      prompt,
      correctAnswer,
      choices,
    };
  };

  // Start question phase
  const triggerNextQuestion = () => {
    const q = generateQuestion();
    setCurrentQuestion(q);
    setSelectedChoice(null);
    setIsAnswerCorrect(null);
    setPhase("question");
  };

  // On mount: start first question
  useEffect(() => {
    if (terms.length > 0 && phase === "question" && !currentQuestion) {
      triggerNextQuestion();
    }
  }, [terms]);

  // Answer handler
  const handleAnswer = (choice: string) => {
    if (selectedChoice !== null || !currentQuestion) return;
    setSelectedChoice(choice);

    const correct = choice === currentQuestion.correctAnswer;
    setIsAnswerCorrect(correct);

    if (correct) {
      playSound("correct", soundEnabled);
      updateScore(100);
      setStreak((s) => s + 1);
      setCardsAnswered((c) => c + 1);

      // Award 3 puzzle pieces
      const newPieces = [getRandomPiece(), getRandomPiece(), getRandomPiece()];
      setPieces(newPieces);
      setSelectedPieceId(newPieces[0]!.id);

      // Transition to placing phase after short delay
      setTimeout(() => {
        setPhase("placing");
        setSelectedChoice(null);
        setIsAnswerCorrect(null);
      }, 700);
    } else {
      playSound("wrong", soundEnabled);
      setStreak(0);
      // Let user see correct answer for 1.4s then give another question
      setTimeout(() => {
        triggerNextQuestion();
      }, 1400);
    }
  };

  const selectedPiece = useMemo(() => {
    return pieces.find((p) => p.id === selectedPieceId) || null;
  }, [pieces, selectedPieceId]);

  // Check if hover placement is valid
  const isHoverValid = useMemo(() => {
    if (!selectedPiece || !hoverPos) return false;
    return canPlacePiece(board, selectedPiece, hoverPos.r, hoverPos.c);
  }, [board, selectedPiece, hoverPos]);

  // Place block on board
  const handleCellClick = (r: number, c: number) => {
    if (phase !== "placing" || !selectedPiece) return;

    if (!canPlacePiece(board, selectedPiece, r, c)) {
      return;
    }

    playSound("place", soundEnabled);

    // Place piece
    const newBoard = board.map((row) => [...row]);
    let blockCount = 0;
    for (let pr = 0; pr < selectedPiece.shape.length; pr++) {
      for (let pc = 0; pc < selectedPiece.shape[0]!.length; pc++) {
        if (selectedPiece.shape[pr]![pc] === 1) {
          newBoard[r + pr]![c + pc] = selectedPiece.color;
          blockCount++;
        }
      }
    }

    // Points for placing blocks
    updateScore(blockCount * 10);

    // Check line clears
    const { newBoard: clearedBoard, linesCleared: cleared } =
      checkAndClearLines(newBoard);
    if (cleared > 0) {
      playSound("clear", soundEnabled);
      setLinesCleared((l) => l + cleared);
      // Combo bonus
      const clearBonus = cleared * 150 * (cleared > 1 ? cleared : 1);
      updateScore(clearBonus);
      effectChannel.emit("confetti");
    }

    setBoard(clearedBoard);

    // Remove placed piece from tray
    const remainingPieces = pieces.filter((p) => p.id !== selectedPiece.id);
    setPieces(remainingPieces);

    if (remainingPieces.length === 0) {
      // All pieces placed: next card question!
      setSelectedPieceId(null);
      setHoverPos(null);
      setTimeout(() => {
        triggerNextQuestion();
      }, 400);
    } else {
      // Select next piece automatically
      setSelectedPieceId(remainingPieces[0]!.id);

      // Check if ANY remaining piece can fit anywhere
      const anyCanFit = remainingPieces.some((p) =>
        canPieceFitAnywhere(clearedBoard, p),
      );

      if (!anyCanFit) {
        playSound("gameover", soundEnabled);
        setTimeout(() => {
          setPhase("gameover");
        }, 600);
      }
    }
  };

  const restartGame = () => {
    setBoard(createEmptyBoard());
    setPieces([]);
    setSelectedPieceId(null);
    setHoverPos(null);
    setScore(0);
    setStreak(0);
    setLinesCleared(0);
    setCardsAnswered(0);
    triggerNextQuestion();
  };

  // Color schemes
  const bg = useColorModeValue("gray.50", "gray.900");
  const panelBg = useColorModeValue("white", "gray.800");
  const cellEmptyBg = useColorModeValue("gray.100", "gray.750");
  const cellEmptyBorder = useColorModeValue("gray.200", "gray.700");
  const statBoxBg = useColorModeValue("gray.100", "gray.750");
  const promptBg = useColorModeValue("blue.50", "blue.950");
  const promptBorder = useColorModeValue("blue.200", "blue.800");

  return (
    <Box minH="calc(100vh - 80px)" bg={bg} py={4}>
      <Container maxW="5xl">
        {/* Top bar */}
        <Flex
          justify="space-between"
          align="center"
          mb={4}
          p={3}
          bg={panelBg}
          rounded="xl"
          boxShadow="sm"
        >
          <HStack spacing={3}>
            <Tooltip label="Back to set">
              <IconButton
                as={Link}
                href={`/${set?.id}`}
                aria-label="Back"
                icon={<IconArrowLeft size={18} />}
                size="sm"
                variant="ghost"
              />
            </Tooltip>
            <HStack spacing={2}>
              <IconCube color="#3b82f6" size={24} />
              <Heading size="sm" fontWeight={700}>
                Blocks
              </Heading>
              <Text fontSize="xs" color="gray.500" display={{ base: "none", md: "block" }}>
                {set?.title}
              </Text>
            </HStack>
          </HStack>

          {/* Stats Bar */}
          <HStack spacing={{ base: 2, md: 4 }}>
            <Box
              px={3}
              py={1}
              bg={statBoxBg}
              rounded="lg"
              fontSize="xs"
              fontWeight={700}
            >
              <HStack spacing={1}>
                <Text color="gray.500">SCORE</Text>
                <Text color="blue.500" fontSize="sm">
                  {score}
                </Text>
              </HStack>
            </Box>

            <Box
              px={3}
              py={1}
              bg={statBoxBg}
              rounded="lg"
              fontSize="xs"
              fontWeight={700}
              display={{ base: "none", sm: "block" }}
            >
              <HStack spacing={1}>
                <IconTrophy size={14} color="#f59e0b" />
                <Text color="gray.500">BEST</Text>
                <Text color="amber.500" fontSize="sm">
                  {highScore}
                </Text>
              </HStack>
            </Box>

            {streak > 1 && (
              <Badge colorScheme="orange" px={2} py={1} rounded="md">
                <HStack spacing={1}>
                  <IconFlame size={12} />
                  <Text>{streak} streak</Text>
                </HStack>
              </Badge>
            )}

            <Tooltip label={soundEnabled ? "Mute sound" : "Enable sound"}>
              <IconButton
                aria-label="Sound"
                size="sm"
                variant="ghost"
                icon={
                  soundEnabled ? (
                    <IconVolume size={18} />
                  ) : (
                    <IconVolumeOff size={18} />
                  )
                }
                onClick={() => setSoundEnabled((s) => !s)}
              />
            </Tooltip>
          </HStack>
        </Flex>

        {/* Main Game Arena */}
        <SimpleGrid columns={{ base: 1, lg: 12 }} spacing={6} alignItems="start">
          {/* Left / Main Column: 8x8 Board & Dock */}
          <Box
            gridColumn={{ lg: "span 7" }}
            bg={panelBg}
            p={{ base: 3, md: 5 }}
            rounded="2xl"
            boxShadow="sm"
          >
            <Flex justify="space-between" align="center" mb={3}>
              <Text fontSize="xs" fontWeight={700} color="gray.500">
                8×8 PUZZLE BOARD
              </Text>
              <Badge colorScheme="purple" fontSize="xs">
                {linesCleared} lines cleared
              </Badge>
            </Flex>

            {/* 8x8 Grid */}
            <Center>
              <Box
                display="inline-block"
                p={2}
                bg={useColorModeValue("gray.200", "gray.900")}
                rounded="xl"
                onMouseLeave={() => setHoverPos(null)}
              >
                <Stack spacing="2px">
                  {board.map((row, r) => (
                    <HStack key={r} spacing="2px">
                      {row.map((cellColor, c) => {
                        // Check if this cell is highlighted by hover preview
                        let isHoverPreview = false;
                        if (selectedPiece && hoverPos) {
                          const pr = r - hoverPos.r;
                          const pc = c - hoverPos.c;
                          if (
                            pr >= 0 &&
                            pr < selectedPiece.shape.length &&
                            pc >= 0 &&
                            pc < selectedPiece.shape[0]!.length &&
                            selectedPiece.shape[pr]![pc] === 1
                          ) {
                            isHoverPreview = true;
                          }
                        }

                        let cellBg = cellColor || cellEmptyBg;
                        let opacity = 1;

                        if (isHoverPreview) {
                          cellBg = isHoverValid
                            ? selectedPiece!.color
                            : "#ef4444";
                          opacity = isHoverValid ? 0.75 : 0.6;
                        }

                        return (
                          <Box
                            key={c}
                            w={{ base: "36px", sm: "44px" }}
                            h={{ base: "36px", sm: "44px" }}
                            bg={cellBg}
                            opacity={opacity}
                            rounded="md"
                            border="1px solid"
                            borderColor={cellEmptyBorder}
                            transition="all 0.1s"
                            cursor={
                              phase === "placing" && selectedPiece
                                ? "pointer"
                                : "default"
                            }
                            onMouseEnter={() => {
                              if (phase === "placing") {
                                setHoverPos({ r, c });
                              }
                            }}
                            onClick={() => handleCellClick(r, c)}
                            boxShadow={cellColor ? "inset 0 1px 2px rgba(255,255,255,0.3)" : undefined}
                          />
                        );
                      })}
                    </HStack>
                  ))}
                </Stack>
              </Box>
            </Center>

            {/* Piece Dock */}
            <Box mt={5} pt={3} borderTop="1px solid" borderColor={cellEmptyBorder}>
              <Text fontSize="xs" fontWeight={700} color="gray.500" mb={3} textAlign="center">
                {phase === "placing"
                  ? "Select a piece and click the grid to place"
                  : "Answer question to earn pieces"}
              </Text>

              <HStack justify="center" spacing={4} minH="70px">
                {pieces.length > 0 ? (
                  pieces.map((piece) => {
                    const isSelected = selectedPieceId === piece.id;
                    return (
                      <Box
                        key={piece.id}
                        p={2}
                        rounded="xl"
                        border="2px solid"
                        borderColor={isSelected ? piece.color : "transparent"}
                        bg={isSelected ? useColorModeValue("blue.50", "blue.900") : "transparent"}
                        cursor="pointer"
                        transition="all 0.15s"
                        transform={isSelected ? "scale(1.08)" : "scale(1)"}
                        onClick={() => setSelectedPieceId(piece.id)}
                      >
                        <Stack spacing="2px">
                          {piece.shape.map((pRow, pr) => (
                            <HStack key={pr} spacing="2px">
                              {pRow.map((filled, pc) => (
                                <Box
                                  key={pc}
                                  w="14px"
                                  h="14px"
                                  bg={filled ? piece.color : "transparent"}
                                  rounded="xs"
                                />
                              ))}
                            </HStack>
                          ))}
                        </Stack>
                      </Box>
                    );
                  })
                ) : (
                  <Text fontSize="xs" color="gray.400">
                    No pieces in dock.
                  </Text>
                )}
              </HStack>
            </Box>
          </Box>

          {/* Right Column: Active Card Question & Learning Area */}
          <Box
            gridColumn={{ lg: "span 5" }}
            bg={panelBg}
            p={{ base: 4, md: 5 }}
            rounded="2xl"
            boxShadow="sm"
          >
            <Flex align="center" gap={2} mb={3}>
              <IconBrain size={20} color="#3b82f6" />
              <Heading size="xs" textTransform="uppercase" letterSpacing="wide" color="blue.500">
                Active Recall Card
              </Heading>
            </Flex>

            {phase === "question" && currentQuestion ? (
              <Stack spacing={4}>
                <Box
                  p={4}
                  bg={promptBg}
                  border="1px solid"
                  borderColor={promptBorder}
                  rounded="xl"
                >
                  <Text fontSize="xs" color="blue.600" _dark={{ color: "blue.300" }} fontWeight={600} mb={1}>
                    PROMPT
                  </Text>
                  <Text fontSize="md" fontWeight={700}>
                    {currentQuestion.prompt}
                  </Text>
                </Box>

                <Text fontSize="xs" fontWeight={700} color="gray.500">
                  Select the correct match to unlock 3 blocks:
                </Text>

                <Stack spacing={2}>
                  {currentQuestion.choices.map((choice, i) => {
                    const isSelected = selectedChoice === choice;
                    const isCorrect = choice === currentQuestion.correctAnswer;

                    let btnColor = undefined;
                    if (selectedChoice !== null) {
                      if (isCorrect) btnColor = "green";
                      else if (isSelected && !isCorrect) btnColor = "red";
                    }

                    return (
                      <Button
                        key={i}
                        variant={isSelected ? "solid" : "outline"}
                        colorScheme={btnColor}
                        size="md"
                        h="auto"
                        py={3}
                        px={4}
                        justifyContent="flex-start"
                        whiteSpace="normal"
                        textAlign="left"
                        fontSize="xs"
                        fontWeight={600}
                        rounded="xl"
                        isDisabled={selectedChoice !== null}
                        onClick={() => handleAnswer(choice)}
                      >
                        {choice}
                      </Button>
                    );
                  })}
                </Stack>
              </Stack>
            ) : phase === "placing" ? (
              <Stack spacing={4}>
                <Box
                  p={4}
                  bg={useColorModeValue("green.50", "green.950")}
                  border="1px solid"
                  borderColor={useColorModeValue("green.200", "green.800")}
                  rounded="xl"
                  textAlign="center"
                >
                  <Text fontSize="sm" fontWeight={700} color="green.600" _dark={{ color: "green.300" }}>
                    Correct! +100 Points
                  </Text>
                  <Text fontSize="xs" color="gray.600" _dark={{ color: "gray.300" }} mt={1}>
                    Place your 3 earned block pieces onto the grid. Fill complete rows or columns to clear them and score big combos!
                  </Text>
                </Box>

                <Box p={4} bg={statBoxBg} rounded="xl">
                  <Text fontSize="xs" fontWeight={700} color="gray.500" mb={2}>
                    STUDY PROGRESS
                  </Text>
                  <SimpleGrid columns={2} spacing={3}>
                    <Box>
                      <Text fontSize="xs" color="gray.500">CARDS LEARNED</Text>
                      <Text fontSize="lg" fontWeight={700} color="blue.500">{cardsAnswered}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="gray.500">STREAK</Text>
                      <Text fontSize="lg" fontWeight={700} color="orange.500">{streak} 🔥</Text>
                    </Box>
                  </SimpleGrid>
                </Box>
              </Stack>
            ) : null}
          </Box>
        </SimpleGrid>

        {/* Game Over Modal */}
        <Modal
          isOpen={phase === "gameover"}
          onClose={() => {}}
          isCentered
          closeOnOverlayClick={false}
        >
          <ModalOverlay />
          <ModalContent rounded="2xl" p={2}>
            <ModalHeader textAlign="center" pb={1}>
              <IconTrophy size={48} color="#f59e0b" style={{ margin: "0 auto 8px" }} />
              <Heading size="md">Game Over</Heading>
              <Text fontSize="xs" color="gray.500" mt={1}>
                No more remaining pieces can fit on the board.
              </Text>
            </ModalHeader>

            <ModalBody py={4}>
              <Stack spacing={3} bg={statBoxBg} p={4} rounded="xl">
                <Flex justify="space-between" align="center">
                  <Text fontSize="xs" fontWeight={600} color="gray.500">
                    FINAL SCORE
                  </Text>
                  <Text fontSize="lg" fontWeight={800} color="blue.500">
                    {score}
                  </Text>
                </Flex>
                <Flex justify="space-between" align="center">
                  <Text fontSize="xs" fontWeight={600} color="gray.500">
                    HIGH SCORE
                  </Text>
                  <Text fontSize="md" fontWeight={700} color="amber.500">
                    {highScore}
                  </Text>
                </Flex>
                <Flex justify="space-between" align="center">
                  <Text fontSize="xs" fontWeight={600} color="gray.500">
                    CARDS MASTERED
                  </Text>
                  <Text fontSize="sm" fontWeight={700}>
                    {cardsAnswered}
                  </Text>
                </Flex>
                <Flex justify="space-between" align="center">
                  <Text fontSize="xs" fontWeight={600} color="gray.500">
                    LINES CLEARED
                  </Text>
                  <Text fontSize="sm" fontWeight={700}>
                    {linesCleared}
                  </Text>
                </Flex>
              </Stack>
            </ModalBody>

            <ModalFooter pt={2}>
              <HStack w="full" spacing={3}>
                <Button
                  as={Link}
                  href={`/${set?.id}`}
                  variant="ghost"
                  flex="1"
                >
                  Back to Set
                </Button>
                <Button
                  colorScheme="blue"
                  flex="1"
                  leftIcon={<IconRotateClockwise size={16} />}
                  onClick={restartGame}
                >
                  Play Again
                </Button>
              </HStack>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Container>
    </Box>
  );
};

export default BlocksContainer;
