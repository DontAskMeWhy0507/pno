import dynamic from "next/dynamic";
import React, { useState, useEffect, type FC } from "react";
import { outfit } from "@quenti/lib/chakra-theme";
import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Grid,
  GridItem,
  HStack,
  Heading,
  Icon,
  IconButton,
  Input,
  Menu,
  MenuButton,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  VStack,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import {
  IconArrowLeft,
  IconArrowRight,
  IconBook,
  IconClock,
  IconDotsVertical,
  IconEdit,
  IconFolder,
  IconFolderPlus,
  IconHeadphones,
  IconMicrophone,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconRotateClockwise,
  IconSchool,
  IconSparkles,
  IconTrash,
  IconX,
} from "@tabler/icons-react";

import { menuEventChannel } from "../../../../events/menu";
import { MenuOption } from "../../../../components/menu-option";
import type { Exam } from "../../types/exam";
import type { WritingExam } from "../../types/writing";
import type { SpeakingExam } from "../../types/speaking";
import {
  getAllWritingExams,
  saveWritingExam,
  deleteWritingExam,
} from "../../data/writingExams";
import {
  getAllSpeakingExams,
  saveSpeakingExam,
  deleteSpeakingExam,
} from "../../data/speakingExams";
import {
  deleteExam,
  getAllCollections,
  getExamCollection,
  getExamPartCount,
  getExamQuestionCount,
  createCollection,
  deleteCollection,
  isListeningExam,
} from "../../utils/storage";
import type { CloudAttemptRow, CloudIeltsSkill } from "../../utils/cloudSync";
import {
  getSavedExamSummary,
  clearExamProgress,
} from "../../utils/examProgress";
import {
  getSavedWritingSummary,
  clearWritingProgress,
  loadSpeakingProgress,
  clearSpeakingProgress,
} from "../../utils/writingProgress";
import { type InProgressItem } from "./InProgressBanner";

const WritingEditorModal = dynamic(
  () =>
    import("../admin/WritingEditorModal").then((mod) => mod.WritingEditorModal),
  { ssr: false },
);
const SpeakingEditorModal = dynamic(
  () =>
    import("../admin/SpeakingEditorModal").then(
      (mod) => mod.SpeakingEditorModal,
    ),
  { ssr: false },
);

interface HomePageProps {
  exams: Exam[];
  recentAttempts?: CloudAttemptRow[];
  syncStatus?: "synced" | "saving" | "offline";
  onSelectExam: (exam: Exam) => void;
  onOpenEditor: (exam?: Exam | null) => void;
  onOpenTestManager: () => void;
  onOpenSmartImport: (
    collection?: string,
    skill?: "reading" | "listening" | "writing" | "speaking",
  ) => void;
  onRefreshExams: () => void;
  onStartWritingExam: (exam: WritingExam) => void;
  onStartSpeakingExam: (exam: SpeakingExam) => void;
  onDeleteAttempt?: (id: string) => void;
  onCloudSaveExam?: (
    skill: CloudIeltsSkill,
    examId: string,
    title: string,
    collection: string,
    data: Record<string, unknown>,
  ) => void;
  onCloudDeleteExam?: (skill: CloudIeltsSkill, examId: string) => void;
  onCloudCreateCollection?: (col: { name: string; description?: string }) => void;
  onCloudDeleteCollection?: (
    name: string,
    examsToTombstone: Array<{ examId: string; skill: CloudIeltsSkill }>,
  ) => void;
  onCloudClearProgress?: (skill: CloudIeltsSkill, examId: string) => void;
}

interface UnifiedIeltsCardProps {
  title: string;
  collectionName: string;
  metaText: string;
  subText?: string;
  skillColor: string;
  skillBadgeLabel: string;
  skillIcon: React.ElementType;
  inProgressLabel?: string;
  isCustom?: boolean;
  onStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDiscardProgress?: () => void;
}

/**
 * UnifiedIeltsCard — Uses the exact same visual language as Quiz's GenericCard / StudySetCard:
 * - 2px border, rounded="xl", p="5", shadow="lg", Outfit heading size="md"
 * - Hover lift translateY(-2px) + bottom border highlight (blue.300)
 * - Click anywhere on card to start/resume immediately
 * - 3-dots menu (⋮) in bottom-right corner for Edit / Discard Progress / Delete
 */
