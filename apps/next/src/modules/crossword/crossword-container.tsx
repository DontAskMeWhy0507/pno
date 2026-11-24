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
  IconBulb,
  IconCheck,
  IconClock,
  IconEye,
  IconGridDots,
  IconRefresh,
  IconTrophy,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";

import { effectChannel } from "../../events/effects";
import { useSet } from "../../hooks/use-set";
import { playSound } from "../blocks/blocks-audio";
import {
  type CrosswordDirection,
  type CrosswordWord,
  generateCrosswordPuzzle,
} from "./crossword-generator";

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function getWordCoords(word: CrosswordWord): { r: number; c: number }[] {
  const dr = word.direction === "down" ? 1 : 0;
  const dc = word.direction === "across" ? 1 : 0;
  return Array.from({ length: word.answer.length }, (_, i) => ({
    r: word.row + i * dr,
    c: word.col + i * dc,
  }));
}

export const CrosswordContainer: React.FC = () => {
  const set = useSet();
  const rawTerms = useMemo(() => set?.terms || [], [set?.terms]);

  const [puzzleSeed, setPuzzleSeed] = useState(0);
  const puzzle = useMemo(() => {
    void puzzleSeed;
    return generateCrosswordPuzzle(rawTerms, 12);
  }, [puzzleSeed, rawTerms]);

  const [userGrid, setUserGrid] = useState<Record<string, string>>({});
  const [checkedMap, setCheckedMap] = useState<
    Record<string, "correct" | "wrong">
  >({});
  const [activeCoord, setActiveCoord] = useState<{
    r: number;
    c: number;
  } | null>(null);
  const [activeDirection, setActiveDirection] =
    useState<CrosswordDirection>("across");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [isSolved, setIsSolved] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const wasActiveOnPointerDownRef = useRef(false);

  // Reset puzzle state whenever puzzle changes
  useEffect(() => {
    inputRefs.current = {};
    setUserGrid({});
    setCheckedMap({});
    setElapsedSeconds(0);
    setHintsUsed(0);
    setIsSolved(false);

    if (puzzle.words.length > 0) {
      const firstWord = puzzle.words[0]!;
      setActiveCoord({ r: firstWord.row, c: firstWord.col });
      setActiveDirection(firstWord.direction);
    } else {
      setActiveCoord(null);
    }
  }, [puzzle]);

  // Live timer
  useEffect(() => {
    if (puzzle.words.length === 0 || isSolved) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isSolved, puzzle.words.length]);

  const focusCell = useCallback((r: number, c: number) => {
    setActiveCoord({ r, c });
    window.requestAnimationFrame(() => {
      inputRefs.current[cellKey(r, c)]?.focus();
    });
  }, []);

  // Determine the currently active word
  const activeWord = useMemo<CrosswordWord | null>(() => {
    if (puzzle.words.length === 0) return null;
    if (!activeCoord) return puzzle.words[0] || null;
    const cell = puzzle.grid[activeCoord.r]?.[activeCoord.c];
    if (!cell || cell.wordIds.length === 0) return puzzle.words[0] || null;

    const matchingDirection = puzzle.words.find(
      (w) => cell.wordIds.includes(w.id) && w.direction === activeDirection,
    );
    if (matchingDirection) return matchingDirection;

    return (
      puzzle.words.find((w) => cell.wordIds.includes(w.id)) ||
      puzzle.words[0] ||
      null
    );
  }, [activeCoord, activeDirection, puzzle.grid, puzzle.words]);

  const activeWordCoordSet = useMemo(() => {
    const s = new Set<string>();
    if (!activeWord) return s;
    for (const pos of getWordCoords(activeWord)) {
      s.add(cellKey(pos.r, pos.c));
    }
    return s;
  }, [activeWord]);

  // Check which words are fully and accurately filled
  const solvedWordIds = useMemo(() => {
    const s = new Set<string>();
    for (const w of puzzle.words) {
      const coords = getWordCoords(w);
      const complete = coords.every((pos, idx) => {
        const val = (userGrid[cellKey(pos.r, pos.c)] || "").toUpperCase();
        return val === w.answer[idx];
      });
      if (complete) s.add(w.id);
    }
    return s;
  }, [puzzle.words, userGrid]);

  // Trigger victory when all words are solved
  useEffect(() => {
    if (
      !isSolved &&
      puzzle.words.length > 0 &&
      solvedWordIds.size === puzzle.words.length
    ) {
      setIsSolved(true);
      playSound("clear", soundEnabled);
      effectChannel.emit("confetti");
    }
  }, [isSolved, puzzle.words.length, solvedWordIds.size, soundEnabled]);

  const acrossWords = useMemo(
    () => puzzle.words.filter((w) => w.direction === "across"),
    [puzzle.words],
  );
  const downWords = useMemo(
    () => puzzle.words.filter((w) => w.direction === "down"),
    [puzzle.words],
  );

  const handleCellClick = (r: number, c: number) => {
    const cell = puzzle.grid[r]?.[c];
    if (!cell || !cell.letter) return;

    if (wasActiveOnPointerDownRef.current && cell.wordIds.length > 1) {
      const nextDir: CrosswordDirection =
        activeDirection === "across" ? "down" : "across";
      setActiveDirection(nextDir);
    } else if (!cell.wordIds.includes(activeWord?.id || "")) {
      const hasCurrentDir = puzzle.words.some(
        (w) => cell.wordIds.includes(w.id) && w.direction === activeDirection,
      );
      if (!hasCurrentDir) {
        const firstWord = puzzle.words.find((w) => cell.wordIds.includes(w.id));
        if (firstWord) setActiveDirection(firstWord.direction);
      }
    }
    wasActiveOnPointerDownRef.current = false;
    focusCell(r, c);
  };

  const handleSelectClue = (word: CrosswordWord) => {
    setActiveDirection(word.direction);
    // Focus first empty cell in this word, or start of word
    const coords = getWordCoords(word);
    const firstEmpty =
      coords.find((pos) => !userGrid[cellKey(pos.r, pos.c)]) || coords[0]!;
    focusCell(firstEmpty.r, firstEmpty.c);
  };

  const updateCellLetter = (r: number, c: number, rawVal: string) => {
    if (isSolved) return;
    const normalized = rawVal
      .replace(/[đĐ]/g, "D")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z]/g, "")
      .toUpperCase();

    if (rawVal.trim().length > 0 && normalized.length === 0) {
      return;
    }

    const k = cellKey(r, c);
    const prevLetter = userGrid[k] || "";
    let cleaned = normalized.slice(-1);
    if (
      normalized.length >= 2 &&
      prevLetter &&
      normalized.endsWith(prevLetter) &&
      normalized[0] !== prevLetter
    ) {
      cleaned = normalized[0]!;
    }

    setUserGrid((prev) => {
      const next = { ...prev };
      if (cleaned) {
        next[k] = cleaned;
      } else {
        delete next[k];
      }
      return next;
    });
    setCheckedMap((prev) => {
      if (!(k in prev)) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });

    if (cleaned && activeWord) {
      playSound("place", soundEnabled);
      const coords = getWordCoords(activeWord);
      const idx = coords.findIndex((pos) => pos.r === r && pos.c === c);
      if (idx >= 0 && idx + 1 < coords.length) {
        const nextPos = coords[idx + 1]!;
        focusCell(nextPos.r, nextPos.c);
      }
    }
  };

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    r: number,
    c: number,
  ) => {
    if (isSolved) return;

    if (e.key === "Backspace") {
      e.preventDefault();
      const k = cellKey(r, c);
      if (userGrid[k]) {
        updateCellLetter(r, c, "");
      } else if (activeWord) {
        const coords = getWordCoords(activeWord);
        const idx = coords.findIndex((pos) => pos.r === r && pos.c === c);
        if (idx > 0) {
          const prevPos = coords[idx - 1]!;
          const prevKey = cellKey(prevPos.r, prevPos.c);
          focusCell(prevPos.r, prevPos.c);
          setUserGrid((prev) => {
            const next = { ...prev };
            delete next[prevKey];
            return next;
          });
          setCheckedMap((prev) => {
            if (!(prevKey in prev)) return prev;
            const next = { ...prev };
            delete next[prevKey];
            return next;
          });
        }
      }
      return;
    }

    if (e.key === " " || e.key === "Tab") {
      const cell = puzzle.grid[r]?.[c];
      if (e.key === " " || (e.key === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        if (cell && cell.wordIds.length > 1) {
          setActiveDirection((d) => (d === "across" ? "down" : "across"));
        } else if (puzzle.words.length > 0 && activeWord) {
          const idx = puzzle.words.findIndex((w) => w.id === activeWord.id);
          const nextWord = puzzle.words[(idx + 1) % puzzle.words.length]!;
          handleSelectClue(nextWord);
        }
      }
      return;
    }

    const moveMap: Record<string, { dr: number; dc: number }> = {
      ArrowUp: { dr: -1, dc: 0 },
      ArrowDown: { dr: 1, dc: 0 },
      ArrowLeft: { dr: 0, dc: -1 },
      ArrowRight: { dr: 0, dc: 1 },
    };

    const delta = moveMap[e.key];
    if (delta) {
      e.preventDefault();
      let nr = r + delta.dr;
      let nc = c + delta.dc;
      while (nr >= 0 && nr < puzzle.rows && nc >= 0 && nc < puzzle.cols) {
        if (puzzle.grid[nr]?.[nc]?.letter) {
          focusCell(nr, nc);
          break;
        }
        nr += delta.dr;
        nc += delta.dc;
      }
    }
  };

  const handleCheckPuzzle = () => {
    const nextChecked: Record<string, "correct" | "wrong"> = {};
    let hasWrong = false;
    let filledCount = 0;
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        const cell = puzzle.grid[r]?.[c];
        if (!cell?.letter) continue;
        const k = cellKey(r, c);
        const val = (userGrid[k] || "").toUpperCase();
        if (!val) continue;
        filledCount++;
        if (val === cell.letter) {
          nextChecked[k] = "correct";
        } else {
          nextChecked[k] = "wrong";
          hasWrong = true;
        }
      }
    }
    setCheckedMap(nextChecked);
    if (filledCount > 0) {
      playSound(hasWrong ? "wrong" : "correct", soundEnabled);
    }
  };

  const handleHintCell = () => {
    if (isSolved) return;
    let target = activeCoord;
    if (!target || !puzzle.grid[target.r]?.[target.c]?.letter) {
      if (!activeWord) return;
      const coords = getWordCoords(activeWord);
      target =
        coords.find(
          (pos) =>
            (userGrid[cellKey(pos.r, pos.c)] || "") !==
            puzzle.grid[pos.r]?.[pos.c]?.letter,
        ) || coords[0]!;
    }
    const cell = puzzle.grid[target.r]?.[target.c];
    if (!cell?.letter) return;

    const k = cellKey(target.r, target.c);
    setUserGrid((prev) => ({ ...prev, [k]: cell.letter! }));
    setCheckedMap((prev) => ({ ...prev, [k]: "correct" }));
    setHintsUsed((h) => h + 1);
    playSound("correct", soundEnabled);

    if (activeWord) {
      const coords = getWordCoords(activeWord);
      const idx = coords.findIndex(
        (pos) => pos.r === target!.r && pos.c === target!.c,
      );
      if (idx >= 0 && idx + 1 < coords.length) {
        const nextPos = coords[idx + 1]!;
        focusCell(nextPos.r, nextPos.c);
      }
    }
  };

  const handleRevealWord = () => {
    if (!activeWord || isSolved) return;
    const coords = getWordCoords(activeWord);
    const updates: Record<string, string> = {};
    const checkedUpdates: Record<string, "correct"> = {};
    coords.forEach((pos, i) => {
      const k = cellKey(pos.r, pos.c);
      updates[k] = activeWord.answer[i]!;
      checkedUpdates[k] = "correct";
    });
    setUserGrid((prev) => ({ ...prev, ...updates }));
    setCheckedMap((prev) => ({ ...prev, ...checkedUpdates }));
    setHintsUsed((h) => h + coords.length);
    playSound("correct", soundEnabled);
  };

  const handleNewPuzzle = () => {
    setPuzzleSeed((s) => s + 1);
  };

  // All ColorMode hooks hoisted unconditionally at top level
  const bg = useColorModeValue("gray.50", "gray.900");
  const panelBg = useColorModeValue("white", "gray.800");
  const panelBorder = useColorModeValue("gray.200", "gray.700");
  const boardFrameBg = useColorModeValue("gray.100", "gray.900");
  const cellBgDefault = useColorModeValue("white", "gray.750");
  const cellBorderDefault = useColorModeValue("gray.300", "gray.600");
  const cellBgActiveWord = useColorModeValue("blue.50", "blue.900");
  const cellBgFocused = useColorModeValue("blue.100", "blue.800");
  const cellBgCorrect = useColorModeValue("green.50", "green.900");
  const cellBgWrong = useColorModeValue("red.50", "red.900");
  const cellTextDefault = useColorModeValue("gray.900", "white");
  const clueBannerBg = useColorModeValue("blue.50", "blue.900");
  const clueBannerBorder = useColorModeValue("blue.200", "blue.700");
  const clueItemBg = useColorModeValue("white", "gray.750");
  const clueItemActiveBg = useColorModeValue("blue.50", "blue.900");
  const clueItemActiveBorder = useColorModeValue("blue.500", "blue.300");
  const statBoxBg = useColorModeValue("gray.100", "gray.750");

  const cellPx = useMemo(() => {
    if (puzzle.cols <= 0) return 44;
    return Math.max(30, Math.min(48, Math.floor(620 / puzzle.cols)));
  }, [puzzle.cols]);

  return (
    <Box minH="calc(100vh - 80px)" bg={bg} py={{ base: 3, md: 5 }}>
      <Container maxW="1440px" px={{ base: 3, md: 6, xl: 8 }}>
        {/* Top Bar */}
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
          wrap="wrap"
          gap={3}
        >
          <HStack spacing={3}>
            <Tooltip label="Back to set">
              <IconButton
                as={Link}
                href={`/${set?.id}`}
                aria-label="Back to set"
                icon={<IconArrowLeft size={20} />}
                size="sm"
                variant="ghost"
              />
            </Tooltip>
            <HStack spacing={2.5}>
              <IconGridDots color="#3b82f6" size={26} />
              <Heading size="md" fontWeight={700}>
                Crossword
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

          {/* Controls & Stats */}
          <HStack spacing={2} flexWrap="wrap">
            <Box px={3} py={1.5} bg={statBoxBg} rounded="xl" fontSize="sm" fontWeight={700}>
              <HStack spacing={1.5}>
                <IconCheck size={16} color="#10b981" />
                <Text color="green.500">
                  {solvedWordIds.size} / {puzzle.words.length} words
                </Text>
              </HStack>
            </Box>

            <Box px={3} py={1.5} bg={statBoxBg} rounded="xl" fontSize="sm" fontWeight={700}>
              <HStack spacing={1.5}>
                <IconClock size={16} color="#3b82f6" />
                <Text>{formatTimer(elapsedSeconds)}</Text>
              </HStack>
            </Box>

            <Button
              size="sm"
              variant="outline"
              colorScheme="blue"
              leftIcon={<IconCheck size={16} />}
              onClick={handleCheckPuzzle}
              isDisabled={puzzle.words.length === 0}
            >
              Check
            </Button>

            <Button
              size="sm"
              variant="outline"
              colorScheme="orange"
              leftIcon={<IconBulb size={16} />}
              onClick={handleHintCell}
              isDisabled={puzzle.words.length === 0 || isSolved}
            >
              Hint
            </Button>

            <Button
              size="sm"
              variant="outline"
              colorScheme="purple"
              leftIcon={<IconEye size={16} />}
              onClick={handleRevealWord}
              isDisabled={!activeWord || isSolved}
            >
              Reveal Word
            </Button>

            <Button
              size="sm"
              colorScheme="blue"
              leftIcon={<IconRefresh size={16} />}
              onClick={handleNewPuzzle}
            >
              New Puzzle
            </Button>

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

        {puzzle.words.length === 0 ? (
          <Box
            bg={panelBg}
            borderWidth="2px"
            borderColor={panelBorder}
            rounded="2xl"
            p={8}
            textAlign="center"
          >
            <Stack spacing={4} align="center">
              <Heading size="md">Not Enough Eligible Terms</Heading>
              <Text fontSize="md" color="gray.500" maxW="md">
                Crossword needs at least one term with 2–16 English letters (A–Z) to build an intersecting puzzle.
              </Text>
              <Button as={Link} href={`/${set?.id}`} colorScheme="blue">
                Back to Study Set
              </Button>
            </Stack>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, lg: 12 }} spacing={6} alignItems="start">
            {/* Left Column: Active Clue Banner + Crossword Grid */}
            <Box
              gridColumn={{ lg: "span 7" }}
              bg={panelBg}
              p={{ base: 4, md: 6 }}
              rounded="2xl"
              borderWidth="2px"
              borderColor={panelBorder}
              boxShadow="md"
            >
              {/* Active Clue Banner */}
              {activeWord && (
                <Box
                  mb={5}
                  p={4}
                  bg={clueBannerBg}
                  borderWidth="2px"
                  borderColor={clueBannerBorder}
                  rounded="xl"
                >
                  <HStack justify="space-between" mb={1.5} flexWrap="wrap" gap={2}>
                    <HStack spacing={2}>
                      <Badge
                        colorScheme="blue"
                        fontSize="xs"
                        px={2.5}
                        py={0.5}
                        rounded="md"
                        textTransform="uppercase"
                      >
                        {activeWord.number} {activeWord.direction}
                      </Badge>
                      <Text fontSize="xs" fontWeight={700} color="gray.500">
                        ({activeWord.answer.length} letters)
                      </Text>
                    </HStack>
                    <Text fontSize="xs" color="gray.500" fontWeight={600}>
                      Click intersection or press Space to switch direction
                    </Text>
                  </HStack>
                  <Text
                    fontSize={{ base: "sm", md: "md" }}
                    fontWeight={700}
                    lineHeight="1.5"
                  >
                    {activeWord.clue}
                  </Text>
                </Box>
              )}

              {/* Grid Container */}
              <Box overflowX="auto" py={2}>
                <Box w="max-content" mx="auto">
                  <Box
                    display="inline-block"
                    p={3}
                    bg={boardFrameBg}
                    rounded="xl"
                    borderWidth="2px"
                    borderColor={panelBorder}
                  >
                    <Stack spacing="3px">
                      {puzzle.grid.map((row, r) => (
                        <HStack key={r} spacing="3px">
                          {row.map((cell, c) => {
                            if (!cell.letter) {
                              return (
                                <Box
                                  key={c}
                                  w={`${cellPx}px`}
                                  h={`${cellPx}px`}
                                  flexShrink={0}
                                />
                              );
                            }

                            const k = cellKey(r, c);
                            const isFocused =
                              activeCoord?.r === r && activeCoord?.c === c;
                            const isInActiveWord = activeWordCoordSet.has(k);
                            const checkStatus = checkedMap[k];

                            let boxBg = cellBgDefault;
                            let boxBorder = cellBorderDefault;
                            if (checkStatus === "correct") {
                              boxBg = cellBgCorrect;
                              boxBorder = "green.400";
                            } else if (checkStatus === "wrong") {
                              boxBg = cellBgWrong;
                              boxBorder = "red.400";
                            } else if (isFocused) {
                              boxBg = cellBgFocused;
                              boxBorder = "blue.500";
                            } else if (isInActiveWord) {
                              boxBg = cellBgActiveWord;
                              boxBorder = "blue.300";
                            }

                            return (
                              <Box
                                key={c}
                                position="relative"
                                w={`${cellPx}px`}
                                h={`${cellPx}px`}
                                flexShrink={0}
                                bg={boxBg}
                                color={cellTextDefault}
                                borderWidth="2px"
                                borderColor={boxBorder}
                                rounded="md"
                                cursor="pointer"
                                transition="border-color 0.1s, background 0.1s"
                                onMouseDown={() => {
                                  wasActiveOnPointerDownRef.current =
                                    activeCoord?.r === r && activeCoord?.c === c;
                                }}
                                onClick={() => handleCellClick(r, c)}
                              >
                                {cell.clueNumber !== undefined && (
                                  <Text
                                    position="absolute"
                                    top="2px"
                                    left="3px"
                                    fontSize="9px"
                                    fontWeight={800}
                                    lineHeight="1"
                                    color="gray.500"
                                    pointerEvents="none"
                                    userSelect="none"
                                  >
                                    {cell.clueNumber}
                                  </Text>
                                )}
                                <input
                                  ref={(el) => {
                                    inputRefs.current[k] = el;
                                  }}
                                  type="text"
                                  inputMode="text"
                                  maxLength={2}
                                  autoComplete="off"
                                  spellCheck={false}
                                  aria-label={`Row ${r + 1} Column ${c + 1}`}
                                  value={userGrid[k] || ""}
                                  onFocus={(e) => {
                                    setActiveCoord({ r, c });
                                    e.currentTarget.select();
                                  }}
                                  onChange={(e) =>
                                    updateCellLetter(r, c, e.target.value)
                                  }
                                  onKeyDown={(e) => handleCellKeyDown(e, r, c)}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    border: "none",
                                    outline: "none",
                                    background: "transparent",
                                    textAlign: "center",
                                    fontWeight: 800,
                                    fontSize: `${Math.max(14, Math.round(cellPx * 0.44))}px`,
                                    textTransform: "uppercase",
                                    paddingTop: cell.clueNumber ? "6px" : "0px",
                                    cursor: "pointer",
                                    color: "inherit",
                                  }}
                                  className="notranslate"
                                />
                              </Box>
                            );
                          })}
                        </HStack>
                      ))}
                    </Stack>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Right Column: Across & Down Clue Lists */}
            <Box
              gridColumn={{ lg: "span 5" }}
              bg={panelBg}
              p={{ base: 4, md: 6 }}
              rounded="2xl"
              borderWidth="2px"
              borderColor={panelBorder}
              boxShadow="md"
            >
              <Stack spacing={5} maxH={{ lg: "700px" }} overflowY="auto" pr={1}>
                {/* Across Clues */}
                {acrossWords.length > 0 && (
                  <Box>
                    <Heading
                      size="sm"
                      textTransform="uppercase"
                      letterSpacing="wide"
                      color="blue.500"
                      mb={3}
                    >
                      Across ({acrossWords.length})
                    </Heading>
                    <Stack spacing={2.5}>
                      {acrossWords.map((w) => {
                        const isActive = activeWord?.id === w.id;
                        const solved = solvedWordIds.has(w.id);
                        return (
                          <Box
                            key={w.id}
                            as="button"
                            type="button"
                            w="full"
                            p={3.5}
                            rounded="xl"
                            borderWidth="2px"
                            borderColor={
                              isActive ? clueItemActiveBorder : panelBorder
                            }
                            bg={isActive ? clueItemActiveBg : clueItemBg}
                            textAlign="left"
                            onClick={() => handleSelectClue(w)}
                            transition="all 0.12s"
                            _hover={{ borderColor: clueItemActiveBorder }}
                          >
                            <Flex justify="space-between" align="flex-start" gap={3}>
                              <HStack align="flex-start" spacing={2.5} flex="1">
                                <Badge
                                  colorScheme={isActive ? "blue" : "gray"}
                                  fontSize="xs"
                                  px={2}
                                  py={0.5}
                                  rounded="md"
                                  mt="2px"
                                  flexShrink={0}
                                >
                                  {w.number}A
                                </Badge>
                                <Text fontSize="sm" fontWeight={500} lineHeight="1.5">
                                  {w.clue}{" "}
                                  <Text as="span" color="gray.500" fontSize="xs" fontWeight={700}>
                                    ({w.answer.length})
                                  </Text>
                                </Text>
                              </HStack>
                              {solved && (
                                <Box color="green.500" flexShrink={0} mt="2px">
                                  <IconCheck size={18} />
                                </Box>
                              )}
                            </Flex>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                )}

                {/* Down Clues */}
                {downWords.length > 0 && (
                  <Box>
                    <Heading
                      size="sm"
                      textTransform="uppercase"
                      letterSpacing="wide"
                      color="blue.500"
                      mb={3}
                    >
                      Down ({downWords.length})
                    </Heading>
                    <Stack spacing={2.5}>
                      {downWords.map((w) => {
                        const isActive = activeWord?.id === w.id;
                        const solved = solvedWordIds.has(w.id);
                        return (
                          <Box
                            key={w.id}
                            as="button"
                            type="button"
                            w="full"
                            p={3.5}
                            rounded="xl"
                            borderWidth="2px"
                            borderColor={
                              isActive ? clueItemActiveBorder : panelBorder
                            }
                            bg={isActive ? clueItemActiveBg : clueItemBg}
                            textAlign="left"
                            onClick={() => handleSelectClue(w)}
                            transition="all 0.12s"
                            _hover={{ borderColor: clueItemActiveBorder }}
                          >
                            <Flex justify="space-between" align="flex-start" gap={3}>
                              <HStack align="flex-start" spacing={2.5} flex="1">
                                <Badge
                                  colorScheme={isActive ? "blue" : "gray"}
                                  fontSize="xs"
                                  px={2}
                                  py={0.5}
                                  rounded="md"
                                  mt="2px"
                                  flexShrink={0}
                                >
                                  {w.number}D
                                </Badge>
                                <Text fontSize="sm" fontWeight={500} lineHeight="1.5">
                                  {w.clue}{" "}
                                  <Text as="span" color="gray.500" fontSize="xs" fontWeight={700}>
                                    ({w.answer.length})
                                  </Text>
                                </Text>
                              </HStack>
                              {solved && (
                                <Box color="green.500" flexShrink={0} mt="2px">
                                  <IconCheck size={18} />
                                </Box>
                              )}
                            </Flex>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Box>
          </SimpleGrid>
        )}

        {/* Victory Modal */}
        <Modal isOpen={isSolved} onClose={() => {}} isCentered closeOnOverlayClick={false}>
          <ModalOverlay backdropFilter="blur(6px)" />
          <ModalContent rounded="2xl" p={2} borderWidth="2px" borderColor={panelBorder}>
            <ModalHeader textAlign="center" pb={1}>
              <IconTrophy
                size={52}
                color="#f59e0b"
                style={{ margin: "0 auto 8px" }}
              />
              <Heading size="md">Crossword Complete!</Heading>
              <Text fontSize="sm" color="gray.500" mt={1}>
                Great job solving every word in {set?.title}.
              </Text>
            </ModalHeader>

            <ModalBody py={4}>
              <Stack spacing={3} bg={statBoxBg} p={4} rounded="xl">
                <Flex justify="space-between" align="center">
                  <Text fontSize="xs" fontWeight={700} color="gray.500">
                    WORDS SOLVED
                  </Text>
                  <Text fontSize="lg" fontWeight={800} color="green.500">
                    {puzzle.words.length} / {puzzle.words.length}
                  </Text>
                </Flex>
                <Flex justify="space-between" align="center">
                  <Text fontSize="xs" fontWeight={700} color="gray.500">
                    COMPLETION TIME
                  </Text>
                  <Text fontSize="md" fontWeight={700} color="blue.500">
                    {formatTimer(elapsedSeconds)}
                  </Text>
                </Flex>
                <Flex justify="space-between" align="center">
                  <Text fontSize="xs" fontWeight={700} color="gray.500">
                    HINTS USED
                  </Text>
                  <Text fontSize="md" fontWeight={700}>
                    {hintsUsed}
                  </Text>
                </Flex>
              </Stack>
            </ModalBody>

            <ModalFooter pt={2}>
              <HStack w="full" spacing={3}>
                <Button as={Link} href={`/${set?.id}`} variant="ghost" flex="1">
                  Back to Set
                </Button>
                <Button
                  colorScheme="blue"
                  flex="1"
                  leftIcon={<IconRefresh size={16} />}
                  onClick={handleNewPuzzle}
                >
                  New Puzzle
                </Button>
              </HStack>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Container>
    </Box>
  );
};

export default CrosswordContainer;
