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
  Container,
  Flex,
  HStack,
  Heading,
  IconButton,
  Input,
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
  IconFlame,
  IconHeart,
  IconHeartFilled,
  IconMeteor,
  IconPlayerPause,
  IconPlayerPlay,
  IconRotateClockwise,
  IconTrophy,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";

import { effectChannel } from "../../events/effects";
import { useSet } from "../../hooks/use-set";
import { playSound } from "../blocks/blocks-audio";

type AnswerWithMode = "term" | "definition";
type Difficulty = "easy" | "medium" | "hard";
type AsteroidKind = "standard" | "red" | "gold";

interface StudyTerm {
  id: string;
  word: string;
  definition: string;
}

interface Asteroid {
  uid: string;
  termId: string;
  prompt: string;
  answer: string;
  kind: AsteroidKind;
  x: number; // 8..74 (%)
  y: number; // 0..88 (%)
  speed: number; // % per second
}

interface ScoreBurst {
  uid: string;
  x: number;
  y: number;
  points: number;
  kind: AsteroidKind;
}

const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { label: string; baseSpeed: number; spawnInterval: number; description: string }
> = {
  easy: {
    label: "Easy",
    baseSpeed: 5.5,
    spawnInterval: 5.5,
    description: "Gentle fall speed — ideal for learning new vocabulary.",
  },
  medium: {
    label: "Medium",
    baseSpeed: 8.2,
    spawnInterval: 4.2,
    description: "Balanced pace that rewards quick recall.",
  },
  hard: {
    label: "Hard",
    baseSpeed: 11.5,
    spawnInterval: 3.0,
    description: "Fast arcade challenge for mastery review.",
  },
};

const MAX_LIVES = 3;

function cleanGravityText(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/\[sound:[^\]]+\]/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
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

function normalizeAnswer(raw: string, stripDiacritics = false): string {
  let cleaned = raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/(?:^|[\s(])\/[^\s/][^/\n]*?(?<!\s)\/(?=$|[\s.,;)])/g, " ")
    .replace(/^[\s.,!?;:'"()\-–—]+|[\s.,!?;:'"()\-–—]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (stripDiacritics) {
    cleaned = cleaned
      .replace(/[đĐ]/g, "d")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }
  return cleaned;
}

