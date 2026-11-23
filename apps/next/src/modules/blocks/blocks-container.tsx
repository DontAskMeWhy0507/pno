import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  IconRefresh,
  IconRotateClockwise,
  IconTrophy,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";

import { effectChannel } from "../../events/effects";
import { useSet } from "../../hooks/use-set";
import { playSound } from "./blocks-audio";
import {
  type BlockPiece,
  GRID_SIZE,
  canPieceFitAnywhere,
  canPlacePiece,
  checkAndClearLines,
  createEmptyBoard,
  getRandomPiece,
  rotatePieceMatrix,
} from "./blocks-shapes";

interface QuestionData {
  prompt: string;
  correctAnswer: string;
  choices: string[];
}

interface DragState {
  piece: BlockPiece;
  clientX: number;
  clientY: number;
  startX: number;
  startY: number;
  grabRowOffset: number;
  grabColOffset: number;
  moved: boolean;
}

function cleanTermText(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/\[sound:[^\]]+\]/gi, " ")
    .replace(/<br\s*\/?>/gi, " / ")
    .replace(/<\/?(?:div|p|li|tr|h[1-6])[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function createDockPieces(): BlockPiece[] {
  return [getRandomPiece(), getRandomPiece(), getRandomPiece()];
}

export const BlocksContainer: React.FC = () => {
  const set = useSet();
  const rawTerms = set?.terms || [];

  const terms = useMemo(() => {
    return rawTerms
      .map((t) => ({
        id: t.id,
        word: cleanTermText(t.word),
        definition: cleanTermText(t.definition),
      }))
      .filter((t) => t.word || t.definition);
  }, [rawTerms]);

  // Audio preference
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Game state — start immediately with 3 pieces in the dock!
  const [board, setBoard] = useState<(string | null)[][]>(createEmptyBoard);
  const [pieces, setPieces] = useState<BlockPiece[]>(() => createDockPieces());
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ r: number; c: number } | null>(
    null,
  );
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Stats
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [linesCleared, setLinesCleared] = useState(0);
  const [streak, setStreak] = useState(0);
  const [cardsAnswered, setCardsAnswered] = useState(0);

  // Phase: 'placing' | 'question' | 'gameover'
  const [phase, setPhase] = useState<"placing" | "question" | "gameover">(
    "placing",
  );
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(
    null,
  );
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const timeoutsRef = useRef<number[]>([]);

  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    timeoutsRef.current.push(id);
  }, []);

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];
  }, []);

  useEffect(() => clearAllTimeouts, [clearAllTimeouts]);

  // Select first available piece automatically if none selected
  useEffect(() => {
    if (
      pieces.length > 0 &&
      (!selectedPieceId || !pieces.some((p) => p.id === selectedPieceId))
    ) {
      setSelectedPieceId(pieces[0]!.id);
    }
  }, [pieces, selectedPieceId]);

  // LocalStorage high score key
  const highScoreKey = `pno_blocks_highscore_${set?.id || "default"}`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(highScoreKey);
      const parsed = saved ? Number(saved) : 0;
      setHighScore(Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
    } catch {
      setHighScore(0);
    }
  }, [highScoreKey]);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      try {
        window.localStorage.setItem(highScoreKey, score.toString());
      } catch {
        // Storage unavailable
      }
    }
  }, [score, highScore, highScoreKey]);

  const updateScore = useCallback((delta: number) => {
    setScore((prev) => prev + delta);
  }, []);

  // Generate a multiple choice question from cleaned set terms
  const generateQuestion = useCallback((): QuestionData | null => {
    if (terms.length === 0) return null;
    const targetIdx = Math.floor(Math.random() * terms.length);
    const target = terms[targetIdx]!;

    const hasBoth = Boolean(target.word && target.definition);
    const isTermPrompt = hasBoth ? Math.random() > 0.4 : Boolean(target.word);
    const prompt = isTermPrompt
      ? target.word || target.definition
      : target.definition || target.word;
    const correctAnswer = isTermPrompt
      ? target.definition || target.word
      : target.word || target.definition;

    const otherAnswers = Array.from(
      new Set(
        terms
          .filter((_, idx) => idx !== targetIdx)
          .map((t) =>
            isTermPrompt ? t.definition || t.word : t.word || t.definition,
          )
          .filter((a) => Boolean(a) && a !== correctAnswer),
      ),
    );

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
  }, [terms]);

  // Trigger question phase when dock is empty
  const triggerNextQuestion = useCallback(() => {
    const q = generateQuestion();
    if (!q) {
      // Fallback if set has no terms
      const fresh = createDockPieces();
      setPieces(fresh);
      setSelectedPieceId(fresh[0]!.id);
      setPhase("placing");
      return;
    }
    setCurrentQuestion(q);
    setSelectedChoice(null);
    setPhase("question");
  }, [generateQuestion]);

  const selectedPiece = useMemo(() => {
    if (dragState) return dragState.piece;
    return pieces.find((p) => p.id === selectedPieceId) || null;
  }, [dragState, pieces, selectedPieceId]);

  // Rotate currently selected piece 90 degrees clockwise
  const handleRotateSelectedPiece = useCallback(() => {
    if (phase !== "placing" || !selectedPieceId) return;
    setPieces((prev) =>
      prev.map((p) =>
        p.id === selectedPieceId
          ? { ...p, shape: rotatePieceMatrix(p.shape) }
          : p,
      ),
    );
  }, [phase, selectedPieceId]);

  // Reroll current dock pieces
  const handleRerollPieces = useCallback(() => {
    if (phase !== "placing") return;
    const fresh = createDockPieces();
    setPieces(fresh);
    setSelectedPieceId(fresh[0]!.id);
    setHoverPos(null);
  }, [phase]);

  // Keyboard shortcut 'R' to rotate selected piece
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "r" || e.key === "R") &&
        phase === "placing" &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        handleRotateSelectedPiece();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleRotateSelectedPiece, phase]);

  // Place a specific piece onto the board at (r, c)
  const placePieceOnBoard = useCallback(
    (pieceToPlace: BlockPiece, r: number, c: number): boolean => {
      if (phase !== "placing") return false;
      if (!canPlacePiece(board, pieceToPlace, r, c)) return false;

      playSound("place", soundEnabled);

      const newBoard = board.map((row) => [...row]);
      let blockCount = 0;
      for (let pr = 0; pr < pieceToPlace.shape.length; pr++) {
        for (let pc = 0; pc < pieceToPlace.shape[0]!.length; pc++) {
          if (pieceToPlace.shape[pr]![pc] === 1) {
            newBoard[r + pr]![c + pc] = pieceToPlace.color;
            blockCount++;
          }
        }
      }

      updateScore(blockCount * 10);

      const { newBoard: clearedBoard, linesCleared: cleared } =
        checkAndClearLines(newBoard);
      if (cleared > 0) {
        playSound("clear", soundEnabled);
        setLinesCleared((l) => l + cleared);
        const clearBonus = cleared * 150 * (cleared > 1 ? cleared : 1);
        updateScore(clearBonus);
        effectChannel.emit("confetti");
      }

      setBoard(clearedBoard);

      const remainingPieces = pieces.filter((p) => p.id !== pieceToPlace.id);
      setPieces(remainingPieces);
      setHoverPos(null);

      if (remainingPieces.length === 0) {
        setSelectedPieceId(null);
        scheduleTimeout(() => {
          triggerNextQuestion();
        }, 250);
      } else {
        setSelectedPieceId(remainingPieces[0]!.id);
        const anyCanFit = remainingPieces.some((p) =>
          canPieceFitAnywhere(clearedBoard, p) ||
          canPieceFitAnywhere(clearedBoard, {
            ...p,
            shape: rotatePieceMatrix(p.shape),
          }) ||
          canPieceFitAnywhere(clearedBoard, {
            ...p,
            shape: rotatePieceMatrix(rotatePieceMatrix(p.shape)),
          }) ||
          canPieceFitAnywhere(clearedBoard, {
            ...p,
            shape: rotatePieceMatrix(
              rotatePieceMatrix(rotatePieceMatrix(p.shape)),
            ),
          }),
        );

        if (!anyCanFit) {
          playSound("gameover", soundEnabled);
          scheduleTimeout(() => {
            setPhase("gameover");
          }, 500);
        }
      }
      return true;
    },
    [
      board,
      phase,
      pieces,
      scheduleTimeout,
      soundEnabled,
      triggerNextQuestion,
      updateScore,
    ],
  );

  // Compute grid cell coordinates from pointer clientX/clientY
  const getGridPosFromPointer = useCallback(
    (
      clientX: number,
      clientY: number,
      grabRowOffset: number,
      grabColOffset: number,
    ): { r: number; c: number } | null => {
      if (!gridRef.current) return null;
      const rect = gridRef.current.getBoundingClientRect();
      const pad = 8; // p={2} = 8px
      const innerWidth = rect.width - pad * 2;
      const innerHeight = rect.height - pad * 2;
      const cellW = innerWidth / GRID_SIZE;
      const cellH = innerHeight / GRID_SIZE;

      const relX = clientX - rect.left - pad;
      const relY = clientY - rect.top - pad;

      // Allow a half-cell margin around the board for forgiving edge drops
      if (
        relX < -cellW * 0.6 ||
        relY < -cellH * 0.6 ||
        relX > innerWidth + cellW * 0.6 ||
        relY > innerHeight + cellH * 0.6
      ) {
        return null;
      }

      const rawCol = Math.floor(relX / cellW) - grabColOffset;
      const rawRow = Math.floor(relY / cellH) - grabRowOffset;
      const c = Math.max(0, Math.min(GRID_SIZE - 1, rawCol));
      const r = Math.max(0, Math.min(GRID_SIZE - 1, rawRow));

      return { r, c };
    },
    [],
  );

  // Pointer drag lifecycle (supports mouse, touch, pen)
  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const moved = dragState.moved || Math.hypot(dx, dy) > 5;

      setDragState((prev) =>
        prev
          ? {
              ...prev,
              clientX: e.clientX,
              clientY: e.clientY,
              moved,
            }
          : null,
      );

      const pos = getGridPosFromPointer(
        e.clientX,
        e.clientY,
        dragState.grabRowOffset,
        dragState.grabColOffset,
      );
      setHoverPos(pos);
    };

    const handlePointerUp = (e: PointerEvent) => {
      const pos = getGridPosFromPointer(
        e.clientX,
        e.clientY,
        dragState.grabRowOffset,
        dragState.grabColOffset,
      );
      if (dragState.moved && pos) {
        placePieceOnBoard(dragState.piece, pos.r, pos.c);
      } else if (!dragState.moved) {
        setHoverPos(null);
      } else {
        setHoverPos(null);
      }
      setDragState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dragState, getGridPosFromPointer, placePieceOnBoard]);

  const handlePiecePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    piece: BlockPiece,
  ) => {
    if (phase !== "placing") return;
    e.preventDefault();
    setSelectedPieceId(piece.id);

    const rect = e.currentTarget.getBoundingClientRect();
    const numRows = piece.shape.length;
    const numCols = piece.shape[0]?.length || 1;
    const relX = Math.max(0, Math.min(rect.width - 1, e.clientX - rect.left));
    const relY = Math.max(0, Math.min(rect.height - 1, e.clientY - rect.top));
    const grabColOffset = Math.min(
      numCols - 1,
      Math.floor((relX / Math.max(1, rect.width)) * numCols),
    );
    const grabRowOffset = Math.min(
      numRows - 1,
      Math.floor((relY / Math.max(1, rect.height)) * numRows),
    );

    setDragState({
      piece,
      clientX: e.clientX,
      clientY: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      grabRowOffset,
      grabColOffset,
      moved: false,
    });
  };

  // Answer handler
  const handleAnswer = (choice: string) => {
    if (selectedChoice !== null || !currentQuestion) return;
    setSelectedChoice(choice);

    const correct = choice === currentQuestion.correctAnswer;

    if (correct) {
      playSound("correct", soundEnabled);
      updateScore(100);
      setStreak((s) => s + 1);
      setCardsAnswered((c) => c + 1);

      const newPieces = createDockPieces();
      setPieces(newPieces);
      setSelectedPieceId(newPieces[0]!.id);
      const anyNewFits = newPieces.some(
        (p) =>
          canPieceFitAnywhere(board, p) ||
          canPieceFitAnywhere(board, {
            ...p,
            shape: rotatePieceMatrix(p.shape),
          }),
      );

      scheduleTimeout(() => {
        setSelectedChoice(null);
        if (!anyNewFits) {
          playSound("gameover", soundEnabled);
          setPhase("gameover");
        } else {
          setPhase("placing");
        }
      }, 550);
    } else {
      playSound("wrong", soundEnabled);
      setStreak(0);
      scheduleTimeout(() => {
        triggerNextQuestion();
      }, 1200);
    }
  };

  // Check if hover placement is valid and which rows/cols would clear
  const { isHoverValid, previewClearRows, previewClearCols } = useMemo(() => {
    if (!selectedPiece || !hoverPos) {
      return {
        isHoverValid: false,
        previewClearRows: new Set<number>(),
        previewClearCols: new Set<number>(),
      };
    }
    const valid = canPlacePiece(board, selectedPiece, hoverPos.r, hoverPos.c);
    if (!valid) {
      return {
        isHoverValid: false,
        previewClearRows: new Set<number>(),
        previewClearCols: new Set<number>(),
      };
    }

    const tempBoard = board.map((row) => [...row]);
    for (let pr = 0; pr < selectedPiece.shape.length; pr++) {
      for (let pc = 0; pc < selectedPiece.shape[0]!.length; pc++) {
        if (selectedPiece.shape[pr]![pc] === 1) {
          tempBoard[hoverPos.r + pr]![hoverPos.c + pc] = selectedPiece.color;
        }
      }
    }

    const rows = new Set<number>();
    const cols = new Set<number>();
    for (let r = 0; r < GRID_SIZE; r++) {
      if (tempBoard[r]!.every((cell) => cell !== null)) rows.add(r);
    }
    for (let c = 0; c < GRID_SIZE; c++) {
      if (tempBoard.every((row) => row[c] !== null)) cols.add(c);
    }

    return {
      isHoverValid: true,
      previewClearRows: rows,
      previewClearCols: cols,
    };
  }, [board, selectedPiece, hoverPos]);

  const handleCellClick = (r: number, c: number) => {
    if (phase !== "placing" || !selectedPiece || dragState?.moved) return;
    placePieceOnBoard(selectedPiece, r, c);
  };

  const restartGame = () => {
    clearAllTimeouts();
    const initialPieces = createDockPieces();
    setBoard(createEmptyBoard());
    setPieces(initialPieces);
    setSelectedPieceId(initialPieces[0]!.id);
    setHoverPos(null);
    setDragState(null);
    setScore(0);
    setStreak(0);
    setLinesCleared(0);
    setCardsAnswered(0);
    setSelectedChoice(null);
    setPhase("placing");
  };

  // All ColorMode hooks hoisted unconditionally
  const bg = useColorModeValue("gray.50", "gray.900");
  const panelBg = useColorModeValue("white", "gray.800");
  const gridFrameBg = useColorModeValue("gray.200", "gray.900");
  const cellEmptyBg = useColorModeValue("gray.100", "gray.750");
  const cellEmptyBorder = useColorModeValue("gray.200", "gray.700");
  const statBoxBg = useColorModeValue("gray.100", "gray.750");
  const promptBg = useColorModeValue("blue.50", "blue.900");
  const promptBorder = useColorModeValue("blue.200", "blue.700");
  const selectedPieceBg = useColorModeValue("blue.50", "blue.900");
  const placingBannerBg = useColorModeValue("green.50", "green.900");
  const placingBannerBorder = useColorModeValue("green.200", "green.700");

  return (
    <Box minH="calc(100vh - 80px)" bg={bg} py={4} userSelect="none">
      {/* Floating Ghost Piece while Dragging */}
      {dragState && dragState.moved && (
        <Box
          pos="fixed"
          left={`${dragState.clientX}px`}
          top={`${dragState.clientY}px`}
          transform={`translate(-${
            dragState.grabColOffset * 38 + 19
          }px, -${dragState.grabRowOffset * 38 + 19}px)`}
          pointerEvents="none"
          zIndex={3000}
          opacity={0.92}
          filter="drop-shadow(0 10px 18px rgba(0,0,0,0.35))"
        >
          <Stack spacing="2px">
            {dragState.piece.shape.map((pRow, pr) => (
              <HStack key={pr} spacing="2px">
                {pRow.map((filled, pc) => (
                  <Box
                    key={pc}
                    w="36px"
                    h="36px"
                    bg={filled ? dragState.piece.color : "transparent"}
                    rounded="md"
                    border={filled ? "1px solid rgba(255,255,255,0.5)" : "none"}
                  />
                ))}
              </HStack>
            ))}
          </Stack>
        </Box>
      )}

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
              <Text
                fontSize="xs"
                color="gray.500"
                display={{ base: "none", md: "block" }}
              >
                {set?.title}
              </Text>
            </HStack>
          </HStack>

          {/* Stats Bar */}
          <HStack spacing={{ base: 2, md: 3 }}>
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
                <Text color="orange.400" fontSize="sm">
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

            <Tooltip label="Restart game">
              <IconButton
                aria-label="Restart game"
                size="sm"
                variant="ghost"
                icon={<IconRotateClockwise size={18} />}
                onClick={restartGame}
              />
            </Tooltip>

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
          {/* Left / Main Column: 8x8 Board & Drag-and-Drop Dock */}
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
              <HStack spacing={2}>
                <Badge colorScheme="purple" fontSize="xs">
                  {linesCleared} lines cleared
                </Badge>
              </HStack>
            </Flex>

            {/* 8x8 Grid */}
            <Center>
              <Box
                ref={gridRef}
                display="inline-block"
                p={2}
                bg={gridFrameBg}
                rounded="xl"
                onMouseLeave={() => {
                  if (!dragState) setHoverPos(null);
                }}
                style={{ touchAction: "none" }}
              >
                <Stack spacing="2px">
                  {board.map((row, r) => (
                    <HStack key={r} spacing="2px">
                      {row.map((cellColor, c) => {
                        let isHoverPreview = false;
                        if (selectedPiece && hoverPos && phase === "placing") {
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

                        const willClear =
                          previewClearRows.has(r) || previewClearCols.has(c);

                        let cellBg = cellColor || cellEmptyBg;
                        let opacity = 1;

                        if (isHoverPreview) {
                          cellBg = isHoverValid
                            ? selectedPiece!.color
                            : "#ef4444";
                          opacity = isHoverValid ? 0.82 : 0.6;
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
                            borderColor={
                              willClear ? "yellow.400" : cellEmptyBorder
                            }
                            transition="background 0.08s, transform 0.08s"
                            transform={willClear ? "scale(0.95)" : undefined}
                            cursor={
                              phase === "placing" && selectedPiece
                                ? "pointer"
                                : "default"
                            }
                            onMouseEnter={() => {
                              if (phase === "placing" && !dragState) {
                                setHoverPos({ r, c });
                              }
                            }}
                            onClick={() => handleCellClick(r, c)}
                            boxShadow={
                              willClear
                                ? "0 0 10px rgba(250, 204, 21, 0.85)"
                                : cellColor
                                  ? "inset 0 1px 2px rgba(255,255,255,0.3)"
                                  : undefined
                            }
                          />
                        );
                      })}
                    </HStack>
                  ))}
                </Stack>
              </Box>
            </Center>

            {/* Piece Dock with Drag-and-Drop + Rotate + Reroll */}
            <Box
              mt={5}
              pt={3}
              borderTop="1px solid"
              borderColor={cellEmptyBorder}
            >
              <Flex
                justify="space-between"
                align="center"
                mb={3}
                wrap="wrap"
                gap={2}
              >
                <Text fontSize="xs" fontWeight={700} color="gray.500">
                  {phase === "placing"
                    ? "Drag & drop (or tap/click) a block piece onto the 8×8 board"
                    : "Answer the question on the right to unlock 3 new blocks"}
                </Text>

                {phase === "placing" && pieces.length > 0 && (
                  <HStack spacing={2}>
                    <Button
                      size="xs"
                      variant="outline"
                      colorScheme="blue"
                      leftIcon={<IconRotateClockwise size={14} />}
                      onClick={handleRotateSelectedPiece}
                      title="Rotate selected block 90° (Key R)"
                    >
                      Rotate (R)
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="gray"
                      leftIcon={<IconRefresh size={14} />}
                      onClick={handleRerollPieces}
                      title="Reroll 3 new blocks"
                    >
                      Reroll
                    </Button>
                  </HStack>
                )}
              </Flex>

              <HStack
                justify="center"
                spacing={{ base: 4, sm: 6 }}
                minH="92px"
                py={2}
              >
                {pieces.length > 0 ? (
                  pieces.map((piece) => {
                    const isSelected = selectedPieceId === piece.id;
                    const isBeingDragged =
                      dragState?.piece.id === piece.id && dragState.moved;

                    return (
                      <Box
                        key={piece.id}
                        p={3}
                        rounded="xl"
                        border="2px solid"
                        borderColor={isSelected ? piece.color : "transparent"}
                        bg={isSelected ? selectedPieceBg : "transparent"}
                        cursor={phase === "placing" ? "grab" : "default"}
                        _active={
                          phase === "placing" ? { cursor: "grabbing" } : undefined
                        }
                        opacity={isBeingDragged ? 0.3 : 1}
                        transition="transform 0.15s, border-color 0.15s"
                        transform={isSelected ? "scale(1.06)" : "scale(1)"}
                        onPointerDown={(e) => handlePiecePointerDown(e, piece)}
                        onClick={() => setSelectedPieceId(piece.id)}
                        style={{ touchAction: "none" }}
                      >
                        <Stack spacing="2px">
                          {piece.shape.map((pRow, pr) => (
                            <HStack key={pr} spacing="2px">
                              {pRow.map((filled, pc) => (
                                <Box
                                  key={pc}
                                  w="18px"
                                  h="18px"
                                  bg={filled ? piece.color : "transparent"}
                                  rounded="xs"
                                  boxShadow={
                                    filled
                                      ? "inset 0 1px 2px rgba(255,255,255,0.35)"
                                      : undefined
                                  }
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
                    All 3 blocks placed — answer the question on the right to get more!
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
              <Heading
                size="xs"
                textTransform="uppercase"
                letterSpacing="wide"
                color="blue.500"
              >
                Active Recall Card
              </Heading>
            </Flex>

            {terms.length === 0 ? (
              <Stack spacing={3} py={4} textAlign="center">
                <Text fontSize="sm" color="gray.500">
                  This study set does not contain any terms yet.
                </Text>
                <Button
                  as={Link}
                  href={`/${set?.id}`}
                  colorScheme="blue"
                  size="sm"
                >
                  Back to study set
                </Button>
              </Stack>
            ) : phase === "question" && currentQuestion ? (
              <Stack spacing={4}>
                <Box
                  p={4}
                  bg={promptBg}
                  border="1px solid"
                  borderColor={promptBorder}
                  rounded="xl"
                >
                  <Text
                    fontSize="xs"
                    color="blue.600"
                    _dark={{ color: "blue.300" }}
                    fontWeight={600}
                    mb={1}
                  >
                    REVIEW QUESTION
                  </Text>
                  <Text fontSize="md" fontWeight={700}>
                    {currentQuestion.prompt}
                  </Text>
                </Box>

                <Text fontSize="xs" fontWeight={700} color="gray.500">
                  Choose the correct answer to unlock 3 new blocks:
                </Text>

                <Stack spacing={2}>
                  {currentQuestion.choices.map((choice, i) => {
                    const isSelected = selectedChoice === choice;
                    const isCorrect = choice === currentQuestion.correctAnswer;

                    let btnColor = undefined;
                    let explicitBg: string | undefined = undefined;
                    if (selectedChoice !== null) {
                      if (isCorrect) {
                        btnColor = "green";
                        explicitBg = "green.500";
                      } else if (isSelected && !isCorrect) {
                        btnColor = "red";
                        explicitBg = "red.500";
                      }
                    }

                    return (
                      <Button
                        key={i}
                        variant={
                          isSelected || (selectedChoice !== null && isCorrect)
                            ? "solid"
                            : "outline"
                        }
                        colorScheme={btnColor}
                        bg={explicitBg}
                        color={explicitBg ? "white" : undefined}
                        _hover={explicitBg ? { bg: explicitBg } : undefined}
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
                  bg={placingBannerBg}
                  border="1px solid"
                  borderColor={placingBannerBorder}
                  rounded="xl"
                  textAlign="center"
                >
                  <Text
                    fontSize="sm"
                    fontWeight={700}
                    color="green.600"
                    _dark={{ color: "green.300" }}
                  >
                    Placement Phase ({pieces.length} {pieces.length === 1 ? "block" : "blocks"} left)
                  </Text>
                  <Text
                    fontSize="xs"
                    color="gray.600"
                    _dark={{ color: "gray.300" }}
                    mt={1}
                  >
                    Drag &amp; drop blocks from the dock onto the 8×8 board (or press R to rotate). Fill rows or columns to score combo points!
                  </Text>
                </Box>

                <Box p={4} bg={statBoxBg} rounded="xl">
                  <Text fontSize="xs" fontWeight={700} color="gray.500" mb={2}>
                    STUDY PROGRESS
                  </Text>
                  <SimpleGrid columns={2} spacing={3}>
                    <Box>
                      <Text fontSize="xs" color="gray.500">
                        CARDS REVIEWED
                      </Text>
                      <Text fontSize="lg" fontWeight={700} color="blue.500">
                        {cardsAnswered}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="gray.500">
                        STREAK
                      </Text>
                      <Text fontSize="lg" fontWeight={700} color="orange.500">
                        {streak} 🔥
                      </Text>
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
              <IconTrophy
                size={48}
                color="#f59e0b"
                style={{ margin: "0 auto 8px" }}
              />
              <Heading size="md">Game Over</Heading>
              <Text fontSize="xs" color="gray.500" mt={1}>
                No valid spaces left on the board for the remaining blocks.
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
                  <Text fontSize="md" fontWeight={700} color="orange.400">
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
