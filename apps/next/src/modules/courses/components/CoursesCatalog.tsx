import React from "react";

import { outfit } from "@pno/lib/chakra-theme";

import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  HStack,
  Heading,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";

import {
  IconAdjustmentsHorizontal,
  IconArrowRight,
  IconBook,
  IconBrandGit,
  IconBrandJavascript,
  IconBrandPython,
  IconChartBar,
  IconCheck,
  IconClock,
  IconDatabase,
  IconHistory,
  IconLayoutGrid,
  IconPlayerPlay,
  IconSearch,
  IconTable,
  IconX,
} from "@tabler/icons-react";

import type {
  CourseSummary,
  CourseTrack,
  CoursesManifest,
  CoursesProgressStore,
} from "../types";
import { getCourseProgress } from "../utils/storage";
import { CourseManageTab } from "./CourseManageTab";

interface CoursesCatalogProps {
  manifest: CoursesManifest;
  progress: CoursesProgressStore;
  searchQuery: string;
  builtinIds: Set<string>;
  hasDeletedBuiltins: boolean;
  syncStatus: "synced" | "saving" | "offline";
  onSearchChange: (q: string) => void;
  onOpenCourse: (courseId: string, lessonId?: string) => void;
  onCreateNew: () => void;
  onOpenSmartImport: () => void;
  onEditCourse: (courseId: string) => void;
  onExportCourse: (courseId: string) => void;
  onDeleteCourse: (courseId: string, title: string, isBuiltin: boolean) => void;
  onRestoreDefaults: () => void;
}

type PrimaryTab = "all" | "in_progress" | "completed" | "manage";
type SortMode = "recommended" | "title" | "progress" | "hours";

const TRACK_META: Record<
  CourseTrack,
  {
    color: string;
    icon: React.ElementType;
    label: string;
    bannerLight: string;
    bannerDark: string;
  }
> = {
  Python: {
    color: "yellow",
    icon: IconBrandPython,
    label: "Python",
    bannerLight: "#fef9e7",
    bannerDark: "rgba(234, 179, 8, 0.12)",
  },
  SQL: {
    color: "blue",
    icon: IconDatabase,
    label: "SQL",
    bannerLight: "#eff6ff",
    bannerDark: "rgba(59, 130, 246, 0.14)",
  },
  R: {
    color: "teal",
    icon: IconChartBar,
    label: "R",
    bannerLight: "#f0fdfa",
    bannerDark: "rgba(20, 184, 166, 0.14)",
  },
  Git: {
    color: "orange",
    icon: IconBrandGit,
    label: "Git",
    bannerLight: "#fff7ed",
    bannerDark: "rgba(249, 115, 22, 0.14)",
  },
  JavaScript: {
    color: "purple",
    icon: IconBrandJavascript,
    label: "JavaScript",
    bannerLight: "#f5f3ff",
    bannerDark: "rgba(139, 92, 246, 0.14)",
  },
  Excel: {
    color: "green",
    icon: IconTable,
    label: "Excel",
    bannerLight: "#ecfdf5",
    bannerDark: "rgba(16, 185, 129, 0.14)",
  },
};

const LEVEL_COLORS: Record<string, string> = {
  Beginner: "blue",
  Intermediate: "orange",
  Advanced: "purple",
  Specialized: "teal",
};

