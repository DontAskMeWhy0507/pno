import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Link } from "@pno/components";

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

function canPieceFitAnyRotation(
  board: (string | null)[][],
  piece: BlockPiece,
): boolean {
  let shape = piece.shape;
  for (let rot = 0; rot < 4; rot++) {
    if (canPieceFitAnywhere(board, { ...piece, shape })) return true;
    shape = rotatePieceMatrix(shape);
  }
  return false;
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
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = dragState;

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

    const seen = new Set<string>([correctAnswer.trim().toLowerCase()]);
    const otherAnswers: string[] = [];
    for (let idx = 0; idx < terms.length; idx++) {
      if (idx === targetIdx) continue;
      const t = terms[idx]!;
      const ans = isTermPrompt ? t.definition || t.word : t.word || t.definition;
      const norm = ans.trim().toLowerCase();
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      otherAnswers.push(ans);
    }

    const fisherYates = <T,>(arr: T[]): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      }
      return copy;
    };

    const distractors = fisherYates(otherAnswers).slice(0, 3);
    const choices = fisherYates([...distractors, correctAnswer]);

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
    if (dragRef.current && dragRef.current.piece.id === selectedPieceId) {
      const rotated = {
        ...dragRef.current.piece,
        shape: rotatePieceMatrix(dragRef.current.piece.shape),
      };
      dragRef.current = { ...dragRef.current, piece: rotated };
      setDragState(dragRef.current);
    }
  }, [phase, selectedPieceId]);

  // Reroll current dock pieces
  const handleRerollPieces = useCallback(() => {
    if (phase !== "placing" || terms.length === 0) return;
    clearAllTimeouts();
    const fresh = createDockPieces();
    setPieces(fresh);
    setSelectedPieceId(fresh[0]!.id);
    setHoverPos(null);

    const anyNewFits = fresh.some((p) => canPieceFitAnyRotation(board, p));
    if (!anyNewFits) {
      playSound("gameover", soundEnabled);
      scheduleTimeout(() => {
        setPhase("gameover");
      }, 450);
    }
  }, [board, clearAllTimeouts, phase, scheduleTimeout, soundEnabled, terms.length]);

  // Keyboard shortcut 'R' to rotate selected piece
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable) ||
        document.querySelector('[role="dialog"]')
      ) {
        return;
      }
      if (
        (e.key === "r" || e.key === "R") &&
        phase === "placing" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
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
      if (phase !== "placing" || terms.length === 0) return false;
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
          canPieceFitAnyRotation(clearedBoard, p),
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
      terms.length,
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
      pieceNumRows = 1,
      pieceNumCols = 1,
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
      const maxCol = Math.max(0, GRID_SIZE - pieceNumCols);
      const maxRow = Math.max(0, GRID_SIZE - pieceNumRows);
      const c = Math.max(0, Math.min(maxCol, rawCol));
      const r = Math.max(0, Math.min(maxRow, rawRow));

      return { r, c };
    },
    [],
  );

  const isDragging = Boolean(dragState);

  // Pointer drag lifecycle (supports mouse, touch, pen)
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      const dx = e.clientX - current.startX;
      const dy = e.clientY - current.startY;
      const moved = current.moved || Math.hypot(dx, dy) > 5;

      const updatedDrag: DragState = {
        ...current,
        clientX: e.clientX,
        clientY: e.clientY,
        moved,
      };
      dragRef.current = updatedDrag;
      setDragState(updatedDrag);

      const pos = getGridPosFromPointer(
        e.clientX,
        e.clientY,
        current.grabRowOffset,
        current.grabColOffset,
        current.piece.shape.length,
        current.piece.shape[0]?.length || 1,
      );
      setHoverPos(pos);
    };

    const handlePointerUp = (e: PointerEvent) => {
      const current = dragRef.current;
      dragRef.current = null;
      setDragState(null);

      if (!current) {
        setHoverPos(null);
        return;
      }

      const moved =
        current.moved ||
        Math.hypot(e.clientX - current.startX, e.clientY - current.startY) > 5;
      const pos = getGridPosFromPointer(
        e.clientX,
        e.clientY,
        current.grabRowOffset,
        current.grabColOffset,
        current.piece.shape.length,
        current.piece.shape[0]?.length || 1,
      );
      if (moved && pos) {
        placePieceOnBoard(current.piece, pos.r, pos.c);
      } else {
        setHoverPos(null);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDragging, getGridPosFromPointer, placePieceOnBoard]);

  const handlePiecePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    piece: BlockPiece,
  ) => {
    if (phase !== "placing" || terms.length === 0) return;
    e.preventDefault();
    setSelectedPieceId(piece.id);

    const rect = e.currentTarget.getBoundingClientRect();
    const numRows = piece.shape.length;
    const numCols = piece.shape[0]?.length || 1;
    const padX = 16; // p={3.5} + borderWidth
    const innerW = Math.max(1, rect.width - padX * 2);
    const innerH = Math.max(1, rect.height - padX * 2);
    const relX = Math.max(0, Math.min(innerW - 1, e.clientX - rect.left - padX));
    const relY = Math.max(0, Math.min(innerH - 1, e.clientY - rect.top - padX));
    const grabColOffset = Math.min(
      numCols - 1,
      Math.floor((relX / innerW) * numCols),
    );
    const grabRowOffset = Math.min(
      numRows - 1,
      Math.floor((relY / innerH) * numRows),
    );

    const nextDrag: DragState = {
      piece,
      clientX: e.clientX,
      clientY: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      grabRowOffset,
      grabColOffset,
      moved: false,
    };
    dragRef.current = nextDrag;
    setDragState(nextDrag);
  };

  // Answer handler
  const handleAnswer = useCallback(
    (choice: string) => {
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
        const anyNewFits = newPieces.some((p) =>
          canPieceFitAnyRotation(board, p),
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
    },
    [
      board,
      currentQuestion,
      scheduleTimeout,
      selectedChoice,
      soundEnabled,
      triggerNextQuestion,
      updateScore,
    ],
  );

  // Keyboard shortcuts 1-4 for answer choices during question phase
  useEffect(() => {
    const onNumberKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable) ||
        document.querySelector('[role="dialog"]')
      ) {
        return;
      }
      if (
        phase !== "question" ||
        !currentQuestion ||
        selectedChoice !== null ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      ) {
        return;
      }
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < currentQuestion.choices.length) {
        e.preventDefault();
        handleAnswer(currentQuestion.choices[idx]!);
      }
    };
    window.addEventListener("keydown", onNumberKeyDown);
    return () => window.removeEventListener("keydown", onNumberKeyDown);
  }, [currentQuestion, handleAnswer, phase, selectedChoice]);

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
    dragRef.current = null;
    setDragState(null);
    setScore(0);
    setStreak(0);
    setLinesCleared(0);
    setCardsAnswered(0);
    setCurrentQuestion(null);
    setSelectedChoice(null);
    setPhase("placing");
  };

  // All ColorMode hooks hoisted unconditionally
  const bg = useColorModeValue("gray.50", "gray.900");
  const panelBg = useColorModeValue("white", "gray.800");
  const panelBorder = useColorModeValue("gray.200", "gray.700");
  const gridFrameBg = useColorModeValue("gray.200", "gray.900");
  const cellEmptyBg = useColorModeValue("gray.100", "gray.750");
  const cellEmptyBorder = useColorModeValue("gray.200", "gray.700");
  const statBoxBg = useColorModeValue("gray.100", "gray.750");
  const promptBg = useColorModeValue("blue.50", "blue.900");
  const promptBorder = useColorModeValue("blue.200", "blue.700");
  const selectedPieceBg = useColorModeValue("blue.50", "blue.900");
  const placingBannerBg = useColorModeValue("green.50", "green.900");
  const placingBannerBorder = useColorModeValue("green.200", "green.700");
  const choiceBg = useColorModeValue("white", "gray.750");
  const choiceBorder = useColorModeValue("gray.200", "gray.600");
  const choiceHoverBorder = useColorModeValue("blue.400", "blue.300");
  const choiceHoverBg = useColorModeValue("blue.50", "gray.700");
  const choiceTextColor = useColorModeValue("gray.800", "gray.100");
  const choiceBadgeBg = useColorModeValue("gray.100", "gray.700");

  const ghostCellSize = gridRef.current
    ? Math.max(
        34,
        Math.round(
          (gridRef.current.getBoundingClientRect().width -
            16 -
            (GRID_SIZE - 1) * 2) /
            GRID_SIZE,
        ),
      )
    : 54;

  return (
    <Box minH="calc(100vh - 80px)" bg={bg} py={{ base: 3, md: 5 }} userSelect="none">
      {/* Floating Ghost Piece while Dragging */}
      {dragState && dragState.moved && (
        <Box
          pos="fixed"
          left={`${dragState.clientX}px`}
          top={`${dragState.clientY}px`}
          transform={`translate(-${
            dragState.grabColOffset * (ghostCellSize + 2) + ghostCellSize / 2
          }px, -${dragState.grabRowOffset * (ghostCellSize + 2) + ghostCellSize / 2}px)`}
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
                    w={`${ghostCellSize}px`}
                    h={`${ghostCellSize}px`}
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

      <Container maxW="1440px" px={{ base: 3, md: 6, xl: 8 }}>
        {/* Top bar */}
        <Flex
          justify="space-between"
          align="center"
          mb={5}
          p={{ base: 3, md: 4 }}
          bg={panelBg}
          borderWidth="2px"
          borderColor={panelBorder}
          rounded="2xl"
          boxShadow="sm"
        >
          <HStack spacing={3}>
            <Tooltip label="Back to set">
              <IconButton
                as={Link}
                href={`/${set?.id}`}
                aria-label="Back"
                icon={<IconArrowLeft size={20} />}
                size="sm"
                variant="ghost"
              />
            </Tooltip>
            <HStack spacing={2.5}>
              <IconCube color="#3b82f6" size={26} />
              <Heading size="md" fontWeight={700}>
                Blocks
              </Heading>
              <Text
                fontSize="sm"
                color="gray.500"
                display={{ base: "none", md: "block" }}
                fontWeight={500}
              >
                {set?.title}
              </Text>
            </HStack>
          </HStack>

          {/* Stats Bar */}
          <HStack spacing={{ base: 2, md: 3 }}>
            <Box
              px={3.5}
              py={1.5}
              bg={statBoxBg}
              rounded="xl"
              fontSize={{ base: "xs", sm: "sm" }}
              fontWeight={700}
            >
              <HStack spacing={1.5}>
                <Text color="gray.500">SCORE</Text>
                <Text color="blue.500" fontSize={{ base: "sm", sm: "md" }}>
                  {score}
                </Text>
              </HStack>
            </Box>

            <Box
              px={3.5}
              py={1.5}
              bg={statBoxBg}
              rounded="xl"
              fontSize={{ base: "xs", sm: "sm" }}
              fontWeight={700}
              display={{ base: "none", sm: "block" }}
            >
              <HStack spacing={1.5}>
                <IconTrophy size={16} color="#f59e0b" />
                <Text color="gray.500">BEST</Text>
                <Text color="orange.400" fontSize={{ base: "sm", sm: "md" }}>
                  {highScore}
                </Text>
              </HStack>
            </Box>

            {streak > 1 && (
              <Badge colorScheme="orange" px={2.5} py={1.5} rounded="lg" fontSize="xs">
                <HStack spacing={1}>
                  <IconFlame size={14} />
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
        <SimpleGrid columns={{ base: 1, lg: 12 }} spacing={6} alignItems="stretch">
          {/* Left / Main Column: 8x8 Board & Drag-and-Drop Dock */}
          <Box
            gridColumn={{ lg: "span 7" }}
            bg={panelBg}
            p={{ base: 4, md: 6 }}
            rounded="2xl"
            borderWidth="2px"
            borderColor={panelBorder}
            boxShadow="md"
          >
            <Flex justify="space-between" align="center" mb={4}>
              <Text fontSize="sm" fontWeight={700} color="gray.500">
                8×8 PUZZLE BOARD
              </Text>
              <HStack spacing={2}>
                <Badge colorScheme="purple" fontSize="xs" px={2.5} py={0.5} rounded="md">
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
                            w={{ base: "38px", sm: "48px", md: "56px", xl: "62px" }}
                            h={{ base: "38px", sm: "48px", md: "56px", xl: "62px" }}
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
              pt={4}
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
                <Text fontSize="sm" fontWeight={700} color="gray.500">
                  {phase === "placing"
                    ? "Drag & drop (or tap/click) a block piece onto the 8×8 board"
                    : "Answer the question on the right to unlock 3 new blocks"}
                </Text>

                {phase === "placing" && pieces.length > 0 && (
                  <HStack spacing={2}>
                    <Button
                      size="sm"
                      variant="outline"
                      colorScheme="blue"
                      leftIcon={<IconRotateClockwise size={15} />}
                      onClick={handleRotateSelectedPiece}
                      title="Rotate selected block 90° (Key R)"
                    >
                      Rotate (R)
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      colorScheme="gray"
                      leftIcon={<IconRefresh size={15} />}
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
                spacing={{ base: 4, sm: 8 }}
                minH="110px"
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
                        p={3.5}
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
                        <Stack spacing="3px">
                          {piece.shape.map((pRow, pr) => (
                            <HStack key={pr} spacing="3px">
                              {pRow.map((filled, pc) => (
                                <Box
                                  key={pc}
                                  w={{ base: "22px", md: "26px" }}
                                  h={{ base: "22px", md: "26px" }}
                                  bg={filled ? piece.color : "transparent"}
                                  rounded="sm"
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
                  <Text fontSize="sm" fontWeight={500} color="gray.400">
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
            p={{ base: 4, md: 6 }}
            rounded="2xl"
            borderWidth="2px"
            borderColor={panelBorder}
            boxShadow="md"
          >
            <Flex align="center" gap={2} mb={4}>
              <IconBrain size={22} color="#3b82f6" />
              <Heading
                size="sm"
                textTransform="uppercase"
                letterSpacing="wide"
                color="blue.500"
              >
                Active Recall Card
              </Heading>
            </Flex>

            {terms.length === 0 ? (
              <Stack spacing={4} py={6} textAlign="center">
                <Text fontSize="md" color="gray.500">
                  This study set does not contain any terms yet.
                </Text>
                <Button
                  as={Link}
                  href={`/${set?.id}`}
                  colorScheme="blue"
                  size="md"
                >
                  Back to study set
                </Button>
              </Stack>
            ) : phase === "question" && currentQuestion ? (
              <Stack spacing={4}>
                <Box
                  p={5}
                  bg={promptBg}
                  borderWidth="2px"
                  borderColor={promptBorder}
                  rounded="xl"
                >
                  <Text
                    fontSize="xs"
                    color="blue.600"
                    _dark={{ color: "blue.300" }}
                    fontWeight={700}
                    letterSpacing="wider"
                    mb={1.5}
                  >
                    REVIEW QUESTION
                  </Text>
                  <Text fontSize={{ base: "lg", md: "xl" }} fontWeight={700} lineHeight="1.5">
                    {currentQuestion.prompt}
                  </Text>
                </Box>

                <Text fontSize="sm" fontWeight={600} color="gray.500">
                  Choose the correct answer to unlock 3 new blocks:
                </Text>

                <Stack spacing={3}>
                  {currentQuestion.choices.map((choice, i) => {
                    const isSelected = selectedChoice === choice;
                    const isCorrect = choice === currentQuestion.correctAnswer;
                    const answered = selectedChoice !== null;

                    let cardBg = choiceBg;
                    let cardBorder = choiceBorder;
                    let cardColor = choiceTextColor;
                    let badgeBg = choiceBadgeBg;
                    let badgeColor = choiceTextColor;

                    if (answered) {
                      if (isCorrect) {
                        cardBg = "green.500";
                        cardBorder = "green.500";
                        cardColor = "white";
                        badgeBg = "green.600";
                        badgeColor = "white";
                      } else if (isSelected && !isCorrect) {
                        cardBg = "red.500";
                        cardBorder = "red.500";
                        cardColor = "white";
                        badgeBg = "red.600";
                        badgeColor = "white";
                      }
                    }

                    return (
                      <Box
                        key={i}
                        as="button"
                        type="button"
                        w="full"
                        p={4}
                        rounded="xl"
                        borderWidth="2px"
                        borderColor={cardBorder}
                        bg={cardBg}
                        color={cardColor}
                        textAlign="left"
                        display="flex"
                        alignItems="flex-start"
                        gap={3}
                        whiteSpace="normal"
                        wordBreak="break-word"
                        h="auto"
                        overflow="visible"
                        cursor={answered ? "default" : "pointer"}
                        opacity={answered && !isCorrect && !isSelected ? 0.65 : 1}
                        transition="all 0.15s ease"
                        _hover={
                          !answered
                            ? {
                                borderColor: choiceHoverBorder,
                                bg: choiceHoverBg,
                                transform: "translateY(-1px)",
                              }
                            : undefined
                        }
                        _focusVisible={{
                          outline: "2px solid",
                          outlineColor: "blue.400",
                          outlineOffset: "2px",
                        }}
                        disabled={answered}
                        onClick={() => handleAnswer(choice)}
                      >
                        <Box
                          minW="28px"
                          h="28px"
                          rounded="lg"
                          bg={badgeBg}
                          color={badgeColor}
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          fontSize="xs"
                          fontWeight={700}
                          flexShrink={0}
                          mt="1px"
                        >
                          {i + 1}
                        </Box>
                        <Text
                          fontSize={{ base: "sm", md: "md" }}
                          fontWeight={500}
                          lineHeight="1.55"
                          flex="1"
                        >
                          {choice}
                        </Text>
                      </Box>
                    );
                  })}
                </Stack>
              </Stack>
            ) : phase === "placing" ? (
              <Stack spacing={4}>
                <Box
                  p={5}
                  bg={placingBannerBg}
                  borderWidth="2px"
                  borderColor={placingBannerBorder}
                  rounded="xl"
                  textAlign="center"
                >
                  <Text
                    fontSize="md"
                    fontWeight={700}
                    color="green.600"
                    _dark={{ color: "green.300" }}
                  >
                    Placement Phase ({pieces.length} {pieces.length === 1 ? "block" : "blocks"} left)
                  </Text>
                  <Text
                    fontSize="sm"
                    color="gray.600"
                    _dark={{ color: "gray.300" }}
                    mt={1.5}
                    lineHeight="1.5"
                  >
                    Drag &amp; drop blocks from the dock onto the 8×8 board (or press R to rotate). Fill rows or columns to score combo points!
                  </Text>
                </Box>

                <Box p={5} bg={statBoxBg} rounded="xl">
                  <Text fontSize="xs" fontWeight={700} color="gray.500" mb={3}>
                    STUDY PROGRESS
                  </Text>
                  <SimpleGrid columns={2} spacing={4}>
                    <Box>
                      <Text fontSize="xs" color="gray.500" fontWeight={600}>
                        CARDS REVIEWED
                      </Text>
                      <Text fontSize="2xl" fontWeight={700} color="blue.500">
                        {cardsAnswered}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="gray.500" fontWeight={600}>
                        STREAK
                      </Text>
                      <Text fontSize="2xl" fontWeight={700} color="orange.500">
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