function doesInputMatchAnswer(input: string, targetAnswer: string): boolean {
  const normInput = normalizeAnswer(input, false);
  const foldInput = normalizeAnswer(input, true);
  if (!normInput && !foldInput) return false;

  const normFull = normalizeAnswer(targetAnswer, false);
  const foldFull = normalizeAnswer(targetAnswer, true);
  if (normInput === normFull || (foldInput.length >= 2 && foldInput === foldFull))
    return true;

  // Also allow matching individual slash/semicolon/comma/newline alternatives
  const parts = targetAnswer
    .split(/[\/;\n]/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
  return parts.some(
    (p) =>
      normalizeAnswer(p, false) === normInput ||
      (foldInput.length >= 2 && normalizeAnswer(p, true) === foldInput),
  );
}

export const GravityContainer: React.FC = () => {
  const set = useSet();
  const rawTerms = set?.terms || [];

  const terms = useMemo<StudyTerm[]>(() => {
    return rawTerms
      .map((t) => ({
        id: t.id,
        word: cleanGravityText(t.word),
        definition: cleanGravityText(t.definition),
      }))
      .filter((t) => Boolean(t.word) && Boolean(t.definition));
  }, [rawTerms]);

  const [answerWith, setAnswerWith] = useState<AnswerWithMode>("term");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [phase, setPhase] = useState<"setup" | "playing" | "missed" | "gameover">(
    "setup",
  );
  const [isPaused, setIsPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [asteroids, setAsteroids] = useState<Asteroid[]>([]);
  const [scoreBursts, setScoreBursts] = useState<ScoreBurst[]>([]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(MAX_LIVES);
  const [destroyedCount, setDestroyedCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [typedInput, setTypedInput] = useState("");
  const [shakeInput, setShakeInput] = useState(false);
  const [hintPreview, setHintPreview] = useState<string | null>(null);
  const [missedEvent, setMissedEvent] = useState<{
    prompt: string;
    answer: string;
  } | null>(null);
  const [missedHistory, setMissedHistory] = useState<
    { id: string; prompt: string; answer: string }[]
  >([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutsRef = useRef<number[]>([]);
  const missedAtRef = useRef<number>(0);

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

  // Mutable simulation ref for jitter-free 60fps animation
  const simRef = useRef<{
    asteroids: Asteroid[];
    missedQueue: StudyTerm[];
    shuffledTerms: StudyTerm[];
    termIndex: number;
    spawnTimer: number;
    lastTimestamp: number | null;
    level: number;
    lives: number;
    destroyedCount: number;
  }>({
    asteroids: [],
    missedQueue: [],
    shuffledTerms: [],
    termIndex: 0,
    spawnTimer: 0,
    lastTimestamp: null,
    level: 1,
    lives: MAX_LIVES,
    destroyedCount: 0,
  });

  const highScoreKey = `pno_gravity_highscore_${set?.id || "default"}`;

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
        // Ignore storage quota errors
      }
    }
  }, [highScore, highScoreKey, score]);

  const spawnAsteroid = useCallback(
    (forceImmediate = false) => {
      if (terms.length === 0) return;

      const sim = simRef.current;
      if (!forceImmediate && sim.asteroids.length >= 5) return;

      let chosenTerm: StudyTerm;
      let kind: AsteroidKind = "standard";

      if (sim.missedQueue.length > 0 && Math.random() < 0.5) {
        chosenTerm = sim.missedQueue.shift()!;
        kind = "red";
      } else {
        const pool =
          sim.shuffledTerms.length > 0 ? sim.shuffledTerms : terms;
        const idx = sim.termIndex % pool.length;
        chosenTerm = pool[idx]!;
        sim.termIndex++;
        if (Math.random() < 0.15) {
          kind = "gold";
        }
      }

      const prompt =
        answerWith === "term" ? chosenTerm.definition : chosenTerm.word;
      const answer =
        answerWith === "term" ? chosenTerm.word : chosenTerm.definition;

      const cfg = DIFFICULTY_CONFIG[difficulty];
      const levelMultiplier = 1 + (sim.level - 1) * 0.14;
      const kindMultiplier = kind === "red" ? 1.12 : kind === "gold" ? 1.08 : 1;
      const speed = cfg.baseSpeed * levelMultiplier * kindMultiplier;

      // Pick centered x position between 18% and 82%, avoiding overlap with top asteroids
      let x = 18 + Math.random() * 64;
      const topAsteroids = sim.asteroids.filter((a) => a.y < 24);
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidateX = 18 + Math.random() * 64;
        if (topAsteroids.every((a) => Math.abs(a.x - candidateX) > 18)) {
          x = candidateX;
          break;
        }
      }

      const newAsteroid: Asteroid = {
        uid: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        termId: chosenTerm.id,
        prompt,
        answer,
        kind,
        x,
        y: 2,
        speed,
      };

      sim.asteroids = [...sim.asteroids, newAsteroid];
      setAsteroids(sim.asteroids);
    },
    [answerWith, difficulty, terms],
  );

  const startGame = useCallback(() => {
    if (terms.length === 0) return;
    clearAllTimeouts();
    const shuffled = [...terms];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    simRef.current = {
      asteroids: [],
      missedQueue: [],
      shuffledTerms: shuffled,
      termIndex: 0,
      spawnTimer: 0,
      lastTimestamp: null,
      level: 1,
      lives: MAX_LIVES,
      destroyedCount: 0,
    };
    setAsteroids([]);
    setScoreBursts([]);
    setScore(0);
    setLevel(1);
    setLives(MAX_LIVES);
    setDestroyedCount(0);
    setStreak(0);
    setTypedInput("");
    setHintPreview(null);
    setMissedEvent(null);
    setMissedHistory([]);
    setIsPaused(false);
    setPhase("playing");

    scheduleTimeout(() => inputRef.current?.focus(), 60);
  }, [clearAllTimeouts, scheduleTimeout, terms]);

  const handleContinueFromMissed = useCallback(() => {
    setMissedEvent(null);
    simRef.current.lastTimestamp = null;
    if (simRef.current.lives <= 0) {
      playSound("gameover", soundEnabled);
      setPhase("gameover");
    } else {
      // Nudge remaining near-bottom asteroids back up so user isn't hit twice instantly
      simRef.current.asteroids = simRef.current.asteroids.map((a) =>
        a.y > 55 ? { ...a, y: 55 } : a,
      );
      setAsteroids(simRef.current.asteroids);
      setPhase("playing");
      if (simRef.current.asteroids.length === 0) {
        spawnAsteroid(true);
      }
      scheduleTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [scheduleTimeout, soundEnabled, spawnAsteroid]);

  // Allow pressing Enter to continue from missed-asteroid pause (with debounce so typing Enter doesn't skip overlay)
  useEffect(() => {
    if (phase !== "missed") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && Date.now() - missedAtRef.current >= 350) {
        e.preventDefault();
        handleContinueFromMissed();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleContinueFromMissed, phase]);

  // Main animation loop
  useEffect(() => {
    if (phase !== "playing" || isPaused) {
      simRef.current.lastTimestamp = null;
      return;
    }

    let rafId = 0;
    const tick = (now: number) => {
      const sim = simRef.current;
      if (sim.lastTimestamp === null) {
        sim.lastTimestamp = now;
      }
      const dt = Math.min((now - sim.lastTimestamp) / 1000, 0.1);
      sim.lastTimestamp = now;

      // Advance falling asteroids
      let hitBottom: Asteroid | null = null;
      const updated = sim.asteroids.map((a) => {
        const nextY = a.y + a.speed * dt;
        if (nextY >= 78 && !hitBottom) {
          hitBottom = a;
        }
        return { ...a, y: nextY };
      });

      if (hitBottom) {
        const lostAsteroid: Asteroid = hitBottom;
        sim.asteroids = updated.filter((a) => a.uid !== lostAsteroid.uid);
        sim.lives = Math.max(0, sim.lives - 1);
        missedAtRef.current = Date.now();

        const matchedTerm = terms.find((t) => t.id === lostAsteroid.termId);
        if (
          matchedTerm &&
          !sim.missedQueue.some((m) => m.id === matchedTerm.id)
        ) {
          sim.missedQueue.push(matchedTerm);
        }

        setAsteroids(sim.asteroids);
        setLives(sim.lives);
        setStreak(0);
        setTypedInput("");
        setHintPreview(null);
        setMissedEvent({
          prompt: lostAsteroid.prompt,
          answer: lostAsteroid.answer,
        });
        setMissedHistory((prev) =>
          prev.some((m) => m.prompt === lostAsteroid.prompt)
            ? prev
            : [
                ...prev,
                {
                  id: lostAsteroid.uid,
                  prompt: lostAsteroid.prompt,
                  answer: lostAsteroid.answer,
                },
              ],
        );
        playSound("wrong", soundEnabled);
        setPhase("missed");
        return;
      }

      sim.asteroids = updated;
      setAsteroids(updated);

      // Periodic spawn
      const cfg = DIFFICULTY_CONFIG[difficulty];
      const spawnCooldown = Math.max(
        1.5,
        cfg.spawnInterval - (sim.level - 1) * 0.25,
      );
      sim.spawnTimer += dt;
      if (sim.asteroids.length === 0 || sim.spawnTimer >= spawnCooldown) {
        sim.spawnTimer = 0;
        spawnAsteroid(false);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [difficulty, isPaused, phase, soundEnabled, spawnAsteroid, terms]);

  const destroyAsteroid = useCallback(
    (target: Asteroid) => {
      const sim = simRef.current;
      sim.asteroids = sim.asteroids.filter((a) => a.uid !== target.uid);
      setAsteroids(sim.asteroids);

      const pts = target.kind === "gold" ? 250 : target.kind === "red" ? 200 : 100;
      setScore((s) => s + pts);
      setStreak((st) => st + 1);
      setHintPreview(null);
      setTypedInput("");

      sim.destroyedCount += 1;
      const nextCount = sim.destroyedCount;
      setDestroyedCount(nextCount);
      const nextLevel = Math.floor(nextCount / 5) + 1;
      if (nextLevel > sim.level) {
        sim.level = nextLevel;
        setLevel(nextLevel);
        playSound("clear", soundEnabled);
        effectChannel.emit("confetti");
      } else {
        playSound("correct", soundEnabled);
      }

      const burstId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setScoreBursts((prev) => [
        ...prev,
        { uid: burstId, x: target.x, y: target.y, points: pts, kind: target.kind },
      ]);
      scheduleTimeout(() => {
        setScoreBursts((prev) => prev.filter((b) => b.uid !== burstId));
      }, 850);

      if (sim.asteroids.length === 0) {
        sim.spawnTimer = 0;
        spawnAsteroid(true);
      }
    },
    [scheduleTimeout, soundEnabled, spawnAsteroid],
  );

  const handleInputChange = (val: string) => {
    setTypedInput(val);
    if (phase !== "playing" || isPaused) return;

    // Prefer lowest asteroid (highest y) if multiple share the same answer
    const sorted = [...simRef.current.asteroids].sort((a, b) => b.y - a.y);
    const match = sorted.find((a) => doesInputMatchAnswer(val, a.answer));
    if (match) {
      destroyAsteroid(match);
    }
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phase !== "playing" || isPaused || !typedInput.trim()) return;

    const sorted = [...simRef.current.asteroids].sort((a, b) => b.y - a.y);
    const match = sorted.find((a) =>
      doesInputMatchAnswer(typedInput, a.answer),
    );
    if (match) {
      destroyAsteroid(match);
    } else {
      setShakeInput(true);
      playSound("wrong", soundEnabled);
      window.setTimeout(() => setShakeInput(false), 320);
    }
  };

  const handleHint = () => {
    if (phase !== "playing" || simRef.current.asteroids.length === 0) return;
    const lowest = [...simRef.current.asteroids].sort((a, b) => b.y - a.y)[0]!;
    const cleanTarget = lowest.answer.trim();
    const revealLen = Math.min(cleanTarget.length, Math.max(2, Math.ceil(cleanTarget.length / 2)));
    setHintPreview(`${cleanTarget.slice(0, revealLen)}${revealLen < cleanTarget.length ? "..." : ""}`);
    inputRef.current?.focus();
  };

  // All ColorMode hooks hoisted unconditionally at top level
  const bg = useColorModeValue("gray.50", "gray.900");
  const panelBg = useColorModeValue("white", "gray.800");
  const panelBorder = useColorModeValue("gray.200", "gray.700");
  const statBoxBg = useColorModeValue("gray.100", "gray.750");
  const cardOptionBg = useColorModeValue("white", "gray.750");
  const cardSelectedBg = useColorModeValue("blue.50", "blue.900");
  const missedListBg = useColorModeValue("gray.50", "gray.750");

  return (
    <Box minH="calc(100vh - 80px)" bg={bg} py={{ base: 3, md: 5 }}>
      <Container maxW="1440px" px={{ base: 3, md: 6, xl: 8 }}>
        {/* Top HUD Bar */}
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
              <IconMeteor color="#3b82f6" size={26} />
              <Heading size="md" fontWeight={700}>
                Gravity
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

          {/* HUD Stats & Controls */}
          <HStack spacing={{ base: 2, md: 3 }} flexWrap="wrap">
            <Box px={3} py={1.5} bg={statBoxBg} rounded="xl" fontSize="sm" fontWeight={700}>
              <HStack spacing={1.5}>
                <Text color="gray.500" fontSize="xs">
                  LEVEL
                </Text>
                <Text color="purple.400">{level}</Text>
              </HStack>
            </Box>

            <Box px={3} py={1.5} bg={statBoxBg} rounded="xl" fontSize="sm" fontWeight={700}>
              <HStack spacing={1.5}>
                <Text color="gray.500" fontSize="xs">
                  SCORE
                </Text>
                <Text color="blue.500">{score}</Text>
              </HStack>
            </Box>

            <Box
              px={3}
              py={1.5}
              bg={statBoxBg}
              rounded="xl"
              fontSize="sm"
              fontWeight={700}
              display={{ base: "none", sm: "block" }}
            >
              <HStack spacing={1.5}>
                <IconTrophy size={15} color="#f59e0b" />
                <Text color="gray.500" fontSize="xs">
                  BEST
                </Text>
                <Text color="orange.400">{highScore}</Text>
              </HStack>
            </Box>

            {streak > 1 && (
              <Badge colorScheme="orange" px={2.5} py={1.5} rounded="lg" fontSize="xs">
                <HStack spacing={1}>
                  <IconFlame size={14} />
                  <Text>{streak}</Text>
                </HStack>
              </Badge>
            )}

            {/* Lives Hearts */}
            <HStack spacing={1} px={2.5} py={1.5} bg={statBoxBg} rounded="xl">
              {Array.from({ length: MAX_LIVES }).map((_, i) =>
                i < lives ? (
                  <IconHeartFilled key={i} size={16} color="#ef4444" />
                ) : (
                  <IconHeart key={i} size={16} color="#94a3b8" />
                ),
              )}
            </HStack>

            {phase === "playing" && (
              <Tooltip label={isPaused ? "Resume" : "Pause"}>
                <IconButton
                  aria-label={isPaused ? "Resume" : "Pause"}
                  size="sm"
                  variant="ghost"
                  icon={
                    isPaused ? (
                      <IconPlayerPlay size={18} />
                    ) : (
                      <IconPlayerPause size={18} />
                    )
                  }
                  onClick={() => {
                    setIsPaused((prev) => {
                      const next = !prev;
                      if (!next) {
                        scheduleTimeout(() => inputRef.current?.focus(), 40);
                      }
                      return next;
                    });
                  }}
                />
              </Tooltip>
            )}

            <Tooltip label="Restart game">
              <IconButton
                aria-label="Restart"
                size="sm"
                variant="ghost"
                icon={<IconRotateClockwise size={18} />}
                onClick={startGame}
                isDisabled={terms.length === 0}
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

        {terms.length === 0 ? (
          <Box
            bg={panelBg}
            borderWidth="2px"
            borderColor={panelBorder}
            rounded="2xl"
            p={8}
            textAlign="center"
          >
            <Stack spacing={4} align="center">
              <Heading size="md">No Study Terms Available</Heading>
              <Text fontSize="md" color="gray.500">
                Add terms with definitions to this set before playing Gravity.
              </Text>
              <Button as={Link} href={`/${set?.id}`} colorScheme="blue">
                Back to Study Set
              </Button>
            </Stack>
          </Box>
        ) : phase === "setup" ? (
          /* Setup Screen */
          <Box
            maxW="2xl"
            mx="auto"
            bg={panelBg}
            borderWidth="2px"
            borderColor={panelBorder}
            rounded="2xl"
            p={{ base: 5, md: 8 }}
            boxShadow="lg"
          >
            <Stack spacing={6}>
              <Box textAlign="center">
                <IconMeteor
                  size={44}
                  color="#3b82f6"
                  style={{ margin: "0 auto 10px" }}
                />
                <Heading size="lg">Protect the Planet!</Heading>
                <Text fontSize="md" color="gray.500" mt={1.5}>
                  Type answers fast to destroy falling asteroids before they strike the surface. Missed terms return as Red Asteroids for extra practice!
                </Text>
              </Box>

              {/* Answer With */}
              <Box>
                <Text fontSize="sm" fontWeight={700} mb={2.5} color="gray.500">
                  ANSWER WITH
                </Text>
                <SimpleGrid columns={2} spacing={3}>
                  {(
                    [
                      {
                        value: "term",
                        title: "Term",
                        desc: "See definition, type the matching term",
                      },
                      {
                        value: "definition",
                        title: "Definition",
                        desc: "See term, type the definition",
                      },
                    ] as const
                  ).map((opt) => {
                    const active = answerWith === opt.value;
                    return (
                      <Box
                        key={opt.value}
                        as="button"
                        type="button"
                        p={4}
                        rounded="xl"
                        borderWidth="2px"
                        borderColor={active ? "blue.500" : panelBorder}
                        bg={active ? cardSelectedBg : cardOptionBg}
                        textAlign="left"
                        onClick={() => setAnswerWith(opt.value)}
                        transition="all 0.12s"
                      >
                        <Text fontSize="md" fontWeight={700}>
                          {opt.title}
                        </Text>
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          {opt.desc}
                        </Text>
                      </Box>
                    );
                  })}
                </SimpleGrid>
              </Box>

              {/* Difficulty */}
              <Box>
                <Text fontSize="sm" fontWeight={700} mb={2.5} color="gray.500">
                  DIFFICULTY
                </Text>
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3}>
                  {(["easy", "medium", "hard"] as Difficulty[]).map((lvl) => {
                    const active = difficulty === lvl;
                    const cfg = DIFFICULTY_CONFIG[lvl];
                    return (
                      <Box
                        key={lvl}
                        as="button"
                        type="button"
                        p={4}
                        rounded="xl"
                        borderWidth="2px"
                        borderColor={active ? "blue.500" : panelBorder}
                        bg={active ? cardSelectedBg : cardOptionBg}
                        textAlign="left"
                        onClick={() => setDifficulty(lvl)}
                        transition="all 0.12s"
                      >
                        <Text fontSize="md" fontWeight={700}>
                          {cfg.label}
                        </Text>
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          {cfg.description}
                        </Text>
                      </Box>
                    );
                  })}
                </SimpleGrid>
              </Box>

              <Button
                colorScheme="blue"
                size="lg"
                rounded="xl"
                fontWeight={700}
                onClick={startGame}
                leftIcon={<IconMeteor size={20} />}
              >
                Start Game
              </Button>
            </Stack>
          </Box>
        ) : (
          /* Active Playfield + Bottom Typing Console */
          <Stack spacing={4}>
            {/* Space Arena */}
            <Box
              position="relative"
              minH="460px"
              h="calc(100vh - 300px)"
              maxH="660px"
              rounded="2xl"
              overflow="hidden"
              borderWidth="2px"
              borderColor={panelBorder}
              boxShadow="xl"
              bgGradient="linear(to-b, #0b1120, #172554 70%, #1e1b4b)"
              sx={{
                "@keyframes floatBurst": {
                  "0%": { opacity: 1, transform: "translateY(0) scale(1)" },
                  "100%": { opacity: 0, transform: "translateY(-36px) scale(1.15)" },
                },
              }}
            >
              {/* Subtle Starfield Background */}
              <Box
                position="absolute"
                inset={0}
                opacity={0.45}
                pointerEvents="none"
                backgroundImage="radial-gradient(white 1px, transparent 1px), radial-gradient(rgba(147,197,253,0.8) 1px, transparent 1px)"
                backgroundSize="48px 48px, 76px 76px"
                backgroundPosition="0 0, 24px 38px"
              />

              {/* Glowing Planetary Horizon */}
              <Box
                position="absolute"
                bottom="-32px"
                left="-10%"
                right="-10%"
                h="84px"
                borderRadius="50%"
                bgGradient="radial(ellipse at top, rgba(59,130,246,0.55), rgba(30,58,138,0.15) 70%, transparent)"
                borderTop="2px solid rgba(96,165,250,0.65)"
                boxShadow="0 -8px 32px rgba(59,130,246,0.45)"
                pointerEvents="none"
              />

              {/* Falling Asteroids */}
              {asteroids.map((a) => {
                const styleMap: Record<
                  AsteroidKind,
                  { border: string; bg: string; glow: string; badge: string; label?: string }
                > = {
                  standard: {
                    border: "rgba(96, 165, 250, 0.7)",
                    bg: "rgba(15, 23, 42, 0.88)",
                    glow: "0 6px 22px rgba(59, 130, 246, 0.35)",
                    badge: "#3b82f6",
                  },
                  red: {
                    border: "rgba(248, 113, 113, 0.85)",
                    bg: "rgba(69, 10, 10, 0.9)",
                    glow: "0 6px 24px rgba(239, 68, 68, 0.45)",
                    badge: "#ef4444",
                    label: "RED ASTEROID • +200",
                  },
                  gold: {
                    border: "rgba(251, 191, 36, 0.85)",
                    bg: "rgba(69, 26, 3, 0.9)",
                    glow: "0 6px 24px rgba(245, 158, 11, 0.45)",
                    badge: "#f59e0b",
                    label: "BONUS • +250",
                  },
                };

                const st = styleMap[a.kind];

                return (
                  <Box
                    key={a.uid}
                    position="absolute"
                    left={`${a.x}%`}
                    top={`${a.y}%`}
                    transform="translateX(-50%)"
                    maxW={{ base: "200px", md: "260px" }}
                    minW="140px"
                    px={4}
                    py={3}
                    rounded="2xl"
                    bg={st.bg}
                    border="2px solid"
                    borderColor={st.border}
                    boxShadow={st.glow}
                    backdropFilter="blur(6px)"
                    color="white"
                    zIndex={10}
                    pointerEvents="none"
                  >
                    {st.label && (
                      <Text
                        fontSize="10px"
                        fontWeight={800}
                        letterSpacing="wider"
                        color={a.kind === "red" ? "red.300" : "yellow.300"}
                        mb={1}
                      >
                        {st.label}
                      </Text>
                    )}
                    <Text
                      fontSize={{ base: "sm", md: "md" }}
                      fontWeight={600}
                      lineHeight="1.4"
                      noOfLines={4}
                    >
                      {a.prompt}
                    </Text>
                  </Box>
                );
              })}

              {/* Score Bursts */}
              {scoreBursts.map((b) => (
                <Text
                  key={b.uid}
                  position="absolute"
                  left={`${b.x}%`}
                  top={`${b.y}%`}
                  fontSize="xl"
                  fontWeight={800}
                  color={
                    b.kind === "gold"
                      ? "yellow.300"
                      : b.kind === "red"
                        ? "red.300"
                        : "blue.300"
                  }
                  textShadow="0 2px 10px rgba(0,0,0,0.6)"
                  animation="floatBurst 0.85s ease-out forwards"
                  pointerEvents="none"
                  zIndex={20}
                >
                  +{b.points}
                </Text>
              ))}

              {/* Pause Overlay */}
              {phase === "playing" && isPaused && (
                <Flex
                  position="absolute"
                  inset={0}
                  bg="blackAlpha.700"
                  backdropFilter="blur(6px)"
                  align="center"
                  justify="center"
                  zIndex={30}
                >
                  <Stack spacing={4} align="center" color="white" p={6}>
                    <Heading size="lg">Game Paused</Heading>
                    <Button
                      colorScheme="blue"
                      size="lg"
                      leftIcon={<IconPlayerPlay size={18} />}
                      onClick={() => {
                        setIsPaused(false);
                        window.setTimeout(() => inputRef.current?.focus(), 40);
                      }}
                    >
                      Resume Game
                    </Button>
                  </Stack>
                </Flex>
              )}

              {/* Missed Asteroid Study Overlay (Non-blocking UI overlay, no browser alert) */}
              {phase === "missed" && missedEvent && (
                <Flex
                  position="absolute"
                  inset={0}
                  bg="blackAlpha.800"
                  backdropFilter="blur(8px)"
                  align="center"
                  justify="center"
                  p={4}
                  zIndex={40}
                >
                  <Box
                    maxW="lg"
                    w="full"
                    bg={panelBg}
                    borderWidth="2px"
                    borderColor="red.400"
                    rounded="2xl"
                    p={{ base: 5, md: 6 }}
                    boxShadow="2xl"
                  >
                    <Stack spacing={4}>
                      <HStack justify="space-between">
                        <Badge colorScheme="red" fontSize="xs" px={2.5} py={1} rounded="md">
                          ASTEROID IMPACT • -1 LIFE
                        </Badge>
                        <Text fontSize="xs" fontWeight={700} color="gray.500">
                          {lives} {lives === 1 ? "life" : "lives"} left
                        </Text>
                      </HStack>

                      <Box p={4} bg={statBoxBg} rounded="xl">
                        <Text fontSize="xs" fontWeight={700} color="gray.500" mb={1}>
                          PROMPT
                        </Text>
                        <Text fontSize="md" fontWeight={600}>
                          {missedEvent.prompt}
                        </Text>
                      </Box>

                      <Box p={4} bg={cardSelectedBg} rounded="xl" borderWidth="2px" borderColor="blue.400">
                        <Text fontSize="xs" fontWeight={700} color="blue.500" mb={1}>
                          CORRECT ANSWER
                        </Text>
                        <Text fontSize="lg" fontWeight={800}>
                          {missedEvent.answer}
                        </Text>
                      </Box>

                      <Button
                        colorScheme="blue"
                        size="md"
                        rounded="xl"
                        onClick={handleContinueFromMissed}
                      >
                        {lives <= 0 ? "View Final Score (Enter)" : "Continue (Enter)"}
                      </Button>
                    </Stack>
                  </Box>
                </Flex>
              )}
            </Box>

            {/* Bottom Typing Console */}
            <Box
              as="form"
              onSubmit={handleInputSubmit}
              bg={panelBg}
              borderWidth="2px"
              borderColor={panelBorder}
              rounded="2xl"
              p={{ base: 3, md: 4 }}
              boxShadow="sm"
            >
              <Flex gap={3} align="center" wrap={{ base: "wrap", sm: "nowrap" }}>
                <Input
                  ref={inputRef}
                  size="lg"
                  fontSize="lg"
                  fontWeight={600}
                  rounded="xl"
                  borderWidth="2px"
                  borderColor={shakeInput ? "red.400" : undefined}
                  value={typedInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Type the answer to destroy falling asteroids..."
                  isDisabled={phase !== "playing" || isPaused}
                  autoFocus
                />
                <Button
                  type="button"
                  variant="outline"
                  colorScheme="orange"
                  size="lg"
                  rounded="xl"
                  leftIcon={<IconBulb size={18} />}
                  onClick={handleHint}
                  isDisabled={
                    phase !== "playing" || isPaused || asteroids.length === 0
                  }
                  flexShrink={0}
                >
                  Hint
                </Button>
                <Button
                  type="submit"
                  colorScheme="blue"
                  size="lg"
                  rounded="xl"
                  isDisabled={phase !== "playing" || isPaused || !typedInput.trim()}
                  flexShrink={0}
                >
                  Fire
                </Button>
              </Flex>

              {hintPreview && (
                <Text fontSize="sm" color="orange.400" fontWeight={700} mt={2}>
                  Hint for lowest asteroid: {hintPreview}
                </Text>
              )}
            </Box>
          </Stack>
        )}

        {/* Game Over Modal */}
        <Modal isOpen={phase === "gameover"} onClose={() => {}} isCentered closeOnOverlayClick={false} size="lg">
          <ModalOverlay backdropFilter="blur(6px)" />
          <ModalContent rounded="2xl" p={2} borderWidth="2px" borderColor={panelBorder}>
            <ModalHeader textAlign="center" pb={1}>
              <IconTrophy
                size={52}
                color="#f59e0b"
                style={{ margin: "0 auto 8px" }}
              />
              <Heading size="md">Game Over</Heading>
              <Text fontSize="sm" color="gray.500" mt={1}>
                Great effort defending {set?.title}!
              </Text>
            </ModalHeader>

            <ModalBody py={4}>
              <Stack spacing={4}>
                <SimpleGrid columns={2} spacing={3}>
                  <Box bg={statBoxBg} p={3.5} rounded="xl">
                    <Text fontSize="xs" fontWeight={700} color="gray.500">
                      FINAL SCORE
                    </Text>
                    <Text fontSize="xl" fontWeight={800} color="blue.500">
                      {score}
                    </Text>
                  </Box>
                  <Box bg={statBoxBg} p={3.5} rounded="xl">
                    <Text fontSize="xs" fontWeight={700} color="gray.500">
                      BEST SCORE
                    </Text>
                    <Text fontSize="xl" fontWeight={800} color="orange.400">
                      {highScore}
                    </Text>
                  </Box>
                  <Box bg={statBoxBg} p={3.5} rounded="xl">
                    <Text fontSize="xs" fontWeight={700} color="gray.500">
                      LEVEL REACHED
                    </Text>
                    <Text fontSize="lg" fontWeight={700} color="purple.400">
                      Level {level}
                    </Text>
                  </Box>
                  <Box bg={statBoxBg} p={3.5} rounded="xl">
                    <Text fontSize="xs" fontWeight={700} color="gray.500">
                      ASTEROIDS DESTROYED
                    </Text>
                    <Text fontSize="lg" fontWeight={700} color="green.500">
                      {destroyedCount}
                    </Text>
                  </Box>
                </SimpleGrid>

                {missedHistory.length > 0 && (
                  <Box>
                    <Text fontSize="xs" fontWeight={700} color="gray.500" mb={2}>
                      MISSED TERMS TO REVIEW ({missedHistory.length})
                    </Text>
                    <Stack spacing={2} maxH="180px" overflowY="auto" pr={1}>
                      {missedHistory.map((item) => (
                        <Box
                          key={item.id}
                          p={3}
                          bg={missedListBg}
                          rounded="xl"
                          borderWidth="1px"
                          borderColor={panelBorder}
                        >
                          <Text fontSize="xs" color="gray.500" fontWeight={600}>
                            {item.prompt}
                          </Text>
                          <Text fontSize="sm" fontWeight={700} mt={0.5}>
                            {item.answer}
                          </Text>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </ModalBody>

            <ModalFooter pt={2}>
              <HStack w="full" spacing={3}>
                <Button as={Link} href={`/${set?.id}`} variant="ghost" flex="1">
                  Back to Set
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    clearAllTimeouts();
                    setAsteroids([]);
                    setScoreBursts([]);
                    setScore(0);
                    setLevel(1);
                    setLives(MAX_LIVES);
                    setDestroyedCount(0);
                    setStreak(0);
                    setTypedInput("");
                    setHintPreview(null);
                    setMissedEvent(null);
                    setMissedHistory([]);
                    setIsPaused(false);
                    setPhase("setup");
                  }}
                  flex="1"
                >
                  Change Mode
                </Button>
                <Button
                  colorScheme="blue"
                  flex="1"
                  leftIcon={<IconRotateClockwise size={16} />}
                  onClick={startGame}
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

export default GravityContainer;