const UnifiedIeltsCard: FC<UnifiedIeltsCardProps> = ({
  title,
  collectionName,
  metaText,
  subText,
  skillColor,
  skillBadgeLabel,
  skillIcon,
  inProgressLabel,
  isCustom,
  onStart,
  onEdit,
  onDelete,
  onDiscardProgress,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const cardBg = useColorModeValue("white", "gray.800");
  const cardBorder = useColorModeValue("gray.200", "gray.700");
  const activeBorder = useColorModeValue("green.400", "green.500");
  const secondaryColor = useColorModeValue("gray.600", "gray.400");

  return (
    <Box
      as="article"
      role="group"
      h="full"
      minH="164px"
      rounded="xl"
      p="5"
      bg={cardBg}
      borderColor={inProgressLabel ? activeBorder : cardBorder}
      borderWidth="2px"
      shadow="lg"
      cursor="pointer"
      transition="all ease-in-out 150ms"
      zIndex={menuOpen ? 30 : 25}
      position="relative"
      onClick={onStart}
      _hover={{
        transform: "translateY(-2px)",
        borderBottomColor: inProgressLabel ? "green.400" : "blue.300",
      }}
    >
      <Flex justifyContent="space-between" flexDir="column" h="full" gap={4}>
        <Stack spacing={2}>
          <HStack justify="space-between" align="start" spacing={2}>
            <Heading
              size="md"
              fontFamily={outfit.style.fontFamily}
              lineHeight="1.35"
              noOfLines={2}
            >
              {title}
            </Heading>
            {inProgressLabel ? (
              <Badge
                colorScheme="green"
                fontSize="xs"
                px={2}
                py={0.5}
                rounded="md"
                flexShrink={0}
              >
                {inProgressLabel}
              </Badge>
            ) : isCustom ? (
              <Badge
                colorScheme="blue"
                fontSize="xs"
                px={2}
                py={0.5}
                rounded="md"
                flexShrink={0}
              >
                Custom
              </Badge>
            ) : null}
          </HStack>

          <HStack spacing="2" color={secondaryColor} flexWrap="wrap">
            <Icon as={skillIcon} boxSize={4} color={skillColor} />
            <Text fontSize="sm" fontWeight={500}>
              {metaText}
            </Text>
          </HStack>

          {subText && (
            <Text fontSize="xs" color={secondaryColor} noOfLines={2}>
              {subText}
            </Text>
          )}
        </Stack>

        <Flex justifyContent="space-between" alignItems="center">
          <HStack spacing={2}>
            <Badge
              colorScheme="purple"
              variant="subtle"
              fontSize="xs"
              px={2}
              py={0.5}
              rounded="md"
            >
              {collectionName}
            </Badge>
            <Badge
              colorScheme="gray"
              variant="subtle"
              fontSize="xs"
              px={2}
              py={0.5}
              rounded="md"
            >
              {skillBadgeLabel}
            </Badge>
          </HStack>

          <HStack
            spacing={1}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Menu
              placement="bottom-end"
              isOpen={menuOpen}
              onOpen={() => setMenuOpen(true)}
              onClose={() => setMenuOpen(false)}
            >
              <MenuButton
                as={IconButton}
                size="xs"
                variant="ghost"
                rounded="full"
                aria-label="Test options"
                icon={<IconDotsVertical size={16} />}
              />
              <MenuList
                overflow="hidden"
                minW="auto"
                w="48"
                zIndex={40}
              >
                <MenuOption
                  icon={<IconPlayerPlay size={16} />}
                  label={inProgressLabel ? "Resume Test" : "Start Test"}
                  fontSize="sm"
                  py="6px"
                  onClick={onStart}
                />
                <MenuOption
                  icon={<IconEdit size={16} />}
                  label="Edit Test"
                  fontSize="sm"
                  py="6px"
                  onClick={onEdit}
                />
                {onDiscardProgress && (
                  <MenuOption
                    icon={<IconRotateClockwise size={16} />}
                    label="Restart from Scratch"
                    fontSize="sm"
                    py="6px"
                    onClick={onDiscardProgress}
                  />
                )}
                <MenuOption
                  icon={<IconTrash size={16} />}
                  label="Delete Test"
                  fontSize="sm"
                  py="6px"
                  onClick={onDelete}
                />
              </MenuList>
            </Menu>
          </HStack>
        </Flex>
      </Flex>
    </Box>
  );
};

export const HomePage: FC<HomePageProps> = ({
  exams,
  recentAttempts = [],
  syncStatus = "synced",
  onSelectExam,
  onOpenEditor,
  onOpenTestManager,
  onOpenSmartImport,
  onRefreshExams,
  onStartWritingExam,
  onStartSpeakingExam,
  onDeleteAttempt,
  onCloudSaveExam,
  onCloudDeleteExam,
  onCloudCreateCollection,
  onCloudDeleteCollection,
  onCloudClearProgress,
}) => {
  const [activeTab, setActiveTab] = useState<
    "reading" | "listening" | "writing" | "speaking"
  >("reading");
  const [viewMode, setViewMode] = useState<"all_tests" | "by_collection">(
    "all_tests",
  );
  const [selectedCollectionName, setSelectedCollectionName] = useState<
    string | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDesc, setNewCollectionDesc] = useState("");
  const [progressVersion, setProgressVersion] = useState(0);

  const collections = getAllCollections();
  const [writingExams, setWritingExams] = useState<WritingExam[]>(() =>
    getAllWritingExams(),
  );
  const [speakingExams, setSpeakingExams] = useState<SpeakingExam[]>(() =>
    getAllSpeakingExams(),
  );

  const [isWritingEditorOpen, setIsWritingEditorOpen] = useState(false);
  const [editingWritingExam, setEditingWritingExam] =
    useState<WritingExam | null>(null);
  const [isSpeakingEditorOpen, setIsSpeakingEditorOpen] = useState(false);
  const [editingSpeakingExam, setEditingSpeakingExam] =
    useState<SpeakingExam | null>(null);

  const toast = useToast();
  const cardBg = useColorModeValue("white", "gray.800");
  const cardBorder = useColorModeValue("gray.200", "gray.700");
  const secondaryColor = useColorModeValue("gray.600", "gray.400");
  const pillBg = useColorModeValue("gray.100", "gray.750");

  useEffect(() => {
    setWritingExams(getAllWritingExams());
    setSpeakingExams(getAllSpeakingExams());
  }, [exams]);

  // Listen to unified PNO Navbar events
  useEffect(() => {
    const handleAddTest = () => onOpenSmartImport(undefined, activeTab);
    const handleTestBank = () => onOpenTestManager();
    const handleNewCol = () => setShowNewCollectionModal(true);
    const handleSearch = (q: string) => setSearchQuery(q);

    menuEventChannel.on("openIeltsAddTest", handleAddTest);
    menuEventChannel.on("openIeltsTestBank", handleTestBank);
    menuEventChannel.on("openIeltsNewCollection", handleNewCol);
    menuEventChannel.on("ieltsSearchChange", handleSearch);

    return () => {
      menuEventChannel.off("openIeltsAddTest", handleAddTest);
      menuEventChannel.off("openIeltsTestBank", handleTestBank);
      menuEventChannel.off("openIeltsNewCollection", handleNewCol);
      menuEventChannel.off("ieltsSearchChange", handleSearch);
    };
  }, [activeTab, onOpenSmartImport, onOpenTestManager]);

  const refreshWriting = () => setWritingExams(getAllWritingExams());
  const refreshSpeaking = () => setSpeakingExams(getAllSpeakingExams());

  const handleSaveWriting = (examToSave: WritingExam) => {
    saveWritingExam(examToSave);
    onCloudSaveExam?.(
      "Writing",
      examToSave.id,
      examToSave.title,
      examToSave.collection || "My Tests",
      examToSave as unknown as Record<string, unknown>,
    );
    setIsWritingEditorOpen(false);
    setEditingWritingExam(null);
    refreshWriting();
    toast({
      title: "Writing test saved",
      status: "success",
      duration: 2200,
      isClosable: true,
      position: "bottom-right",
    });
  };

  const handleSaveSpeaking = (examToSave: SpeakingExam) => {
    saveSpeakingExam(examToSave);
    onCloudSaveExam?.(
      "Speaking",
      examToSave.id,
      examToSave.title,
      examToSave.collection || "My Tests",
      examToSave as unknown as Record<string, unknown>,
    );
    setIsSpeakingEditorOpen(false);
    setEditingSpeakingExam(null);
    refreshSpeaking();
    toast({
      title: "Speaking test saved",
      status: "success",
      duration: 2200,
      isClosable: true,
      position: "bottom-right",
    });
  };

  const handleDeleteExam = (exam: Exam) => {
    deleteExam(exam.id);
    onCloudDeleteExam?.(
      isListeningExam(exam) ? "Listening" : "Reading",
      exam.id,
    );
    onRefreshExams();
    toast({
      title: "Test deleted",
      description: `Removed "${exam.title}" from your Test Bank.`,
      status: "info",
      duration: 2500,
      isClosable: true,
      position: "bottom-right",
    });
  };

  const handleDeleteWritingExam = (id: string, title: string) => {
    deleteWritingExam(id);
    onCloudDeleteExam?.("Writing", id);
    refreshWriting();
    toast({
      title: "Writing test deleted",
      description: `Removed "${title}".`,
      status: "info",
      duration: 2500,
      isClosable: true,
      position: "bottom-right",
    });
  };

  const handleDeleteSpeakingExam = (id: string, title: string) => {
    deleteSpeakingExam(id);
    onCloudDeleteExam?.("Speaking", id);
    refreshSpeaking();
    toast({
      title: "Speaking test deleted",
      description: `Removed "${title}".`,
      status: "info",
      duration: 2500,
      isClosable: true,
      position: "bottom-right",
    });
  };

  const handleDiscardExam = (exam: Exam) => {
    clearExamProgress(exam.id);
    onCloudClearProgress?.(
      isListeningExam(exam) ? "Listening" : "Reading",
      exam.id,
    );
    setProgressVersion((v) => v + 1);
    toast({
      title: "Progress reset",
      description: `"${exam.title}" is ready to start from scratch.`,
      status: "info",
      duration: 2200,
      isClosable: true,
      position: "bottom-right",
    });
  };

  const handleDiscardWriting = (examId: string, title: string) => {
    clearWritingProgress(examId);
    onCloudClearProgress?.("Writing", examId);
    setProgressVersion((v) => v + 1);
    toast({
      title: "Draft discarded",
      description: `"${title}" is ready to start from scratch.`,
      status: "info",
      duration: 2200,
      isClosable: true,
      position: "bottom-right",
    });
  };

  const handleDiscardSpeaking = (examId: string, title: string) => {
    clearSpeakingProgress(examId);
    onCloudClearProgress?.("Speaking", examId);
    setProgressVersion((v) => v + 1);
    toast({
      title: "Session reset",
      description: `"${title}" is ready to start from scratch.`,
      status: "info",
      duration: 2200,
      isClosable: true,
      position: "bottom-right",
    });
  };

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    const created = createCollection(
      newCollectionName.trim(),
      newCollectionDesc.trim(),
    );
    onCloudCreateCollection?.(created);
    setNewCollectionName("");
    setNewCollectionDesc("");
    setShowNewCollectionModal(false);
    onRefreshExams();
    toast({
      title: "Collection created",
      status: "success",
      duration: 2200,
      isClosable: true,
      position: "bottom-right",
    });
  };

  const handleDeleteCollection = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    const examsToTombstone = exams
      .filter((ex) => getExamCollection(ex).toLowerCase() === name.trim().toLowerCase())
      .map((ex) => ({
        examId: ex.id,
        skill: (isListeningExam(ex) ? "Listening" : "Reading") as CloudIeltsSkill,
      }));
    deleteCollection(name);
    onCloudDeleteCollection?.(name, examsToTombstone);
    if (selectedCollectionName === name) setSelectedCollectionName(null);
    onRefreshExams();
    toast({
      title: "Collection deleted",
      description: `Removed collection "${name}".`,
      status: "info",
      duration: 2200,
      isClosable: true,
      position: "bottom-right",
    });
  };

  // Separate Reading and Listening exams
  const readingExams = exams.filter((e) => !isListeningExam(e));
  const listeningExams = exams.filter((e) => isListeningExam(e));

  const qLower = searchQuery.trim().toLowerCase();
  const filteredReading = qLower
    ? readingExams.filter(
        (e) =>
          e.title.toLowerCase().includes(qLower) ||
          getExamCollection(e).toLowerCase().includes(qLower),
      )
    : readingExams;

  const filteredListening = qLower
    ? listeningExams.filter(
        (e) =>
          e.title.toLowerCase().includes(qLower) ||
          getExamCollection(e).toLowerCase().includes(qLower),
      )
    : listeningExams;

  const filteredWriting = qLower
    ? writingExams.filter(
        (w) =>
          w.title.toLowerCase().includes(qLower) ||
          (w.collection || "").toLowerCase().includes(qLower),
      )
    : writingExams;

  const filteredSpeaking = qLower
    ? speakingExams.filter(
        (s) =>
          s.title.toLowerCase().includes(qLower) ||
          (s.collection || "").toLowerCase().includes(qLower),
      )
    : speakingExams;

  // Build in-progress tests list across Reading, Listening, Writing, and Speaking
  const inProgressItems: InProgressItem[] = [];
  void progressVersion;

  for (const exam of exams) {
    const summary = getSavedExamSummary(exam.id);
    if (summary) {
      const totalQ = getExamQuestionCount(exam);
      inProgressItems.push({
        id: exam.id,
        title: exam.title,
        skill: isListeningExam(exam) ? "listening" : "reading",
        collection: getExamCollection(exam),
        answeredCount: summary.answeredCount,
        totalQuestions: totalQ,
        timeRemaining: summary.timeRemaining,
        lastSavedAt: summary.lastSavedAt || 0,
        activePartNumber: summary.activePartNumber,
        currentQuestionNumber: summary.currentQuestionNumber,
        rawExam: exam,
      });
    }
  }

  for (const w of writingExams) {
    const summary = getSavedWritingSummary(w.id);
    if (summary) {
      inProgressItems.push({
        id: w.id,
        title: w.title,
        skill: "writing",
        collection: w.collection,
        answeredCount: 0,
        totalQuestions: 0,
        timeRemaining: summary.timeRemaining,
        lastSavedAt: summary.lastSavedAt || 0,
        task1Words: summary.task1Words,
        task2Words: summary.task2Words,
        rawWritingExam: w,
      });
    }
  }

  for (const s of speakingExams) {
    const summary = loadSpeakingProgress(s.id);
    if (summary) {
      inProgressItems.push({
        id: s.id,
        title: s.title,
        skill: "speaking",
        collection: s.collection,
        answeredCount: 0,
        totalQuestions: 0,
        timeRemaining: 0,
        lastSavedAt: summary.lastSavedAt || 0,
        speakingPart: summary.activePart,
        rawSpeakingExam: s,
      });
    }
  }

  inProgressItems.sort((a, b) => b.lastSavedAt - a.lastSavedAt);

  const readingInProgressCount = inProgressItems.filter(
    (i) => i.skill === "reading",
  ).length;
  const listeningInProgressCount = inProgressItems.filter(
    (i) => i.skill === "listening",
  ).length;
  const writingInProgressCount = inProgressItems.filter(
    (i) => i.skill === "writing",
  ).length;
  const speakingInProgressCount = inProgressItems.filter(
    (i) => i.skill === "speaking",
  ).length;

  const renderExamCardItem = (test: Exam) => {
    const totalQ = getExamQuestionCount(test);
    const totalParts = getExamPartCount(test);
    const colName = getExamCollection(test);
    const savedProgress = getSavedExamSummary(test.id);
    const isListen = isListeningExam(test);
    const mins = savedProgress
      ? `${Math.ceil(savedProgress.timeRemaining / 60)} mins left`
      : `${test.durationMinutes || (isListen ? 30 : 60)} mins`;

    return (
      <GridItem key={`${test.id}-${progressVersion}`}>
        <UnifiedIeltsCard
          title={test.title}
          collectionName={colName}
          metaText={`${mins} • ${totalParts} ${
            isListen ? "Sections" : "Parts"
          } • ${totalQ} Questions`}
          skillColor={isListen ? "purple.400" : "blue.400"}
          skillBadgeLabel={isListen ? "Listening" : "Reading"}
          skillIcon={isListen ? IconHeadphones : IconBook}
          inProgressLabel={
            savedProgress
              ? `In Progress (${savedProgress.answeredCount}/${totalQ}) • Resume`
              : undefined
          }
          isCustom={test.isBuiltin === false || colName === "My Tests"}
          onStart={() => onSelectExam(test)}
          onEdit={() => onOpenEditor(test)}
          onDelete={() => handleDeleteExam(test)}
          onDiscardProgress={
            savedProgress ? () => handleDiscardExam(test) : undefined
          }
        />
      </GridItem>
    );
  };

  return (
    <Container maxW="7xl" py={{ base: 4, md: 6 }} flex="1">
      <Stack spacing={10}>
        {/* 1. In-Progress Tests Section (Same style as Anki Decks section in Quiz) */}
        {inProgressItems.length > 0 && (
          <Stack spacing={4}>
            <HStack justify="space-between" align="center" flexWrap="wrap">
              <HStack spacing={2.5}>
                <Icon as={IconClock} boxSize={6} color="green.400" />
                <Heading size="lg" fontFamily={outfit.style.fontFamily}>
                  In Progress ({inProgressItems.length})
                </Heading>
                <Badge
                  colorScheme="green"
                  fontSize="sm"
                  px={2}
                  py={0.5}
                  rounded="md"
                >
                  {syncStatus === "saving" ? "Syncing..." : "Cloud Synced"}
                </Badge>
              </HStack>
              <Text fontSize="sm" color={secondaryColor}>
                Click any test card to resume right where you left off
              </Text>
            </HStack>

            <Grid
              templateColumns="repeat(auto-fill, minmax(min(100%, 280px), 1fr))"
              gap={4}
            >
              {inProgressItems.map((item) => {
                if (item.skill === "writing" && item.rawWritingExam) {
                  return (
                    <GridItem key={`inprog-${item.id}`}>
                      <UnifiedIeltsCard
                        title={item.title}
                        collectionName={item.collection || "IELTS Writing"}
                        metaText={`${Math.ceil(
                          item.timeRemaining / 60,
                        )} mins left • Task 1 (${item.task1Words || 0} words) • Task 2 (${
                          item.task2Words || 0
                        } words)`}
                        skillColor="orange.400"
                        skillBadgeLabel="Writing"
                        skillIcon={IconPencil}
                        inProgressLabel="In Progress • Resume"
                        onStart={() =>
                          onStartWritingExam(item.rawWritingExam!)
                        }
                        onEdit={() => {
                          setEditingWritingExam(item.rawWritingExam!);
                          setIsWritingEditorOpen(true);
                        }}
                        onDelete={() =>
                          handleDeleteWritingExam(item.id, item.title)
                        }
                        onDiscardProgress={() =>
                          handleDiscardWriting(item.id, item.title)
                        }
                      />
                    </GridItem>
                  );
                }
                if (item.skill === "speaking" && item.rawSpeakingExam) {
                  return (
                    <GridItem key={`inprog-${item.id}`}>
                      <UnifiedIeltsCard
                        title={item.title}
                        collectionName={item.collection || "IELTS Speaking"}
                        metaText={`Part ${item.speakingPart || 1} in progress • Part 1, 2 & 3`}
                        skillColor="pink.400"
                        skillBadgeLabel="Speaking"
                        skillIcon={IconMicrophone}
                        inProgressLabel="In Progress • Resume"
                        onStart={() =>
                          onStartSpeakingExam(item.rawSpeakingExam!)
                        }
                        onEdit={() => {
                          setEditingSpeakingExam(item.rawSpeakingExam!);
                          setIsSpeakingEditorOpen(true);
                        }}
                        onDelete={() =>
                          handleDeleteSpeakingExam(item.id, item.title)
                        }
                        onDiscardProgress={() =>
                          handleDiscardSpeaking(item.id, item.title)
                        }
                      />
                    </GridItem>
                  );
                }
                if (item.rawExam) {
                  return renderExamCardItem(item.rawExam);
                }
                return null;
              })}
            </Grid>
          </Stack>
        )}

        {/* Recent Band Score & Attempt History (Cloud Synced) */}
        {recentAttempts.length > 0 && (
          <Stack spacing={4}>
            <HStack justify="space-between" align="center" flexWrap="wrap">
              <HStack spacing={2.5}>
                <Icon as={IconSparkles} boxSize={6} color="blue.400" />
                <Heading size="lg" fontFamily={outfit.style.fontFamily}>
                  Recent Band History ({recentAttempts.length})
                </Heading>
                <Badge
                  colorScheme="blue"
                  fontSize="sm"
                  px={2}
                  py={0.5}
                  rounded="md"
                >
                  Cloud History
                </Badge>
              </HStack>
              <Text fontSize="sm" color={secondaryColor}>
                Saved automatically across devices
              </Text>
            </HStack>

            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
              {recentAttempts.slice(0, 6).map((attempt) => {
                const skillColor =
                  attempt.skill === "Listening"
                    ? "purple"
                    : attempt.skill === "Writing"
                      ? "orange"
                      : attempt.skill === "Speaking"
                        ? "pink"
                        : "blue";
                const minsSpent = Math.max(
                  1,
                  Math.round(attempt.timeSpentSeconds / 60),
                );
                const dateLabel = new Date(attempt.completedAt).toLocaleDateString(
                  undefined,
                  { month: "short", day: "numeric" },
                );

                return (
                  <Box
                    key={attempt.id}
                    bg={cardBg}
                    borderWidth="2px"
                    borderColor={cardBorder}
                    rounded="xl"
                    p={4}
                    shadow="sm"
                  >
                    <Flex justify="space-between" align="start" gap={3}>
                      <Stack spacing={1.5} minW={0} flex={1}>
                        <HStack spacing={2}>
                          <Badge colorScheme={skillColor} rounded="md" fontSize="xs">
                            {attempt.skill}
                          </Badge>
                          <Text fontSize="xs" color={secondaryColor}>
                            {dateLabel} • {minsSpent}m
                          </Text>
                        </HStack>
                        <Text fontWeight={700} fontSize="sm" noOfLines={1}>
                          {attempt.examTitle}
                        </Text>
                        <Text fontSize="xs" color={secondaryColor}>
                          {attempt.totalQuestions > 0
                            ? `${attempt.totalCorrect}/${attempt.totalQuestions} correct`
                            : "Completed submission"}
                        </Text>
                      </Stack>
                      <VStack spacing={1} align="end" flexShrink={0}>
                        {attempt.bandScore !== null &&
                          attempt.bandScore !== undefined && (
                            <Badge
                              colorScheme="green"
                              fontSize="sm"
                              px={2.5}
                              py={1}
                              rounded="lg"
                              fontWeight={800}
                            >
                              Band {attempt.bandScore.toFixed(1)}
                            </Badge>
                          )}
                        {onDeleteAttempt && (
                          <IconButton
                            aria-label="Delete attempt"
                            icon={<IconTrash size={14} />}
                            size="xs"
                            variant="ghost"
                            colorScheme="gray"
                            onClick={() => onDeleteAttempt(attempt.id)}
                          />
                        )}
                      </VStack>
                    </Flex>
                  </Box>
                );
              })}
            </SimpleGrid>
          </Stack>
        )}

        {/* 2. Skill Switcher & Quick Controls Row (Unified Chakra UI) */}
        <Flex
          justify="space-between"
          align={{ base: "stretch", md: "center" }}
          direction={{ base: "column", md: "row" }}
          gap={4}
        >
          {/* 4 IELTS Skill Tabs */}
          <HStack
            spacing={2}
            overflowX="auto"
            pb={{ base: 1, md: 0 }}
            flexWrap={{ base: "nowrap", sm: "wrap" }}
          >
            {(
              [
                {
                  id: "reading",
                  label: "Reading",
                  icon: IconBook,
                  count: readingExams.length,
                  inProg: readingInProgressCount,
                },
                {
                  id: "listening",
                  label: "Listening",
                  icon: IconHeadphones,
                  count: listeningExams.length,
                  inProg: listeningInProgressCount,
                },
                {
                  id: "writing",
                  label: "Writing",
                  icon: IconPencil,
                  count: writingExams.length,
                  inProg: writingInProgressCount,
                },
                {
                  id: "speaking",
                  label: "Speaking",
                  icon: IconMicrophone,
                  count: speakingExams.length,
                  inProg: speakingInProgressCount,
                },
              ] as const
            ).map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <Button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSelectedCollectionName(null);
                  }}
                  leftIcon={<Icon as={tab.icon} boxSize={4} />}
                  variant={isSelected ? "solid" : "outline"}
                  colorScheme={isSelected ? "blue" : "gray"}
                  bg={isSelected ? undefined : cardBg}
                  borderColor={isSelected ? undefined : cardBorder}
                  borderWidth="2px"
                  rounded="xl"
                  fontWeight={700}
                  fontSize="sm"
                  flexShrink={0}
                >
                  <HStack spacing={2}>
                    <Text>{tab.label}</Text>
                    <Badge
                      colorScheme={isSelected ? "blue" : "gray"}
                      variant={isSelected ? "solid" : "subtle"}
                      rounded="md"
                      px={1.5}
                      fontSize="xs"
                    >
                      {tab.count}
                    </Badge>
                    {tab.inProg > 0 && (
                      <Badge
                        colorScheme="green"
                        variant="solid"
                        rounded="full"
                        px={1.5}
                        fontSize="10px"
                      >
                        {tab.inProg}
                      </Badge>
                    )}
                  </HStack>
                </Button>
              );
            })}
          </HStack>

          {/* Right side controls: View Switcher (All vs Collections) + Quick Add */}
          <HStack spacing={2} flexWrap="wrap">
            {(activeTab === "reading" || activeTab === "listening") && (
              <HStack
                bg={pillBg}
                p={1}
                rounded="xl"
                borderWidth="2px"
                borderColor={cardBorder}
                spacing={1}
              >
                <Button
                  size="sm"
                  rounded="lg"
                  fontWeight={700}
                  variant={viewMode === "all_tests" ? "solid" : "ghost"}
                  colorScheme={viewMode === "all_tests" ? "blue" : "gray"}
                  onClick={() => {
                    setViewMode("all_tests");
                    setSelectedCollectionName(null);
                  }}
                >
                  All Tests (
                  {activeTab === "reading"
                    ? readingExams.length
                    : listeningExams.length}
                  )
                </Button>
                <Button
                  size="sm"
                  rounded="lg"
                  fontWeight={700}
                  variant={viewMode === "by_collection" ? "solid" : "ghost"}
                  colorScheme={viewMode === "by_collection" ? "blue" : "gray"}
                  onClick={() => setViewMode("by_collection")}
                >
                  Collections ({collections.length})
                </Button>
              </HStack>
            )}

            {activeTab === "writing" && (
              <Button
                size="sm"
                rounded="xl"
                colorScheme="blue"
                fontWeight={700}
                leftIcon={<IconPlus size={16} />}
                onClick={() => {
                  setEditingWritingExam(null);
                  setIsWritingEditorOpen(true);
                }}
              >
                Add Writing Test
              </Button>
            )}

            {activeTab === "speaking" && (
              <Button
                size="sm"
                rounded="xl"
                colorScheme="blue"
                fontWeight={700}
                leftIcon={<IconPlus size={16} />}
                onClick={() => {
                  setEditingSpeakingExam(null);
                  setIsSpeakingEditorOpen(true);
                }}
              >
                Add Speaking Test
              </Button>
            )}
          </HStack>
        </Flex>

        {/* Active Search Filter Notice */}
        {searchQuery.trim() && (
          <HStack
            justify="space-between"
            bg={cardBg}
            borderWidth="2px"
            borderColor={cardBorder}
            rounded="xl"
            px={4}
            py={3}
          >
            <Text fontSize="sm" fontWeight={600}>
              Search results for &ldquo;{searchQuery}&rdquo;
            </Text>
            <Button
              size="xs"
              variant="ghost"
              colorScheme="blue"
              leftIcon={<IconX size={14} />}
              onClick={() => {
                setSearchQuery("");
                menuEventChannel.emit("ieltsSearchChange", "");
              }}
            >
              Clear Filter
            </Button>
          </HStack>
        )}

        {/* 3. TAB 1 & 2: READING & LISTENING SECTIONS */}
        {(activeTab === "reading" || activeTab === "listening") && (
          <Stack spacing={6}>
            <HStack justify="space-between" align="center" flexWrap="wrap">
              <HStack spacing={2.5}>
                <Icon
                  as={activeTab === "reading" ? IconBook : IconHeadphones}
                  boxSize={6}
                  color={activeTab === "reading" ? "blue.400" : "purple.400"}
                />
                <Heading size="lg" fontFamily={outfit.style.fontFamily}>
                  {activeTab === "reading"
                    ? "IELTS Reading Tests"
                    : "IELTS Listening Tests"}
                </Heading>
                <Badge
                  colorScheme={activeTab === "reading" ? "blue" : "purple"}
                  fontSize="sm"
                  px={2}
                  py={0.5}
                  rounded="md"
                >
                  {activeTab === "reading"
                    ? `${filteredReading.length} Tests`
                    : `${filteredListening.length} Tests`}
                </Badge>
              </HStack>
              <Text fontSize="sm" color={secondaryColor}>
                {activeTab === "reading"
                  ? "Split-screen passage & questions, 4-color text highlighter, and instant Band 9.0 scoring"
                  : "4-Section audio player with playback speed controls and automated scoring"}
              </Text>
            </HStack>

            {viewMode === "all_tests" ? (
              <Grid
                templateColumns="repeat(auto-fill, minmax(min(100%, 280px), 1fr))"
                gap={4}
              >
                {(activeTab === "reading"
                  ? filteredReading
                  : filteredListening
                ).map((test) => renderExamCardItem(test))}
              </Grid>
            ) : selectedCollectionName ? (
              /* Inside a selected collection folder */
              <Stack spacing={5}>
                <HStack justify="space-between" flexWrap="wrap">
                  <HStack spacing={3}>
                    <Button
                      size="sm"
                      variant="outline"
                      rounded="xl"
                      leftIcon={<IconArrowLeft size={16} />}
                      onClick={() => setSelectedCollectionName(null)}
                    >
                      All Collections
                    </Button>
                    <Heading size="md" fontFamily={outfit.style.fontFamily}>
                      {selectedCollectionName}
                    </Heading>
                  </HStack>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    rounded="xl"
                    leftIcon={<IconPlus size={16} />}
                    onClick={() =>
                      onOpenSmartImport(selectedCollectionName, activeTab)
                    }
                  >
                    Add Test to {selectedCollectionName}
                  </Button>
                </HStack>

                <Grid
                  templateColumns="repeat(auto-fill, minmax(min(100%, 280px), 1fr))"
                  gap={4}
                >
                  {(activeTab === "reading" ? readingExams : listeningExams)
                    .filter(
                      (e) => getExamCollection(e) === selectedCollectionName,
                    )
                    .map((test) => renderExamCardItem(test))}
                </Grid>
              </Stack>
            ) : (
              /* Collections Folder Grid (Matches FolderCard style from Quiz) */
              <Grid
                templateColumns="repeat(auto-fill, minmax(min(100%, 260px), 1fr))"
                gap={4}
              >
                {collections.map((col) => {
                  const colExams = (
                    activeTab === "reading" ? readingExams : listeningExams
                  ).filter((e) => getExamCollection(e) === col.name);
                  return (
                    <GridItem key={col.name}>
                      <Box
                        as="article"
                        h="full"
                        minH="148px"
                        rounded="xl"
                        p="5"
                        bg={cardBg}
                        borderColor={cardBorder}
                        borderWidth="2px"
                        shadow="lg"
                        cursor="pointer"
                        transition="all ease-in-out 150ms"
                        onClick={() => setSelectedCollectionName(col.name)}
                        _hover={{
                          transform: "translateY(-2px)",
                          borderBottomColor: "blue.300",
                        }}
                      >
                        <Flex
                          justify="space-between"
                          direction="column"
                          h="full"
                          gap={4}
                        >
                          <Stack spacing={2}>
                            <HStack justify="space-between">
                              <HStack spacing={2}>
                                <Icon
                                  as={IconFolder}
                                  boxSize={5}
                                  color="blue.400"
                                />
                                <Heading
                                  size="md"
                                  fontFamily={outfit.style.fontFamily}
                                  noOfLines={1}
                                >
                                  {col.name}
                                </Heading>
                              </HStack>
                              {!col.isBuiltin && (
                                <IconButton
                                  size="xs"
                                  variant="ghost"
                                  aria-label={`Delete ${col.name}`}
                                  icon={<IconTrash size={14} />}
                                  onClick={(e) =>
                                    handleDeleteCollection(e, col.name)
                                  }
                                />
                              )}
                            </HStack>
                            <Text
                              fontSize="sm"
                              color={secondaryColor}
                              noOfLines={2}
                            >
                              {col.description ||
                                "Curated IELTS practice collection"}
                            </Text>
                          </Stack>

                          <HStack justify="space-between">
                            <Badge
                              colorScheme="blue"
                              variant="subtle"
                              rounded="md"
                              px={2}
                              py={0.5}
                            >
                              {colExams.length}{" "}
                              {activeTab === "reading"
                                ? "Reading"
                                : "Listening"}{" "}
                              Tests
                            </Badge>
                            <Icon
                              as={IconArrowRight}
                              boxSize={4}
                              color={secondaryColor}
                            />
                          </HStack>
                        </Flex>
                      </Box>
                    </GridItem>
                  );
                })}
              </Grid>
            )}
          </Stack>
        )}

        {/* 4. TAB 3: WRITING SECTION */}
        {activeTab === "writing" && (
          <Stack spacing={6}>
            <HStack justify="space-between" align="center" flexWrap="wrap">
              <HStack spacing={2.5}>
                <Icon as={IconPencil} boxSize={6} color="orange.400" />
                <Heading size="lg" fontFamily={outfit.style.fontFamily}>
                  IELTS Writing Tests (Task 1 &amp; Task 2)
                </Heading>
                <Badge
                  colorScheme="orange"
                  fontSize="sm"
                  px={2}
                  py={0.5}
                  rounded="md"
                >
                  {filteredWriting.length} Tests
                </Badge>
              </HStack>
              <Text fontSize="sm" color={secondaryColor}>
                Split-screen essay room, interactive charts, live word counter, Band 8.5+ model essays &amp; AI Coach
              </Text>
            </HStack>

            <Grid
              templateColumns="repeat(auto-fill, minmax(min(100%, 280px), 1fr))"
              gap={4}
            >
              {filteredWriting.map((test) => {
                const savedW = getSavedWritingSummary(test.id);
                return (
                  <GridItem key={`${test.id}-${progressVersion}`}>
                    <UnifiedIeltsCard
                      title={test.title}
                      collectionName={test.collection || "IELTS Writing"}
                      metaText={
                        savedW
                          ? `${Math.ceil(
                              savedW.timeRemaining / 60,
                            )} mins left • T1: ${savedW.task1Words} words • T2: ${
                              savedW.task2Words
                            } words`
                          : `${test.durationMinutes} mins • Task 1 (150+ words) & Task 2 (250+ words)`
                      }
                      subText={test.task2.prompt}
                      skillColor="orange.400"
                      skillBadgeLabel="Writing"
                      skillIcon={IconPencil}
                      inProgressLabel={savedW ? "In Progress • Resume" : undefined}
                      onStart={() => onStartWritingExam(test)}
                      onEdit={() => {
                        setEditingWritingExam(test);
                        setIsWritingEditorOpen(true);
                      }}
                      onDelete={() =>
                        handleDeleteWritingExam(test.id, test.title)
                      }
                      onDiscardProgress={
                        savedW
                          ? () => handleDiscardWriting(test.id, test.title)
                          : undefined
                      }
                    />
                  </GridItem>
                );
              })}
            </Grid>
          </Stack>
        )}

        {/* 5. TAB 4: SPEAKING SECTION */}
        {activeTab === "speaking" && (
          <Stack spacing={6}>
            <HStack justify="space-between" align="center" flexWrap="wrap">
              <HStack spacing={2.5}>
                <Icon as={IconMicrophone} boxSize={6} color="pink.400" />
                <Heading size="lg" fontFamily={outfit.style.fontFamily}>
                  IELTS Speaking Tests (Part 1, 2 &amp; 3)
                </Heading>
                <Badge
                  colorScheme="pink"
                  fontSize="sm"
                  px={2}
                  py={0.5}
                  rounded="md"
                >
                  {filteredSpeaking.length} Tests
                </Badge>
              </HStack>
              <Text fontSize="sm" color={secondaryColor}>
                Interactive voice recording studio, live Speech-to-Text transcript, 1-minute Cue Card timer &amp; Band 8.0+ sample answers
              </Text>
            </HStack>

            <Grid
              templateColumns="repeat(auto-fill, minmax(min(100%, 280px), 1fr))"
              gap={4}
            >
              {filteredSpeaking.map((test) => {
                const savedS = loadSpeakingProgress(test.id);
                return (
                  <GridItem key={`${test.id}-${progressVersion}`}>
                    <UnifiedIeltsCard
                      title={test.title}
                      collectionName={test.collection || "IELTS Speaking"}
                      metaText={`Part 1 (${test.part1Questions.length} Qs) • Part 2 Cue Card • Part 3 (${test.part3Questions.length} Qs)`}
                      subText={`Cue Card: "${test.part2Question.questionText}"`}
                      skillColor="pink.400"
                      skillBadgeLabel="Speaking"
                      skillIcon={IconMicrophone}
                      inProgressLabel={
                        savedS ? "In Progress • Resume" : undefined
                      }
                      onStart={() => onStartSpeakingExam(test)}
                      onEdit={() => {
                        setEditingSpeakingExam(test);
                        setIsSpeakingEditorOpen(true);
                      }}
                      onDelete={() =>
                        handleDeleteSpeakingExam(test.id, test.title)
                      }
                      onDiscardProgress={
                        savedS
                          ? () => handleDiscardSpeaking(test.id, test.title)
                          : undefined
                      }
                    />
                  </GridItem>
                );
              })}
            </Grid>
          </Stack>
        )}
      </Stack>

      {/* New Collection Modal (Chakra UI) */}
      <Modal
        isOpen={showNewCollectionModal}
        onClose={() => setShowNewCollectionModal(false)}
        isCentered
      >
        <ModalOverlay />
        <ModalContent>
          <form onSubmit={handleCreateCollection}>
            <ModalHeader fontFamily={outfit.style.fontFamily}>
              Create New Collection
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Stack spacing={4}>
                <Box>
                  <Text fontSize="xs" fontWeight={700} mb={1}>
                    Collection Name (e.g., Cambridge 20, Q2 Forecast...)
                  </Text>
                  <Input
                    required
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="Enter collection name..."
                    rounded="xl"
                  />
                </Box>
                <Box>
                  <Text fontSize="xs" fontWeight={700} mb={1}>
                    Short Description (Optional)
                  </Text>
                  <Textarea
                    value={newCollectionDesc}
                    onChange={(e) => setNewCollectionDesc(e.target.value)}
                    placeholder="Notes about this collection..."
                    rows={2}
                    rounded="xl"
                  />
                </Box>
              </Stack>
            </ModalBody>
            <ModalFooter gap={2}>
              <Button
                variant="ghost"
                onClick={() => setShowNewCollectionModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" colorScheme="blue" rounded="xl">
                Create Collection
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Writing & Speaking Editor Modals (Lazy-mounted only when open) */}
      {isWritingEditorOpen && (
        <WritingEditorModal
          key={editingWritingExam?.id || "new-writing"}
          isOpen={isWritingEditorOpen}
          onClose={() => {
            setIsWritingEditorOpen(false);
            setEditingWritingExam(null);
          }}
          initialExam={editingWritingExam}
          onSave={handleSaveWriting}
        />
      )}

      {isSpeakingEditorOpen && (
        <SpeakingEditorModal
          key={editingSpeakingExam?.id || "new-speaking"}
          isOpen={isSpeakingEditorOpen}
          onClose={() => {
            setIsSpeakingEditorOpen(false);
            setEditingSpeakingExam(null);
          }}
          initialExam={editingSpeakingExam}
          onSave={handleSaveSpeaking}
        />
      )}
    </Container>
  );
};