const TrackIllustration: React.FC<{ track: CourseTrack }> = ({ track }) => {
  switch (track) {
    case "Excel":
      return (
        <svg
          viewBox="0 0 320 120"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          <rect
            x="74"
            y="14"
            width="172"
            height="92"
            rx="10"
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth="2"
          />
          <rect x="74" y="14" width="172" height="18" rx="10" fill="#e2e8f0" />
          <circle cx="88" cy="23" r="3" fill="#94a3b8" />
          <circle cx="98" cy="23" r="3" fill="#94a3b8" />
          <circle cx="108" cy="23" r="3" fill="#94a3b8" />
          <line
            x1="88"
            y1="48"
            x2="232"
            y2="48"
            stroke="#e2e8f0"
            strokeWidth="1.5"
          />
          <line
            x1="88"
            y1="68"
            x2="232"
            y2="68"
            stroke="#e2e8f0"
            strokeWidth="1.5"
          />
          <line
            x1="88"
            y1="88"
            x2="232"
            y2="88"
            stroke="#e2e8f0"
            strokeWidth="1.5"
          />
          <line
            x1="136"
            y1="36"
            x2="136"
            y2="98"
            stroke="#e2e8f0"
            strokeWidth="1.5"
          />
          <line
            x1="184"
            y1="36"
            x2="184"
            y2="98"
            stroke="#e2e8f0"
            strokeWidth="1.5"
          />
          <rect
            x="136"
            y="48"
            width="48"
            height="20"
            fill="#bbf7d0"
            stroke="#16a34a"
            strokeWidth="2"
            rx="2"
          />
          <rect x="210" y="60" width="7" height="32" rx="2" fill="#2563eb" />
          <rect x="220" y="48" width="7" height="44" rx="2" fill="#16a34a" />
          <rect x="230" y="70" width="7" height="22" rx="2" fill="#60a5fa" />
        </svg>
      );
    case "SQL":
      return (
        <svg
          viewBox="0 0 320 120"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          <rect
            x="64"
            y="16"
            width="166"
            height="88"
            rx="12"
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth="2"
          />
          <rect x="64" y="16" width="166" height="18" rx="12" fill="#e0f2fe" />
          <circle cx="78" cy="25" r="3" fill="#60a5fa" />
          <circle cx="88" cy="25" r="3" fill="#93c5fd" />
          <rect x="80" y="44" width="74" height="8" rx="4" fill="#93c5fd" />
          <rect x="80" y="60" width="104" height="8" rx="4" fill="#cbd5e1" />
          <rect x="80" y="76" width="88" height="8" rx="4" fill="#e2e8f0" />
          <polygon
            points="236,36 266,36 254,54 254,72 248,76 248,54"
            fill="#10b981"
            opacity="0.85"
          />
          <circle
            cx="246"
            cy="88"
            r="10"
            fill="#dcfce7"
            stroke="#10b981"
            strokeWidth="2"
          />
          <path
            d="M242 88 l3 3 l5 -6"
            fill="none"
            stroke="#059669"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "Python":
      return (
        <svg
          viewBox="0 0 320 120"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          <path
            d="M62 60 H126 M158 60 H198"
            stroke="#64748b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M210 74 C210 96 146 96 146 76"
            fill="none"
            stroke="#d97706"
            strokeWidth="2.5"
            strokeDasharray="4 4"
          />
          <circle
            cx="62"
            cy="60"
            r="14"
            fill="#ffffff"
            stroke="#eab308"
            strokeWidth="3"
          />
          <circle cx="62" cy="60" r="5" fill="#eab308" />
          <rect x="116" y="40" width="44" height="40" rx="10" fill="#1d4ed8" />
          <line
            x1="126"
            y1="55"
            x2="150"
            y2="55"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="126"
            y1="65"
            x2="144"
            y2="65"
            stroke="#93c5fd"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <polygon
            points="212,38 234,60 212,82 190,60"
            fill="#ffffff"
            stroke="#f59e0b"
            strokeWidth="3"
          />
          <circle
            cx="258"
            cy="60"
            r="10"
            fill="#fef3c7"
            stroke="#f59e0b"
            strokeWidth="2.5"
          />
        </svg>
      );
    case "R":
      return (
        <svg
          viewBox="0 0 320 120"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          <rect
            x="66"
            y="16"
            width="188"
            height="88"
            rx="12"
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth="2"
          />
          <line
            x1="88"
            y1="86"
            x2="232"
            y2="86"
            stroke="#cbd5e1"
            strokeWidth="2"
          />
          <line
            x1="88"
            y1="30"
            x2="88"
            y2="86"
            stroke="#cbd5e1"
            strokeWidth="2"
          />
          <path
            d="M92 78 Q134 38 172 58 T228 34"
            fill="none"
            stroke="#0d9488"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="110" cy="62" r="4" fill="#2563eb" />
          <circle cx="144" cy="48" r="4" fill="#0d9488" />
          <circle cx="182" cy="60" r="4" fill="#2563eb" />
          <circle cx="218" cy="38" r="4" fill="#0d9488" />
        </svg>
      );
    case "Git":
      return (
        <svg
          viewBox="0 0 320 120"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          <line
            x1="70"
            y1="42"
            x2="250"
            y2="42"
            stroke="#94a3b8"
            strokeWidth="3"
          />
          <path
            d="M114 42 C132 42 136 80 156 80 H200 C218 80 222 42 238 42"
            fill="none"
            stroke="#f97316"
            strokeWidth="3"
          />
          <circle cx="88" cy="42" r="9" fill="#2563eb" />
          <circle cx="114" cy="42" r="9" fill="#2563eb" />
          <circle cx="164" cy="80" r="9" fill="#f97316" />
          <circle cx="196" cy="80" r="9" fill="#f97316" />
          <circle cx="238" cy="42" r="10" fill="#10b981" />
        </svg>
      );
    case "JavaScript":
      return (
        <svg
          viewBox="0 0 320 120"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          <rect
            x="68"
            y="18"
            width="184"
            height="84"
            rx="12"
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth="2"
          />
          <rect x="68" y="18" width="184" height="20" rx="12" fill="#ede9fe" />
          <text
            x="92"
            y="72"
            fontSize="28"
            fontWeight="800"
            fill="#7c3aed"
            fontFamily="monospace"
          >
            {"{ }"}
          </text>
          <rect x="150" y="50" width="82" height="10" rx="5" fill="#c4b5fd" />
          <rect x="150" y="68" width="60" height="10" rx="5" fill="#ddd6fe" />
        </svg>
      );
  }
};

export const CoursesCatalog: React.FC<CoursesCatalogProps> = ({
  manifest,
  progress,
  searchQuery,
  builtinIds,
  hasDeletedBuiltins,
  syncStatus,
  onSearchChange,
  onOpenCourse,
  onCreateNew,
  onOpenSmartImport,
  onEditCourse,
  onExportCourse,
  onDeleteCourse,
  onRestoreDefaults,
}) => {
  const [primaryTab, setPrimaryTab] = React.useState<PrimaryTab>("all");
  const [selectedTrack, setSelectedTrack] = React.useState<"All" | CourseTrack>(
    "All",
  );
  const [sortMode, setSortMode] = React.useState<SortMode>("recommended");

  const cardBg = useColorModeValue("white", "gray.800");
  const cardBorder = useColorModeValue("gray.200", "gray.700");
  const subText = useColorModeValue("gray.600", "gray.400");
  const isDark = useColorModeValue(false, true);

  const totalLessons = React.useMemo(
    () => manifest.courses.reduce((acc, c) => acc + c.lessonCount, 0),
    [manifest.courses],
  );

  const totalCompleted = React.useMemo(
    () =>
      manifest.courses.reduce(
        (acc, c) =>
          acc + getCourseProgress(progress, c.id).completedLessons.length,
        0,
      ),
    [manifest.courses, progress],
  );

  const inProgressCount = React.useMemo(
    () =>
      manifest.courses.filter((c) => {
        const done = getCourseProgress(progress, c.id).completedLessons.length;
        return done > 0 && done < c.lessonCount;
      }).length,
    [manifest.courses, progress],
  );

  const completedCount = React.useMemo(
    () =>
      manifest.courses.filter((c) => {
        const done = getCourseProgress(progress, c.id).completedLessons.length;
        return done > 0 && done >= c.lessonCount;
      }).length,
    [manifest.courses, progress],
  );

  const lastCourse = React.useMemo(() => {
    if (!progress.lastCourseId) return null;
    return manifest.courses.find((c) => c.id === progress.lastCourseId) ?? null;
  }, [manifest.courses, progress.lastCourseId]);

  const filteredCourses = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = manifest.courses.filter((course) => {
      const done = getCourseProgress(progress, course.id).completedLessons
        .length;
      if (
        primaryTab === "in_progress" &&
        !(done > 0 && done < course.lessonCount)
      ) {
        return false;
      }
      if (
        primaryTab === "completed" &&
        !(done > 0 && done >= course.lessonCount)
      ) {
        return false;
      }
      if (selectedTrack !== "All" && course.track !== selectedTrack) {
        return false;
      }
      if (!q) return true;
      return (
        course.title.toLowerCase().includes(q) ||
        course.track.toLowerCase().includes(q) ||
        course.level.toLowerCase().includes(q) ||
        course.description.toLowerCase().includes(q) ||
        course.chapters.some(
          (ch) =>
            ch.title.toLowerCase().includes(q) ||
            ch.lessons.some((l) => l.title.toLowerCase().includes(q)),
        )
      );
    });

    if (sortMode === "title") {
      return list.toSorted((a, b) => a.title.localeCompare(b.title));
    }
    if (sortMode === "hours") {
      return list.toSorted((a, b) => a.estimatedHours - b.estimatedHours);
    }
    if (sortMode === "progress") {
      return list.toSorted((a, b) => {
        const pa =
          getCourseProgress(progress, a.id).completedLessons.length /
          Math.max(1, a.lessonCount);
        const pb =
          getCourseProgress(progress, b.id).completedLessons.length /
          Math.max(1, b.lessonCount);
        return pb - pa;
      });
    }
    return list;
  }, [
    manifest.courses,
    primaryTab,
    selectedTrack,
    searchQuery,
    sortMode,
    progress,
  ]);

  const resumeLessonId = lastCourse
    ? getCourseProgress(progress, lastCourse.id).lastLessonId
    : undefined;

  return (
    <Container maxW="7xl" py={{ base: 4, md: 6 }} flex="1">
      <Stack spacing={6}>
        {/* TOP PRIMARY TABS (IELTS-style: All Courses | In Progress | Completed + Progress/Resume) */}
        <Flex
          justify="space-between"
          align={{ base: "stretch", sm: "center" }}
          direction={{ base: "column", sm: "row" }}
          gap={3}
        >
          <HStack spacing={2} flexWrap="wrap">
            <Button
              leftIcon={<IconLayoutGrid size={17} />}
              variant={primaryTab === "all" ? "solid" : "outline"}
              colorScheme={primaryTab === "all" ? "blue" : "gray"}
              bg={primaryTab === "all" ? undefined : cardBg}
              borderColor={primaryTab === "all" ? undefined : cardBorder}
              borderWidth="2px"
              rounded="xl"
              fontWeight={700}
              size="md"
              onClick={() => setPrimaryTab("all")}
            >
              <HStack spacing={2}>
                <Text>All Courses</Text>
                <Badge
                  colorScheme={primaryTab === "all" ? "blue" : "gray"}
                  variant={primaryTab === "all" ? "solid" : "subtle"}
                  rounded="md"
                  px={1.5}
                >
                  {manifest.courses.length}
                </Badge>
              </HStack>
            </Button>

            <Button
              leftIcon={<IconHistory size={17} />}
              variant={primaryTab === "in_progress" ? "solid" : "outline"}
              colorScheme={primaryTab === "in_progress" ? "blue" : "gray"}
              bg={primaryTab === "in_progress" ? undefined : cardBg}
              borderColor={
                primaryTab === "in_progress" ? undefined : cardBorder
              }
              borderWidth="2px"
              rounded="xl"
              fontWeight={700}
              size="md"
              onClick={() => setPrimaryTab("in_progress")}
            >
              <HStack spacing={2}>
                <Text>In Progress</Text>
                <Badge
                  colorScheme={primaryTab === "in_progress" ? "blue" : "gray"}
                  variant={primaryTab === "in_progress" ? "solid" : "subtle"}
                  rounded="md"
                  px={1.5}
                >
                  {inProgressCount}
                </Badge>
              </HStack>
            </Button>

            <Button
              leftIcon={<IconCheck size={17} />}
              variant={primaryTab === "completed" ? "solid" : "outline"}
              colorScheme={primaryTab === "completed" ? "blue" : "gray"}
              bg={primaryTab === "completed" ? undefined : cardBg}
              borderColor={primaryTab === "completed" ? undefined : cardBorder}
              borderWidth="2px"
              rounded="xl"
              fontWeight={700}
              size="md"
              onClick={() => setPrimaryTab("completed")}
            >
              <HStack spacing={2}>
                <Text>Completed</Text>
                <Badge
                  colorScheme={primaryTab === "completed" ? "blue" : "gray"}
                  variant={primaryTab === "completed" ? "solid" : "subtle"}
                  rounded="md"
                  px={1.5}
                >
                  {completedCount}
                </Badge>
              </HStack>
            </Button>

            <Button
              leftIcon={<IconAdjustmentsHorizontal size={17} />}
              variant={primaryTab === "manage" ? "solid" : "outline"}
              colorScheme={primaryTab === "manage" ? "blue" : "gray"}
              bg={primaryTab === "manage" ? undefined : cardBg}
              borderColor={primaryTab === "manage" ? undefined : cardBorder}
              borderWidth="2px"
              rounded="xl"
              fontWeight={700}
              size="md"
              onClick={() => setPrimaryTab("manage")}
            >
              Manage
            </Button>
          </HStack>

          <HStack spacing={2.5} flexWrap="wrap">
            <Badge
              colorScheme={
                syncStatus === "offline"
                  ? "orange"
                  : syncStatus === "saving"
                    ? "blue"
                    : "green"
              }
              variant="subtle"
              px={2.5}
              py={1}
              rounded="lg"
              fontSize="xs"
            >
              {syncStatus === "saving"
                ? "Saving..."
                : syncStatus === "offline"
                  ? "Local only"
                  : "Auto-saved"}
            </Badge>
            <Badge
              colorScheme="blue"
              variant="subtle"
              px={2.5}
              py={1}
              rounded="lg"
              fontSize="xs"
            >
              {totalCompleted}/{totalLessons} lessons done
            </Badge>
            {lastCourse && (
              <Button
                size="sm"
                colorScheme="blue"
                rounded="xl"
                leftIcon={<IconPlayerPlay size={15} />}
                onClick={() => onOpenCourse(lastCourse.id, resumeLessonId)}
              >
                Continue: {lastCourse.title}
              </Button>
            )}
          </HStack>
        </Flex>

        {primaryTab === "manage" ? (
          <CourseManageTab
            courses={manifest.courses}
            builtinIds={builtinIds}
            hasDeletedBuiltins={hasDeletedBuiltins}
            onCreateNew={onCreateNew}
            onOpenSmartImport={onOpenSmartImport}
            onEditCourse={onEditCourse}
            onOpenCourse={(cid) => onOpenCourse(cid)}
            onExportCourse={onExportCourse}
            onDeleteCourse={onDeleteCourse}
            onRestoreDefaults={onRestoreDefaults}
          />
        ) : (
          <>
            {/* Active Search Filter Notice (matches IELTS) */}
            {searchQuery.trim() && (
              <HStack
                justify="space-between"
                bg={cardBg}
                borderWidth="2px"
                borderColor={cardBorder}
                rounded="xl"
                px={4}
                py={2.5}
              >
                <Text fontSize="sm" fontWeight={600}>
                  Search: &ldquo;{searchQuery}&rdquo;
                </Text>
                <Button
                  size="xs"
                  variant="ghost"
                  colorScheme="blue"
                  leftIcon={<IconX size={14} />}
                  onClick={() => onSearchChange("")}
                >
                  Clear filter
                </Button>
              </HStack>
            )}

            {/* Track Pills + Search & Sort */}
            <Flex
              justify="space-between"
              align={{ base: "stretch", lg: "center" }}
              direction={{ base: "column", lg: "row" }}
              gap={3}
            >
              <HStack spacing={2} flexWrap="wrap">
                <Button
                  size="sm"
                  rounded="xl"
                  borderWidth="2px"
                  borderColor={selectedTrack === "All" ? undefined : cardBorder}
                  bg={selectedTrack === "All" ? undefined : cardBg}
                  variant={selectedTrack === "All" ? "solid" : "outline"}
                  colorScheme={selectedTrack === "All" ? "blue" : "gray"}
                  fontWeight={700}
                  onClick={() => setSelectedTrack("All")}
                >
                  All ({manifest.courses.length})
                </Button>
                {manifest.tracks.map((track) => {
                  const meta = TRACK_META[track];
                  const count = manifest.courses.filter(
                    (c) => c.track === track,
                  ).length;
                  const active = selectedTrack === track;
                  return (
                    <Button
                      key={track}
                      size="sm"
                      rounded="xl"
                      borderWidth="2px"
                      borderColor={active ? undefined : cardBorder}
                      bg={active ? undefined : cardBg}
                      variant={active ? "solid" : "outline"}
                      colorScheme={active ? "blue" : "gray"}
                      fontWeight={700}
                      leftIcon={<Icon as={meta.icon} boxSize={4} />}
                      onClick={() => setSelectedTrack(track)}
                    >
                      {meta.label} ({count})
                    </Button>
                  );
                })}
              </HStack>

              <HStack spacing={2.5} flexWrap={{ base: "wrap", sm: "nowrap" }}>
                <Select
                  size="sm"
                  w={{ base: "full", sm: "195px" }}
                  rounded="xl"
                  bg={cardBg}
                  borderWidth="2px"
                  borderColor={cardBorder}
                  fontWeight={600}
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  aria-label="Sort courses"
                >
                  <option value="recommended">Sort: Track &amp; Level</option>
                  <option value="title">Sort: Title (A–Z)</option>
                  <option value="progress">Sort: Most Progress</option>
                  <option value="hours">Sort: Shortest First</option>
                </Select>

                <InputGroup size="sm" w={{ base: "full", sm: "230px" }}>
                  <InputLeftElement pointerEvents="none" color="gray.400">
                    <IconSearch size={15} />
                  </InputLeftElement>
                  <Input
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search courses or lessons..."
                    rounded="xl"
                    bg={cardBg}
                    borderWidth="2px"
                    borderColor={cardBorder}
                  />
                </InputGroup>
              </HStack>
            </Flex>

            {/* Courses Grid */}
            {filteredCourses.length === 0 ? (
              <Box
                bg={cardBg}
                borderWidth="2px"
                borderColor={cardBorder}
                rounded="2xl"
                p={10}
                textAlign="center"
              >
                <Text fontWeight={700} fontSize="lg" mb={1}>
                  No matching courses found
                </Text>
                <Text fontSize="sm" color={subText}>
                  Try changing the tab, track filter, or search keyword.
                </Text>
              </Box>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={5}>
                {filteredCourses.map((course: CourseSummary) => {
                  const meta = TRACK_META[course.track];
                  const cp = getCourseProgress(progress, course.id);
                  const doneCount = cp.completedLessons.length;
                  const pct =
                    course.lessonCount > 0
                      ? Math.round((doneCount / course.lessonCount) * 100)
                      : 0;
                  const isFinished =
                    doneCount > 0 && doneCount >= course.lessonCount;

                  const allLessons = course.chapters.flatMap(
                    (ch) => ch.lessons,
                  );
                  const lastLesson = cp.lastLessonId
                    ? allLessons.find((l) => l.id === cp.lastLessonId)
                    : undefined;
                  const firstUnfinished = allLessons.find(
                    (l) => !cp.completedLessons.includes(l.id),
                  );
                  const nextLesson =
                    lastLesson ?? firstUnfinished ?? allLessons[0];
                  const nextLessonNum = nextLesson?.globalIndex ?? 1;

                  return (
                    <Box
                      key={course.id}
                      as="article"
                      bg={cardBg}
                      borderWidth="1.5px"
                      borderColor={isFinished ? "green.400" : cardBorder}
                      rounded="2xl"
                      p={4}
                      shadow="sm"
                      transition="all 0.15s ease"
                      _hover={{
                        borderColor: "blue.400",
                        transform: "translateY(-3px)",
                        shadow: "lg",
                      }}
                      display="flex"
                      flexDirection="column"
                      justifyContent="space-between"
                      gap={4}
                    >
                      <Stack spacing={3.5}>
                        {/* Illustration Banner */}
                        <Box
                          h="126px"
                          w="full"
                          rounded="xl"
                          bg={isDark ? meta.bannerDark : meta.bannerLight}
                          overflow="hidden"
                          p={2}
                          borderWidth="1px"
                          borderColor={cardBorder}
                        >
                          <TrackIllustration track={course.track} />
                        </Box>

                        {/* Level & Track Badges */}
                        <Flex justify="space-between" align="center" gap={2}>
                          <Badge
                            colorScheme={LEVEL_COLORS[course.level] ?? "blue"}
                            variant="subtle"
                            rounded="md"
                            px={2}
                            py={0.5}
                            fontSize="xs"
                            fontWeight={700}
                            textTransform="none"
                          >
                            <HStack spacing={1}>
                              <Icon as={IconChartBar} boxSize={3.5} />
                              <span>{course.level}</span>
                            </HStack>
                          </Badge>

                          <HStack spacing={1.5}>
                            <Badge
                              colorScheme={meta.color}
                              variant="outline"
                              rounded="md"
                              px={2}
                              py={0.5}
                              fontSize="xs"
                              textTransform="none"
                            >
                              {meta.label}
                            </Badge>
                            {isFinished && (
                              <Badge
                                colorScheme="green"
                                rounded="md"
                                px={2}
                                py={0.5}
                              >
                                <HStack spacing={1}>
                                  <Icon as={IconCheck} boxSize={3} />
                                  <span>Done</span>
                                </HStack>
                              </Badge>
                            )}
                          </HStack>
                        </Flex>

                        {/* Title & Description */}
                        <Stack spacing={1}>
                          <Heading
                            as="h2"
                            fontFamily={outfit.style.fontFamily}
                            fontSize="lg"
                            fontWeight={800}
                            noOfLines={1}
                          >
                            {course.title}
                          </Heading>
                          <Text
                            fontSize="sm"
                            color={subText}
                            noOfLines={2}
                            lineHeight="1.5"
                            minH="42px"
                          >
                            {course.description}
                          </Text>
                        </Stack>

                        {/* Lessons & Estimated Hours */}
                        <HStack
                          spacing={4}
                          fontSize="xs"
                          color={subText}
                          fontWeight={600}
                        >
                          <HStack spacing={1.5}>
                            <Icon as={IconBook} boxSize={3.5} />
                            <span>
                              {doneCount}/{course.lessonCount} lessons
                            </span>
                          </HStack>
                          <HStack spacing={1.5}>
                            <Icon as={IconClock} boxSize={3.5} />
                            <span>{course.estimatedHours} hours</span>
                          </HStack>
                        </HStack>

                        {/* Progress Row */}
                        <Box>
                          <Flex
                            justify="space-between"
                            fontSize="xs"
                            color={subText}
                            mb={1.5}
                          >
                            <span>Progress</span>
                            <Text
                              fontWeight={700}
                              color={isFinished ? "green.500" : "blue.500"}
                            >
                              {pct}%
                            </Text>
                          </Flex>
                          <Progress
                            value={pct}
                            size="xs"
                            rounded="full"
                            colorScheme={isFinished ? "green" : "blue"}
                          />
                        </Box>
                      </Stack>

                      {/* Footer CTA */}
                      <Flex
                        pt={2}
                        borderTopWidth="1px"
                        borderColor={cardBorder}
                        justify="space-between"
                        align="center"
                        gap={2}
                      >
                        <Text fontSize="xs" color={subText} noOfLines={1}>
                          {course.chapterCount} chapters
                          {course.stats.practice > 0
                            ? ` · ${course.stats.practice} labs`
                            : ` · ${course.stats.quizQuestions} quizzes`}
                        </Text>

                        <Button
                          size="sm"
                          colorScheme="blue"
                          rounded="xl"
                          px={4}
                          rightIcon={<IconArrowRight size={15} />}
                          onClick={() =>
                            onOpenCourse(course.id, nextLesson?.id)
                          }
                        >
                          {doneCount > 0
                            ? `Continue lesson ${nextLessonNum}`
                            : "Start lesson 1"}
                        </Button>
                      </Flex>
                    </Box>
                  );
                })}
              </SimpleGrid>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
};
