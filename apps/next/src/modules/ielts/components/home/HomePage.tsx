import React, { useCallback, useMemo, useState, useEffect, useRef, type FC } from 'react';
import { outfit } from '@pno/lib/chakra-theme';
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
  Menu,
  MenuButton,
  MenuList,
  Stack,
  Text,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import {
  IconAdjustmentsHorizontal,
  IconArrowLeft,
  IconArrowRight,
  IconBook,
  IconCheck,
  IconDotsVertical,
  IconFolder,
  IconHeadphones,
  IconHistory,
  IconLayoutGrid,
  IconMicrophone,
  IconPencil,
  IconPlayerPlay,
  IconRotateClockwise,
  IconX,
} from '@tabler/icons-react';

import { menuEventChannel } from '../../../../events/menu';
import { MenuOption } from '../../../../components/menu-option';
import type { Exam } from '../../types/exam';
import type { WritingExam } from '../../types/writing';
import type { SpeakingExam } from '../../types/speaking';
import { getAllWritingExams } from '../../data/writingExams';
import { getAllSpeakingExams } from '../../data/speakingExams';
import {
  getAllCollections,
  getDeletedCollections,
  getExamCollection,
  getExamPartCount,
  getExamQuestionCount,
  isListeningExam,
} from '../../utils/storage';
import type { IeltsHomeRoute, IeltsSkillSlug } from '../../utils/ieltsRoutes';
import type { CloudAttemptRow, CloudIeltsSkill } from '../../utils/cloudSync';
import {
  getSavedExamSummary,
  clearExamProgress,
} from '../../utils/examProgress';
import {
  getSavedWritingSummary,
  clearWritingProgress,
  loadSpeakingProgress,
  clearSpeakingProgress,
} from '../../utils/writingProgress';
import {
  TestDetailView,
  type DetailTarget,
  type StartExamOptions,
} from './TestDetailView';
import {
  IeltsManageTab,
  type CloudExamPayload,
} from '../admin/IeltsManageTab';

interface HomePageProps {
  exams: Exam[];
  recentAttempts?: CloudAttemptRow[];
  syncStatus?: 'synced' | 'saving' | 'offline';
  homeRoute: IeltsHomeRoute;
  openNewCollectionSignal?: number;
  onNavigateHomeRoute: (route: IeltsHomeRoute, replace?: boolean) => void;
  onSelectExam: (exam: Exam, options?: StartExamOptions) => void;
  onOpenEditor: (
    exam?: Exam | null,
    defaultCollection?: string,
    defaultSkill?: 'reading' | 'listening'
  ) => void;
  onEditWriting: (exam?: WritingExam | null, defaultCollection?: string) => void;
  onEditSpeaking: (exam?: SpeakingExam | null, defaultCollection?: string) => void;
  onOpenSmartImport: (
    collection?: string,
    skill?: 'reading' | 'listening' | 'writing' | 'speaking'
  ) => void;
  onRefreshExams: () => void;
  onStartWritingExam: (exam: WritingExam, fresh?: boolean) => void;
  onStartSpeakingExam: (exam: SpeakingExam, fresh?: boolean) => void;
  onViewAttemptDetail?: (attempt: CloudAttemptRow) => void;
  onDeleteAttempt?: (id: string) => void;
  onCloudSaveExam?: (
    skill: CloudIeltsSkill,
    examId: string,
    title: string,
    collection: string,
    data: Record<string, unknown>
  ) => void;
  onCloudDeleteExam?: (skill: CloudIeltsSkill, examId: string) => void;
  onCloudCreateCollection?: (col: { name: string; description?: string }) => void;
  onCloudRenameCollection?: (payload: {
    oldName: string;
    newName: string;
    description?: string;
    movedExams: CloudExamPayload[];
  }) => void;
  onCloudDeleteCollection?: (
    name: string,
    examsToTombstone: Array<{ examId: string; skill: CloudIeltsSkill }>
  ) => void;
  onCloudBulkDeleteExams?: (
    items: Array<{ examId: string; skill: CloudIeltsSkill }>
  ) => void;
  onCloudBulkMoveExams?: (
    targetCollection: string,
    items: CloudExamPayload[]
  ) => void;
  onCloudRestoreDefaults?: () => void;
  onCloudClearProgress?: (skill: CloudIeltsSkill, examId: string) => void;
}

type PrimaryTab = 'collections' | 'history' | 'manage';
type SkillTab = 'all' | 'reading' | 'listening' | 'writing' | 'speaking';
type StatusFilter = 'all' | 'unstarted' | 'in_progress' | 'completed';
type HistorySkillFilter = SkillTab;
type HistoryStatusFilter = 'all' | 'in_progress' | 'completed';

interface UnifiedIeltsCardProps {
  title: string;
  collectionName: string;
  metaText: string;
  subText?: string;
  skillColor: string;
  skillBadgeLabel: string;
  skillIcon: React.ElementType;
  statusType: 'unstarted' | 'in_progress' | 'completed';
  statusBadgeLabel?: string;
  attemptCount?: number;
  bestBand?: number | null;
  onOpenDetail: () => void;
  onQuickStart: () => void;
  onDiscardProgress?: () => void;
}

const UnifiedIeltsCard: FC<UnifiedIeltsCardProps> = ({
  title,
  collectionName,
  metaText,
  subText,
  skillColor,
  skillBadgeLabel,
  skillIcon,
  statusType,
  statusBadgeLabel,
  attemptCount = 0,
  bestBand,
  onOpenDetail,
  onQuickStart,
  onDiscardProgress,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const inProgBorder = useColorModeValue('emerald.400', 'emerald.500');
  const completedBorder = useColorModeValue('blue.200', 'blue.700');
  const secondaryColor = useColorModeValue('gray.600', 'gray.400');

  return (
    <Box
      as="article"
      role="group"
      h="full"
      minH="168px"
      rounded="xl"
      p="5"
      bg={cardBg}
      borderColor={
        statusType === 'in_progress'
          ? inProgBorder
          : statusType === 'completed'
            ? completedBorder
            : cardBorder
      }
      borderWidth="2px"
      shadow="lg"
      cursor="pointer"
      transition="all ease-in-out 150ms"
      zIndex={menuOpen ? 30 : 25}
      position="relative"
      onClick={onOpenDetail}
      _hover={{
        transform: 'translateY(-2px)',
        borderBottomColor: statusType === 'in_progress' ? 'emerald.400' : 'blue.400',
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
            {statusType === 'in_progress' ? (
              <Badge
                colorScheme="green"
                fontSize="xs"
                px={2}
                py={0.5}
                rounded="md"
                flexShrink={0}
              >
                {statusBadgeLabel || 'In Progress'}
              </Badge>
            ) : statusType === 'completed' ? (
              <Badge
                colorScheme="blue"
                fontSize="xs"
                px={2}
                py={0.5}
                rounded="md"
                flexShrink={0}
              >
                {bestBand !== null && bestBand !== undefined
                  ? `Band ${bestBand.toFixed(1)}`
                  : `${attemptCount} ${attemptCount === 1 ? 'attempt' : 'attempts'}`}
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
          <HStack spacing={1.5} flexWrap="wrap">
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
            {attemptCount > 0 && (
              <Badge
                colorScheme="green"
                variant="subtle"
                fontSize="xs"
                px={2}
                py={0.5}
                rounded="md"
              >
                <HStack spacing={1}>
                  <Icon as={IconCheck} boxSize={3} />
                  <Text>
                    {attemptCount} {attemptCount === 1 ? 'attempt' : 'attempts'}
                  </Text>
                </HStack>
              </Badge>
            )}
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
              <MenuList overflow="hidden" minW="auto" w="48" zIndex={40}>
                <MenuOption
                  icon={<IconPlayerPlay size={16} />}
                  label={statusType === 'in_progress' ? 'Resume Test' : 'View Details'}
                  fontSize="sm"
                  py="6px"
                  onClick={statusType === 'in_progress' ? onQuickStart : onOpenDetail}
                />
                {onDiscardProgress && (
                  <MenuOption
                    icon={<IconRotateClockwise size={16} />}
                    label="Discard Draft"
                    fontSize="sm"
                    py="6px"
                    onClick={onDiscardProgress}
                  />
                )}
              </MenuList>
            </Menu>
          </HStack>
        </Flex>
      </Flex>
    </Box>
  );
};

interface HistoryEntry {
  key: string;
  examId: string;
  title: string;
  collection: string;
  skill: 'reading' | 'listening' | 'writing' | 'speaking';
  skillLabel: CloudIeltsSkill;
  isInProgress: boolean;
  inProgressMeta?: string;
  attempts: CloudAttemptRow[];
  bestBand: number | null;
  latestActivityAt: number;
  target: DetailTarget | null;
}

export const HomePage: FC<HomePageProps> = ({
  exams,
  recentAttempts = [],
  syncStatus = 'synced',
  homeRoute,
  openNewCollectionSignal = 0,
  onNavigateHomeRoute,
  onSelectExam,
  onOpenEditor,
  onEditWriting,
  onEditSpeaking,
  onOpenSmartImport,
  onRefreshExams,
  onStartWritingExam,
  onStartSpeakingExam,
  onViewAttemptDetail,
  onDeleteAttempt,
  onCloudSaveExam,
  onCloudDeleteExam,
  onCloudCreateCollection,
  onCloudRenameCollection,
  onCloudDeleteCollection,
  onCloudBulkDeleteExams,
  onCloudBulkMoveExams,
  onCloudRestoreDefaults,
  onCloudClearProgress,
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [historySkillFilter, setHistorySkillFilter] = useState<HistorySkillFilter>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>('all');
  const [localNewColSignal, setLocalNewColSignal] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [progressVersion, setProgressVersion] = useState(0);

  const [writingExams, setWritingExams] = useState<WritingExam[]>(() =>
    getAllWritingExams()
  );
  const [speakingExams, setSpeakingExams] = useState<SpeakingExam[]>(() =>
    getAllSpeakingExams()
  );

  const lastBackRouteRef = useRef<IeltsHomeRoute | null>(null);

  const primaryTab: PrimaryTab =
    homeRoute.tab === 'history'
      ? 'history'
      : homeRoute.tab === 'manage'
        ? 'manage'
        : 'collections';
  const selectedCollectionName =
    homeRoute.tab === 'collections' ? (homeRoute.collectionName ?? null) : null;
  const activeSkillTab: SkillTab =
    homeRoute.tab === 'collections' && homeRoute.skill ? homeRoute.skill : 'all';
  const manageSubTab: 'tests' | 'collections' =
    homeRoute.tab === 'manage' ? homeRoute.subTab : 'tests';

  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const secondaryColor = useColorModeValue('gray.600', 'gray.400');
  const pillBg = useColorModeValue('gray.100', 'gray.750');

  useEffect(() => {
    setWritingExams(getAllWritingExams());
    setSpeakingExams(getAllSpeakingExams());
  }, [exams]);

  // Listen to unified PNO Navbar / CommandMenu events
  useEffect(() => {
    const handleOpenManage = () => {
      onNavigateHomeRoute({ tab: 'manage', subTab: 'tests' });
    };
    const handleAddTest = () => {
      onNavigateHomeRoute({ tab: 'manage', subTab: 'tests' });
      onOpenSmartImport();
    };
    const handleNewCollection = () => {
      onNavigateHomeRoute({ tab: 'manage', subTab: 'collections' });
      setLocalNewColSignal((v) => v + 1);
    };
    const handleSearch = (q: string) => setSearchQuery(q);

    menuEventChannel.on('openIeltsManage', handleOpenManage);
    menuEventChannel.on('openIeltsTestBank', handleOpenManage);
    menuEventChannel.on('openIeltsAddTest', handleAddTest);
    menuEventChannel.on('openIeltsNewCollection', handleNewCollection);
    menuEventChannel.on('ieltsSearchChange', handleSearch);

    return () => {
      menuEventChannel.off('openIeltsManage', handleOpenManage);
      menuEventChannel.off('openIeltsTestBank', handleOpenManage);
      menuEventChannel.off('openIeltsAddTest', handleAddTest);
      menuEventChannel.off('openIeltsNewCollection', handleNewCollection);
      menuEventChannel.off('ieltsSearchChange', handleSearch);
    };
  }, [onNavigateHomeRoute, onOpenSmartImport]);

  const refreshAll = useCallback(() => {
    onRefreshExams();
    setWritingExams(getAllWritingExams());
    setSpeakingExams(getAllSpeakingExams());
    setProgressVersion((v) => v + 1);
  }, [onRefreshExams]);

  // Combine collections from Reading/Listening + Writing + Speaking (aligned to 'My Tests' & respecting deleted collections)
  const collections = useMemo(() => {
    const base = getAllCollections();
    const deletedCols = getDeletedCollections();
    const map = new Map<
      string,
      { id: string; name: string; description?: string; isBuiltin?: boolean }
    >();
    for (const c of base) {
      map.set(c.name.toLowerCase(), c);
    }
    for (const ex of exams) {
      const colName = getExamCollection(ex).trim();
      const lower = colName.toLowerCase();
      if (!deletedCols.has(lower) && !map.has(lower)) {
        map.set(lower, {
          id: `col_e_${lower}`,
          name: colName,
          description: `${colName} Collection`,
          isBuiltin: false,
        });
      }
    }
    for (const w of writingExams) {
      const colName = (w.collection || 'My Tests').trim();
      const lower = colName.toLowerCase();
      if (!deletedCols.has(lower) && !map.has(lower)) {
        map.set(lower, {
          id: `col_w_${lower}`,
          name: colName,
          description: `${colName} Collection`,
          isBuiltin: false,
        });
      }
    }
    for (const s of speakingExams) {
      const colName = (s.collection || 'My Tests').trim();
      const lower = colName.toLowerCase();
      if (!deletedCols.has(lower) && !map.has(lower)) {
        map.set(lower, {
          id: `col_s_${lower}`,
          name: colName,
          description: `${colName} Collection`,
          isBuiltin: false,
        });
      }
    }
    return Array.from(map.values());
  }, [exams, writingExams, speakingExams]);

  // Index attempts by skill:examId
  const attemptsMap = useMemo(() => {
    const map = new Map<string, CloudAttemptRow[]>();
    for (const attempt of recentAttempts) {
      const key = `${attempt.skill}:${attempt.examId}`;
      const list = map.get(key) ?? [];
      list.push(attempt);
      map.set(key, list);
    }
    return map;
  }, [recentAttempts]);

  const getAttemptsFor = useCallback(
    (skill: CloudIeltsSkill, examId: string): CloudAttemptRow[] =>
      attemptsMap.get(`${skill}:${examId}`) ?? [],
    [attemptsMap]
  );

  const getBestBand = (attempts: CloudAttemptRow[]): number | null => {
    let best: number | null = null;
    for (const a of attempts) {
      if (a.bandScore !== null && a.bandScore !== undefined) {
        best = best === null ? a.bandScore : Math.max(best, a.bandScore);
      }
    }
    return best;
  };

  // Handlers
  const openTestDetail = useCallback(
    (skill: IeltsSkillSlug, examId: string) => {
      lastBackRouteRef.current = homeRoute;
      onNavigateHomeRoute({ tab: 'test_detail', skill, examId });
    },
    [homeRoute, onNavigateHomeRoute]
  );

  const handleDiscardExam = (exam: Exam) => {
    clearExamProgress(exam.id);
    onCloudClearProgress?.(
      isListeningExam(exam) ? 'Listening' : 'Reading',
      exam.id
    );
    setProgressVersion((v) => v + 1);
    toast({
      title: 'Draft discarded',
      description: `"${exam.title}" is ready for a fresh start.`,
      status: 'info',
      duration: 2000,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  const handleDiscardWriting = (examId: string, title: string) => {
    clearWritingProgress(examId);
    onCloudClearProgress?.('Writing', examId);
    setProgressVersion((v) => v + 1);
    toast({
      title: 'Writing draft discarded',
      description: `"${title}" has been reset.`,
      status: 'info',
      duration: 2000,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  const handleDiscardSpeaking = (examId: string, title: string) => {
    clearSpeakingProgress(examId);
    onCloudClearProgress?.('Speaking', examId);
    setProgressVersion((v) => v + 1);
    toast({
      title: 'Speaking session reset',
      description: `"${title}" has been reset.`,
      status: 'info',
      duration: 2000,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  const readingExams = useMemo(
    () => exams.filter((e) => !isListeningExam(e)),
    [exams]
  );
  const listeningExams = useMemo(
    () => exams.filter((e) => isListeningExam(e)),
    [exams]
  );

  // Build unified History entries (any exam with saved progress OR >= 1 attempt)
  const historyEntries = useMemo<HistoryEntry[]>(() => {
    void progressVersion;
    const entriesMap = new Map<string, HistoryEntry>();

    for (const exam of exams) {
      const isListen = isListeningExam(exam);
      const skill: 'reading' | 'listening' = isListen ? 'listening' : 'reading';
      const skillLabel: CloudIeltsSkill = isListen ? 'Listening' : 'Reading';
      const saved = getSavedExamSummary(exam.id);
      const attempts = getAttemptsFor(skillLabel, exam.id);

      if (!saved && attempts.length === 0) continue;

      const totalQ = getExamQuestionCount(exam);
      const latestAttemptAt = attempts[0]
        ? new Date(attempts[0].completedAt).getTime()
        : 0;
      const latestSavedAt = saved?.lastSavedAt ?? 0;

      entriesMap.set(`${skillLabel}:${exam.id}`, {
        key: `${skillLabel}:${exam.id}`,
        examId: exam.id,
        title: exam.title,
        collection: getExamCollection(exam),
        skill,
        skillLabel,
        isInProgress: Boolean(saved),
        inProgressMeta: saved
          ? `${saved.answeredCount}/${totalQ} Qs • ${Math.ceil(saved.timeRemaining / 60)} min left`
          : undefined,
        attempts,
        bestBand: getBestBand(attempts),
        latestActivityAt: Math.max(latestAttemptAt, latestSavedAt),
        target: { kind: 'exam', exam },
      });
    }

    for (const w of writingExams) {
      const saved = getSavedWritingSummary(w.id);
      const attempts = getAttemptsFor('Writing', w.id);
      if (!saved && attempts.length === 0) continue;

      const latestAttemptAt = attempts[0]
        ? new Date(attempts[0].completedAt).getTime()
        : 0;
      const latestSavedAt = saved?.lastSavedAt ?? 0;

      entriesMap.set(`Writing:${w.id}`, {
        key: `Writing:${w.id}`,
        examId: w.id,
        title: w.title,
        collection: w.collection || 'My Tests',
        skill: 'writing',
        skillLabel: 'Writing',
        isInProgress: Boolean(saved),
        inProgressMeta: saved
          ? `Task 1: ${saved.task1Words}w • Task 2: ${saved.task2Words}w`
          : undefined,
        attempts,
        bestBand: null,
        latestActivityAt: Math.max(latestAttemptAt, latestSavedAt),
        target: { kind: 'writing', exam: w },
      });
    }

    for (const s of speakingExams) {
      const saved = loadSpeakingProgress(s.id);
      const attempts = getAttemptsFor('Speaking', s.id);
      if (!saved && attempts.length === 0) continue;

      const latestAttemptAt = attempts[0]
        ? new Date(attempts[0].completedAt).getTime()
        : 0;
      const latestSavedAt = saved?.lastSavedAt ?? 0;

      entriesMap.set(`Speaking:${s.id}`, {
        key: `Speaking:${s.id}`,
        examId: s.id,
        title: s.title,
        collection: s.collection || 'My Tests',
        skill: 'speaking',
        skillLabel: 'Speaking',
        isInProgress: Boolean(saved),
        inProgressMeta: saved ? `On Part ${saved.activePart}` : undefined,
        attempts,
        bestBand: null,
        latestActivityAt: Math.max(latestAttemptAt, latestSavedAt),
        target: { kind: 'speaking', exam: s },
      });
    }

    // Include any attempts whose exam wasn't found in the current catalog
    for (const [key, list] of attemptsMap.entries()) {
      if (entriesMap.has(key) || list.length === 0) continue;
      const first = list[0]!;
      const skill = first.skill.toLowerCase() as 'reading' | 'listening' | 'writing' | 'speaking';
      entriesMap.set(key, {
        key,
        examId: first.examId,
        title: first.examTitle,
        collection: 'IELTS',
        skill,
        skillLabel: first.skill,
        isInProgress: false,
        attempts: list,
        bestBand: getBestBand(list),
        latestActivityAt: new Date(first.completedAt).getTime(),
        target: null,
      });
    }

    return Array.from(entriesMap.values()).sort(
      (a, b) => b.latestActivityAt - a.latestActivityAt
    );
  }, [attemptsMap, exams, getAttemptsFor, progressVersion, speakingExams, writingExams]);

  const qLower = searchQuery.trim().toLowerCase();

  // Helper to open a collection defaulting to the "All" skill tab
  const handleOpenCollection = (colName: string) => {
    setStatusFilter('all');
    onNavigateHomeRoute({ tab: 'collections', collectionName: colName, skill: 'all' });
  };

  // Status matcher for a test
  const matchesStatusFilter = (
    filter: StatusFilter,
    isInProgress: boolean,
    attemptCount: number
  ) => {
    if (filter === 'all') return true;
    if (filter === 'in_progress') return isInProgress;
    if (filter === 'completed') return attemptCount > 0;
    return !isInProgress && attemptCount === 0;
  };

  const renderExamCard = (test: Exam) => {
    const totalQ = getExamQuestionCount(test);
    const totalParts = getExamPartCount(test);
    const colName = getExamCollection(test);
    const savedProgress = getSavedExamSummary(test.id);
    const isListen = isListeningExam(test);
    const skillLabel: CloudIeltsSkill = isListen ? 'Listening' : 'Reading';
    const attempts = getAttemptsFor(skillLabel, test.id);
    const bestBand = getBestBand(attempts);
    const statusType = savedProgress
      ? 'in_progress'
      : attempts.length > 0
        ? 'completed'
        : 'unstarted';
    const mins = savedProgress
      ? `${Math.ceil(savedProgress.timeRemaining / 60)}m left`
      : `${test.durationMinutes || (isListen ? 30 : 60)} min`;

    return (
      <GridItem key={`${test.id}-${progressVersion}`}>
        <UnifiedIeltsCard
          title={test.title}
          collectionName={colName}
          metaText={`${mins} • ${totalParts} ${
            isListen ? 'Sections' : 'Parts'
          } • ${totalQ} Qs`}
          skillColor={isListen ? 'purple.400' : 'blue.400'}
          skillBadgeLabel={skillLabel}
          skillIcon={isListen ? IconHeadphones : IconBook}
          statusType={statusType}
          statusBadgeLabel={
            savedProgress
              ? `In Progress (${savedProgress.answeredCount}/${totalQ})`
              : undefined
          }
          attemptCount={attempts.length}
          bestBand={bestBand}
          onOpenDetail={() =>
            openTestDetail(isListen ? 'listening' : 'reading', test.id)
          }
          onQuickStart={() => onSelectExam(test)}
          onDiscardProgress={
            savedProgress ? () => handleDiscardExam(test) : undefined
          }
        />
      </GridItem>
    );
  };

  const renderWritingCard = (test: WritingExam) => {
    const savedW = getSavedWritingSummary(test.id);
    const attempts = getAttemptsFor('Writing', test.id);
    const statusType = savedW
      ? 'in_progress'
      : attempts.length > 0
        ? 'completed'
        : 'unstarted';

    return (
      <GridItem key={`${test.id}-${progressVersion}`}>
        <UnifiedIeltsCard
          title={test.title}
          collectionName={test.collection || 'My Tests'}
          metaText={
            savedW
              ? `${Math.ceil(savedW.timeRemaining / 60)}m left • T1: ${savedW.task1Words}w • T2: ${savedW.task2Words}w`
              : `${test.durationMinutes} min • Task 1 & Task 2`
          }
          subText={test.task2.prompt}
          skillColor="orange.400"
          skillBadgeLabel="Writing"
          skillIcon={IconPencil}
          statusType={statusType}
          statusBadgeLabel="In Progress"
          attemptCount={attempts.length}
          onOpenDetail={() => openTestDetail('writing', test.id)}
          onQuickStart={() => onStartWritingExam(test)}
          onDiscardProgress={
            savedW ? () => handleDiscardWriting(test.id, test.title) : undefined
          }
        />
      </GridItem>
    );
  };

  const renderSpeakingCard = (test: SpeakingExam) => {
    const savedS = loadSpeakingProgress(test.id);
    const attempts = getAttemptsFor('Speaking', test.id);
    const statusType = savedS
      ? 'in_progress'
      : attempts.length > 0
        ? 'completed'
        : 'unstarted';

    return (
      <GridItem key={`${test.id}-${progressVersion}`}>
        <UnifiedIeltsCard
          title={test.title}
          collectionName={test.collection || 'My Tests'}
          metaText={`Part 1 (${test.part1Questions.length} Qs) • Part 2 • Part 3 (${test.part3Questions.length} Qs)`}
          subText={`Cue Card: "${test.part2Question.questionText}"`}
          skillColor="pink.400"
          skillBadgeLabel="Speaking"
          skillIcon={IconMicrophone}
          statusType={statusType}
          statusBadgeLabel="In Progress"
          attemptCount={attempts.length}
          onOpenDetail={() => openTestDetail('speaking', test.id)}
          onQuickStart={() => onStartSpeakingExam(test)}
          onDiscardProgress={
            savedS ? () => handleDiscardSpeaking(test.id, test.title) : undefined
          }
        />
      </GridItem>
    );
  };

  // Data inside selected collection
  const collectionData = useMemo(() => {
    void progressVersion;
    if (!selectedCollectionName) return null;
    const colLower = selectedCollectionName.toLowerCase();

    const rAll = readingExams.filter(
      (e) => getExamCollection(e).toLowerCase() === colLower
    );
    const lAll = listeningExams.filter(
      (e) => getExamCollection(e).toLowerCase() === colLower
    );
    const wAll = writingExams.filter(
      (w) => (w.collection || 'My Tests').toLowerCase() === colLower
    );
    const sAll = speakingExams.filter(
      (s) => (s.collection || 'My Tests').toLowerCase() === colLower
    );

    const searchMatch = (title: string) =>
      !qLower || title.toLowerCase().includes(qLower);

    const getCountsForRL = (list: Exam[], skillLabel: 'Reading' | 'Listening') => {
      let unstarted = 0;
      let inProgress = 0;
      let completed = 0;
      const filtered = list.filter((e) => {
        if (!searchMatch(e.title)) return false;
        const isInProg = Boolean(getSavedExamSummary(e.id));
        const attCount = getAttemptsFor(skillLabel, e.id).length;
        if (isInProg) inProgress++;
        if (attCount > 0) completed++;
        if (!isInProg && attCount === 0) unstarted++;
        return matchesStatusFilter(statusFilter, isInProg, attCount);
      });
      return {
        allCount: list.filter((e) => searchMatch(e.title)).length,
        unstarted,
        inProgress,
        completed,
        filtered,
      };
    };

    const getCountsForWriting = (list: WritingExam[]) => {
      let unstarted = 0;
      let inProgress = 0;
      let completed = 0;
      const filtered = list.filter((w) => {
        if (!searchMatch(w.title)) return false;
        const isInProg = Boolean(getSavedWritingSummary(w.id));
        const attCount = getAttemptsFor('Writing', w.id).length;
        if (isInProg) inProgress++;
        if (attCount > 0) completed++;
        if (!isInProg && attCount === 0) unstarted++;
        return matchesStatusFilter(statusFilter, isInProg, attCount);
      });
      return {
        allCount: list.filter((w) => searchMatch(w.title)).length,
        unstarted,
        inProgress,
        completed,
        filtered,
      };
    };

    const getCountsForSpeaking = (list: SpeakingExam[]) => {
      let unstarted = 0;
      let inProgress = 0;
      let completed = 0;
      const filtered = list.filter((s) => {
        if (!searchMatch(s.title)) return false;
        const isInProg = Boolean(loadSpeakingProgress(s.id));
        const attCount = getAttemptsFor('Speaking', s.id).length;
        if (isInProg) inProgress++;
        if (attCount > 0) completed++;
        if (!isInProg && attCount === 0) unstarted++;
        return matchesStatusFilter(statusFilter, isInProg, attCount);
      });
      return {
        allCount: list.filter((s) => searchMatch(s.title)).length,
        unstarted,
        inProgress,
        completed,
        filtered,
      };
    };

    const readingStats = getCountsForRL(rAll, 'Reading');
    const listeningStats = getCountsForRL(lAll, 'Listening');
    const writingStats = getCountsForWriting(wAll);
    const speakingStats = getCountsForSpeaking(sAll);

    return {
      all: {
        allCount:
          readingStats.allCount +
          listeningStats.allCount +
          writingStats.allCount +
          speakingStats.allCount,
        unstarted:
          readingStats.unstarted +
          listeningStats.unstarted +
          writingStats.unstarted +
          speakingStats.unstarted,
        inProgress:
          readingStats.inProgress +
          listeningStats.inProgress +
          writingStats.inProgress +
          speakingStats.inProgress,
        completed:
          readingStats.completed +
          listeningStats.completed +
          writingStats.completed +
          speakingStats.completed,
      },
      reading: readingStats,
      listening: listeningStats,
      writing: writingStats,
      speaking: speakingStats,
    };
  }, [
    getAttemptsFor,
    listeningExams,
    progressVersion,
    qLower,
    readingExams,
    selectedCollectionName,
    speakingExams,
    statusFilter,
    writingExams,
  ]);

  // Filtered History entries
  const filteredHistoryEntries = useMemo(() => {
    return historyEntries.filter((entry) => {
      if (historySkillFilter !== 'all' && entry.skill !== historySkillFilter) {
        return false;
      }
      if (historyStatusFilter === 'in_progress' && !entry.isInProgress) {
        return false;
      }
      if (historyStatusFilter === 'completed' && entry.attempts.length === 0) {
        return false;
      }
      if (
        qLower &&
        !entry.title.toLowerCase().includes(qLower) &&
        !entry.collection.toLowerCase().includes(qLower)
      ) {
        return false;
      }
      return true;
    });
  }, [historyEntries, historySkillFilter, historyStatusFilter, qLower]);

  // Global search results when on root Collections view
  const globalSearchExams = useMemo(() => {
    if (!qLower || selectedCollectionName || primaryTab !== 'collections') {
      return [];
    }
    return exams.filter(
      (e) =>
        e.title.toLowerCase().includes(qLower) ||
        getExamCollection(e).toLowerCase().includes(qLower)
    );
  }, [exams, primaryTab, qLower, selectedCollectionName]);

  const activeStatusCounts = collectionData
    ? collectionData[activeSkillTab]
    : { allCount: 0, unstarted: 0, inProgress: 0, completed: 0 };

  const effectiveSelectedTarget = useMemo<DetailTarget | null>(() => {
    if (homeRoute.tab !== 'test_detail') return null;
    if (homeRoute.skill === 'writing') {
      const fresh = writingExams.find((w) => w.id === homeRoute.examId);
      return fresh ? { kind: 'writing', exam: fresh } : null;
    }
    if (homeRoute.skill === 'speaking') {
      const fresh = speakingExams.find((s) => s.id === homeRoute.examId);
      return fresh ? { kind: 'speaking', exam: fresh } : null;
    }
    const fresh = exams.find((e) => e.id === homeRoute.examId);
    return fresh ? { kind: 'exam', exam: fresh } : null;
  }, [exams, homeRoute, speakingExams, writingExams]);

  return (
    <Container maxW="7xl" py={{ base: 4, md: 6 }} flex="1">
      <Stack spacing={6}>
        {/* TOP PRIMARY TABS: Collections | History | Manage */}
        <Flex
          justify="space-between"
          align={{ base: 'stretch', sm: 'center' }}
          direction={{ base: 'column', sm: 'row' }}
          gap={3}
        >
          <HStack spacing={2} flexWrap="wrap">
            <Button
              leftIcon={<IconLayoutGrid size={17} />}
              variant={primaryTab === 'collections' ? 'solid' : 'outline'}
              colorScheme={primaryTab === 'collections' ? 'blue' : 'gray'}
              bg={primaryTab === 'collections' ? undefined : cardBg}
              borderColor={primaryTab === 'collections' ? undefined : cardBorder}
              borderWidth="2px"
              rounded="xl"
              fontWeight={700}
              size="md"
              onClick={() => onNavigateHomeRoute({ tab: 'collections' })}
            >
              <HStack spacing={2}>
                <Text>Collections</Text>
                <Badge
                  colorScheme={primaryTab === 'collections' ? 'blue' : 'gray'}
                  variant={primaryTab === 'collections' ? 'solid' : 'subtle'}
                  rounded="md"
                  px={1.5}
                >
                  {collections.length}
                </Badge>
              </HStack>
            </Button>

            <Button
              leftIcon={<IconHistory size={17} />}
              variant={primaryTab === 'history' ? 'solid' : 'outline'}
              colorScheme={primaryTab === 'history' ? 'blue' : 'gray'}
              bg={primaryTab === 'history' ? undefined : cardBg}
              borderColor={primaryTab === 'history' ? undefined : cardBorder}
              borderWidth="2px"
              rounded="xl"
              fontWeight={700}
              size="md"
              onClick={() => onNavigateHomeRoute({ tab: 'history' })}
            >
              <HStack spacing={2}>
                <Text>History</Text>
                <Badge
                  colorScheme={primaryTab === 'history' ? 'blue' : 'gray'}
                  variant={primaryTab === 'history' ? 'solid' : 'subtle'}
                  rounded="md"
                  px={1.5}
                >
                  {historyEntries.length}
                </Badge>
              </HStack>
            </Button>

            <Button
              leftIcon={<IconAdjustmentsHorizontal size={17} />}
              variant={primaryTab === 'manage' ? 'solid' : 'outline'}
              colorScheme={primaryTab === 'manage' ? 'blue' : 'gray'}
              bg={primaryTab === 'manage' ? undefined : cardBg}
              borderColor={primaryTab === 'manage' ? undefined : cardBorder}
              borderWidth="2px"
              rounded="xl"
              fontWeight={700}
              size="md"
              onClick={() => onNavigateHomeRoute({ tab: 'manage', subTab: manageSubTab })}
            >
              Manage
            </Button>
          </HStack>

          <HStack spacing={2}>
            <Badge
              colorScheme={
                syncStatus === 'offline'
                  ? 'orange'
                  : syncStatus === 'saving'
                    ? 'blue'
                    : 'green'
              }
              variant="subtle"
              px={2.5}
              py={1}
              rounded="lg"
              fontSize="xs"
            >
              {syncStatus === 'saving'
                ? 'Saving...'
                : syncStatus === 'offline'
                  ? 'Local only (Offline)'
                  : 'Auto-saved'}
            </Badge>
          </HStack>
        </Flex>

        {/* Active Search Filter Notice */}
        {searchQuery.trim() && !effectiveSelectedTarget && primaryTab !== 'manage' && (
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
              onClick={() => {
                setSearchQuery('');
                menuEventChannel.emit('ieltsSearchChange', '');
              }}
            >
              Clear filter
            </Button>
          </HStack>
        )}

        {/* SCREEN 3: TEST DETAIL VIEW (Pure Study) */}
        {effectiveSelectedTarget ? (
          <TestDetailView
            target={effectiveSelectedTarget}
            progressVersion={progressVersion}
            attempts={
              effectiveSelectedTarget.kind === 'exam'
                ? getAttemptsFor(
                    isListeningExam(effectiveSelectedTarget.exam)
                      ? 'Listening'
                      : 'Reading',
                    effectiveSelectedTarget.exam.id
                  )
                : effectiveSelectedTarget.kind === 'writing'
                  ? getAttemptsFor('Writing', effectiveSelectedTarget.exam.id)
                  : getAttemptsFor('Speaking', effectiveSelectedTarget.exam.id)
            }
            onBack={() => {
              if (lastBackRouteRef.current) {
                const back = lastBackRouteRef.current;
                lastBackRouteRef.current = null;
                onNavigateHomeRoute(back);
                return;
              }
              const colName =
                effectiveSelectedTarget.kind === 'exam'
                  ? getExamCollection(effectiveSelectedTarget.exam)
                  : effectiveSelectedTarget.exam.collection || 'My Tests';
              onNavigateHomeRoute({ tab: 'collections', collectionName: colName });
            }}
            onStartExam={(exam, options) => onSelectExam(exam, options)}
            onResumeExam={(exam) => onSelectExam(exam)}
            onDiscardExam={handleDiscardExam}
            onStartWriting={(exam, fresh) => onStartWritingExam(exam, fresh)}
            onDiscardWriting={handleDiscardWriting}
            onStartSpeaking={(exam, fresh) => onStartSpeakingExam(exam, fresh)}
            onDiscardSpeaking={handleDiscardSpeaking}
            onViewAttemptDetail={(attempt) => {
              onViewAttemptDetail?.(attempt);
            }}
            onDeleteAttempt={onDeleteAttempt}
          />
        ) : primaryTab === 'collections' ? (
          /* TAB 1: COLLECTIONS (Pure Study) */
          selectedCollectionName && collectionData ? (
            /* SCREEN 2: INSIDE A COLLECTION (All | Reading | Listening | Writing | Speaking) */
            <Stack spacing={5}>
              <Flex
                justify="space-between"
                align={{ base: 'start', sm: 'center' }}
                direction={{ base: 'column', sm: 'row' }}
                gap={3}
              >
                <HStack spacing={3}>
                  <Button
                    size="sm"
                    variant="outline"
                    rounded="xl"
                    leftIcon={<IconArrowLeft size={16} />}
                    onClick={() => {
                      setStatusFilter('all');
                      onNavigateHomeRoute({ tab: 'collections' });
                    }}
                  >
                    All Collections
                  </Button>
                  <Heading size="lg" fontFamily={outfit.style.fontFamily}>
                    {selectedCollectionName}
                  </Heading>
                </HStack>
              </Flex>

              {/* Row 1: All | Reading | Listening | Writing | Speaking */}
              <HStack spacing={2} overflowX="auto" pb={1} flexWrap="wrap">
                {(
                  [
                    {
                      id: 'all',
                      label: 'All',
                      icon: IconLayoutGrid,
                      count: collectionData.all.allCount,
                    },
                    {
                      id: 'reading',
                      label: 'Reading',
                      icon: IconBook,
                      count: collectionData.reading.allCount,
                    },
                    {
                      id: 'listening',
                      label: 'Listening',
                      icon: IconHeadphones,
                      count: collectionData.listening.allCount,
                    },
                    {
                      id: 'writing',
                      label: 'Writing',
                      icon: IconPencil,
                      count: collectionData.writing.allCount,
                    },
                    {
                      id: 'speaking',
                      label: 'Speaking',
                      icon: IconMicrophone,
                      count: collectionData.speaking.allCount,
                    },
                  ] as const
                ).map((tab) => {
                  const isSelected = activeSkillTab === tab.id;
                  return (
                    <Button
                      key={tab.id}
                      onClick={() => {
                        setStatusFilter('all');
                        onNavigateHomeRoute({
                          tab: 'collections',
                          collectionName: selectedCollectionName,
                          skill: tab.id,
                        });
                      }}
                      leftIcon={<Icon as={tab.icon} boxSize={4} />}
                      variant={isSelected ? 'solid' : 'outline'}
                      colorScheme={isSelected ? 'blue' : 'gray'}
                      bg={isSelected ? undefined : cardBg}
                      borderColor={isSelected ? undefined : cardBorder}
                      borderWidth="2px"
                      rounded="xl"
                      fontWeight={700}
                      fontSize="sm"
                      size="sm"
                    >
                      <HStack spacing={1.5}>
                        <Text>{tab.label}</Text>
                        <Badge
                          colorScheme={isSelected ? 'blue' : 'gray'}
                          variant={isSelected ? 'solid' : 'subtle'}
                          rounded="md"
                          px={1.5}
                          fontSize="xs"
                        >
                          {tab.count}
                        </Badge>
                      </HStack>
                    </Button>
                  );
                })}
              </HStack>

              {/* Row 2: All | Not Started | In Progress | Completed */}
              <HStack
                bg={pillBg}
                p={1}
                rounded="xl"
                borderWidth="2px"
                borderColor={cardBorder}
                spacing={1}
                w="fit-content"
                flexWrap="wrap"
              >
                {(
                  [
                    {
                      id: 'all',
                      label: 'All',
                      count: activeStatusCounts.allCount,
                    },
                    {
                      id: 'unstarted',
                      label: 'Not Started',
                      count: activeStatusCounts.unstarted,
                    },
                    {
                      id: 'in_progress',
                      label: 'In Progress',
                      count: activeStatusCounts.inProgress,
                    },
                    {
                      id: 'completed',
                      label: 'Completed',
                      count: activeStatusCounts.completed,
                    },
                  ] as const
                ).map((item) => (
                  <Button
                    key={item.id}
                    size="sm"
                    rounded="lg"
                    fontWeight={700}
                    variant={statusFilter === item.id ? 'solid' : 'ghost'}
                    colorScheme={statusFilter === item.id ? 'blue' : 'gray'}
                    onClick={() => setStatusFilter(item.id)}
                  >
                    {item.label} ({item.count})
                  </Button>
                ))}
              </HStack>

              {/* Filtered Test Cards Grid */}
              {activeSkillTab === 'all' &&
                (collectionData.reading.filtered.length +
                  collectionData.listening.filtered.length +
                  collectionData.writing.filtered.length +
                  collectionData.speaking.filtered.length ===
                0 ? (
                  <Box
                    p={8}
                    bg={cardBg}
                    borderWidth="2px"
                    borderColor={cardBorder}
                    rounded="xl"
                    textAlign="center"
                  >
                    <Text fontSize="sm" color={secondaryColor}>
                      No tests found in this collection.
                    </Text>
                  </Box>
                ) : (
                  <Grid
                    templateColumns="repeat(auto-fill, minmax(min(100%, 280px), 1fr))"
                    gap={4}
                  >
                    {collectionData.reading.filtered.map((test) =>
                      renderExamCard(test)
                    )}
                    {collectionData.listening.filtered.map((test) =>
                      renderExamCard(test)
                    )}
                    {collectionData.writing.filtered.map((test) =>
                      renderWritingCard(test)
                    )}
                    {collectionData.speaking.filtered.map((test) =>
                      renderSpeakingCard(test)
                    )}
                  </Grid>
                ))}

              {activeSkillTab === 'reading' &&
                (collectionData.reading.filtered.length === 0 ? (
                  <Box
                    p={8}
                    bg={cardBg}
                    borderWidth="2px"
                    borderColor={cardBorder}
                    rounded="xl"
                    textAlign="center"
                  >
                    <Text fontSize="sm" color={secondaryColor}>
                      No Reading tests found in this filter.
                    </Text>
                  </Box>
                ) : (
                  <Grid
                    templateColumns="repeat(auto-fill, minmax(min(100%, 280px), 1fr))"
                    gap={4}
                  >
                    {collectionData.reading.filtered.map((test) =>
                      renderExamCard(test)
                    )}
                  </Grid>
                ))}

              {activeSkillTab === 'listening' &&
                (collectionData.listening.filtered.length === 0 ? (
                  <Box
                    p={8}
                    bg={cardBg}
                    borderWidth="2px"
                    borderColor={cardBorder}
                    rounded="xl"
                    textAlign="center"
                  >
                    <Text fontSize="sm" color={secondaryColor}>
                      No Listening tests found in this filter.
                    </Text>
                  </Box>
                ) : (
                  <Grid
                    templateColumns="repeat(auto-fill, minmax(min(100%, 280px), 1fr))"
                    gap={4}
                  >
                    {collectionData.listening.filtered.map((test) =>
                      renderExamCard(test)
                    )}
                  </Grid>
                ))}

              {activeSkillTab === 'writing' &&
                (collectionData.writing.filtered.length === 0 ? (
                  <Box
                    p={8}
                    bg={cardBg}
                    borderWidth="2px"
                    borderColor={cardBorder}
                    rounded="xl"
                    textAlign="center"
                  >
                    <Text fontSize="sm" color={secondaryColor}>
                      No Writing tests found in this filter.
                    </Text>
                  </Box>
                ) : (
                  <Grid
                    templateColumns="repeat(auto-fill, minmax(min(100%, 280px), 1fr))"
                    gap={4}
                  >
                    {collectionData.writing.filtered.map((test) =>
                      renderWritingCard(test)
                    )}
                  </Grid>
                ))}

              {activeSkillTab === 'speaking' &&
                (collectionData.speaking.filtered.length === 0 ? (
                  <Box
                    p={8}
                    bg={cardBg}
                    borderWidth="2px"
                    borderColor={cardBorder}
                    rounded="xl"
                    textAlign="center"
                  >
                    <Text fontSize="sm" color={secondaryColor}>
                      No Speaking tests found in this filter.
                    </Text>
                  </Box>
                ) : (
                  <Grid
                    templateColumns="repeat(auto-fill, minmax(min(100%, 280px), 1fr))"
                    gap={4}
                  >
                    {collectionData.speaking.filtered.map((test) =>
                      renderSpeakingCard(test)
                    )}
                  </Grid>
                ))}
            </Stack>
          ) : (
            /* SCREEN 1: COLLECTIONS FOLDER GRID (Pure Study) */
            <Stack spacing={6}>
              {qLower && globalSearchExams.length > 0 && (
                <Stack spacing={3}>
                  <Heading size="md" fontFamily={outfit.style.fontFamily}>
                    Search Results ({globalSearchExams.length})
                  </Heading>
                  <Grid
                    templateColumns="repeat(auto-fill, minmax(min(100%, 280px), 1fr))"
                    gap={4}
                  >
                    {globalSearchExams.map((test) => renderExamCard(test))}
                  </Grid>
                </Stack>
              )}

              <Stack spacing={0.5}>
                <Heading size="lg" fontFamily={outfit.style.fontFamily}>
                  IELTS Practice Collections
                </Heading>
                <Text fontSize="sm" color={secondaryColor}>
                  Choose a collection to browse all 4 skills and track your progress
                </Text>
              </Stack>

              <Grid
                templateColumns="repeat(auto-fill, minmax(min(100%, 270px), 1fr))"
                gap={4}
              >
                {collections
                  .filter(
                    (c) =>
                      !qLower ||
                      c.name.toLowerCase().includes(qLower) ||
                      (c.description || '').toLowerCase().includes(qLower)
                  )
                  .map((col) => {
                    const colLower = col.name.toLowerCase();
                    const colReading = readingExams.filter(
                      (e) => getExamCollection(e).toLowerCase() === colLower
                    );
                    const colListening = listeningExams.filter(
                      (e) => getExamCollection(e).toLowerCase() === colLower
                    );
                    const colWriting = writingExams.filter(
                      (w) =>
                        (w.collection || 'My Tests').toLowerCase() ===
                        colLower
                    );
                    const colSpeaking = speakingExams.filter(
                      (s) =>
                        (s.collection || 'My Tests').toLowerCase() ===
                        colLower
                    );
                    const totalTests =
                      colReading.length +
                      colListening.length +
                      colWriting.length +
                      colSpeaking.length;

                    let doneCount = 0;
                    let inProgCount = 0;
                    for (const ex of [...colReading, ...colListening]) {
                      const sLabel: CloudIeltsSkill = isListeningExam(ex)
                        ? 'Listening'
                        : 'Reading';
                      if (getAttemptsFor(sLabel, ex.id).length > 0) doneCount++;
                      if (getSavedExamSummary(ex.id)) inProgCount++;
                    }
                    for (const w of colWriting) {
                      if (getAttemptsFor('Writing', w.id).length > 0) doneCount++;
                      if (getSavedWritingSummary(w.id)) inProgCount++;
                    }
                    for (const s of colSpeaking) {
                      if (getAttemptsFor('Speaking', s.id).length > 0) doneCount++;
                      if (loadSpeakingProgress(s.id)) inProgCount++;
                    }

                    return (
                      <GridItem key={col.name}>
                        <Box
                          as="article"
                          h="full"
                          minH="160px"
                          rounded="xl"
                          p="5"
                          bg={cardBg}
                          borderColor={cardBorder}
                          borderWidth="2px"
                          shadow="lg"
                          cursor="pointer"
                          transition="all ease-in-out 150ms"
                          onClick={() => handleOpenCollection(col.name)}
                          _hover={{
                            transform: 'translateY(-2px)',
                            borderBottomColor: 'blue.400',
                          }}
                        >
                          <Flex
                            justify="space-between"
                            direction="column"
                            h="full"
                            gap={4}
                          >
                            <Stack spacing={2}>
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
                              <Text
                                fontSize="sm"
                                color={secondaryColor}
                                noOfLines={2}
                              >
                                {col.description ||
                                  'Official IELTS practice test collection'}
                              </Text>
                            </Stack>

                            <Stack spacing={2}>
                              <HStack spacing={1.5} flexWrap="wrap">
                                {colReading.length > 0 && (
                                  <Badge colorScheme="blue" variant="subtle" rounded="md">
                                    {colReading.length} Reading
                                  </Badge>
                                )}
                                {colListening.length > 0 && (
                                  <Badge colorScheme="purple" variant="subtle" rounded="md">
                                    {colListening.length} Listening
                                  </Badge>
                                )}
                                {colWriting.length > 0 && (
                                  <Badge colorScheme="orange" variant="subtle" rounded="md">
                                    {colWriting.length} Writing
                                  </Badge>
                                )}
                                {colSpeaking.length > 0 && (
                                  <Badge colorScheme="pink" variant="subtle" rounded="md">
                                    {colSpeaking.length} Speaking
                                  </Badge>
                                )}
                                {totalTests === 0 && (
                                  <Badge colorScheme="gray" variant="subtle" rounded="md">
                                    Empty
                                  </Badge>
                                )}
                              </HStack>

                              <HStack justify="space-between" pt={1}>
                                <HStack spacing={2} fontSize="xs" color={secondaryColor}>
                                  {doneCount > 0 && (
                                    <Text color="green.500" fontWeight={600}>
                                      Completed: {doneCount}/{totalTests}
                                    </Text>
                                  )}
                                  {inProgCount > 0 && (
                                    <Text color="emerald.500" fontWeight={600}>
                                      • In progress: {inProgCount}
                                    </Text>
                                  )}
                                  {doneCount === 0 && inProgCount === 0 && (
                                    <Text>
                                      {totalTests} {totalTests === 1 ? 'test' : 'tests'}
                                    </Text>
                                  )}
                                </HStack>
                                <Icon
                                  as={IconArrowRight}
                                  boxSize={4}
                                  color={secondaryColor}
                                />
                              </HStack>
                            </Stack>
                          </Flex>
                        </Box>
                      </GridItem>
                    );
                  })}
              </Grid>
            </Stack>
          )
        ) : primaryTab === 'history' ? (
          /* TAB 2: HISTORY */
          <Stack spacing={5}>
            <Flex
              justify="space-between"
              align={{ base: 'start', md: 'center' }}
              direction={{ base: 'column', md: 'row' }}
              gap={3}
            >
              <Stack spacing={0.5}>
                <Heading size="lg" fontFamily={outfit.style.fontFamily}>
                  Practice History
                </Heading>
                <Text fontSize="sm" color={secondaryColor}>
                  Submitted attempts and in-progress drafts are auto-saved across devices.
                </Text>
              </Stack>
            </Flex>

            {/* History Filter Controls */}
            <Flex
              justify="space-between"
              align={{ base: 'start', md: 'center' }}
              direction={{ base: 'column', md: 'row' }}
              gap={3}
            >
              <HStack spacing={1.5} flexWrap="wrap">
                {(
                  [
                    { id: 'all', label: 'All Skills' },
                    { id: 'reading', label: 'Reading' },
                    { id: 'listening', label: 'Listening' },
                    { id: 'writing', label: 'Writing' },
                    { id: 'speaking', label: 'Speaking' },
                  ] as const
                ).map((item) => (
                  <Button
                    key={item.id}
                    size="xs"
                    rounded="lg"
                    variant={historySkillFilter === item.id ? 'solid' : 'outline'}
                    colorScheme={historySkillFilter === item.id ? 'blue' : 'gray'}
                    onClick={() => setHistorySkillFilter(item.id)}
                  >
                    {item.label}
                  </Button>
                ))}
              </HStack>

              <HStack
                bg={pillBg}
                p={1}
                rounded="xl"
                borderWidth="2px"
                borderColor={cardBorder}
                spacing={1}
              >
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'in_progress', label: 'In Progress' },
                    { id: 'completed', label: 'Completed' },
                  ] as const
                ).map((st) => (
                  <Button
                    key={st.id}
                    size="xs"
                    rounded="lg"
                    fontWeight={700}
                    variant={historyStatusFilter === st.id ? 'solid' : 'ghost'}
                    colorScheme={historyStatusFilter === st.id ? 'blue' : 'gray'}
                    onClick={() => setHistoryStatusFilter(st.id)}
                  >
                    {st.label}
                  </Button>
                ))}
              </HStack>
            </Flex>

            {filteredHistoryEntries.length === 0 ? (
              <Box
                p={10}
                bg={cardBg}
                borderWidth="2px"
                borderColor={cardBorder}
                rounded="2xl"
                textAlign="center"
              >
                <Text fontSize="sm" color={secondaryColor}>
                  No completed or in-progress tests match your current filter.
                </Text>
              </Box>
            ) : (
              <Stack spacing={3}>
                {filteredHistoryEntries.map((entry) => {
                  const skillColor =
                    entry.skill === 'listening'
                      ? 'purple'
                      : entry.skill === 'writing'
                        ? 'orange'
                        : entry.skill === 'speaking'
                          ? 'pink'
                          : 'blue';
                  const latestAttempt = entry.attempts[0];
                  const dateLabel = new Date(
                    entry.latestActivityAt
                  ).toLocaleDateString('en-US', {
                    month: 'short',
                    day: '2-digit',
                    year: 'numeric',
                  });

                  return (
                    <Box
                      key={entry.key}
                      bg={cardBg}
                      borderWidth="2px"
                      borderColor={entry.isInProgress ? 'emerald.400' : cardBorder}
                      rounded="xl"
                      p={4}
                      shadow="sm"
                      cursor={entry.target ? 'pointer' : 'default'}
                      transition="all 150ms"
                      _hover={
                        entry.target
                          ? { borderBottomColor: 'blue.400', transform: 'translateY(-1px)' }
                          : undefined
                      }
                      onClick={() => {
                        if (entry.target) {
                          openTestDetail(entry.skill, entry.examId);
                        }
                      }}
                    >
                      <Flex
                        justify="space-between"
                        align={{ base: 'start', sm: 'center' }}
                        direction={{ base: 'column', sm: 'row' }}
                        gap={3}
                      >
                        <Stack spacing={1.5} minW={0} flex={1}>
                          <HStack spacing={2} flexWrap="wrap">
                            <Badge colorScheme={skillColor} rounded="md" fontSize="xs">
                              {entry.skillLabel}
                            </Badge>
                            <Badge colorScheme="gray" variant="subtle" rounded="md" fontSize="xs">
                              {entry.collection}
                            </Badge>
                            {entry.isInProgress && (
                              <Badge colorScheme="green" rounded="md" fontSize="xs">
                                In Progress
                              </Badge>
                            )}
                            {entry.attempts.length > 0 && (
                              <Badge colorScheme="blue" variant="subtle" rounded="md" fontSize="xs">
                                {entry.attempts.length}{' '}
                                {entry.attempts.length === 1 ? 'attempt' : 'attempts'}
                              </Badge>
                            )}
                          </HStack>

                          <Text fontWeight={700} fontSize="md" noOfLines={1}>
                            {entry.title}
                          </Text>

                          <HStack spacing={3} fontSize="xs" color={secondaryColor} flexWrap="wrap">
                            {entry.inProgressMeta && (
                              <Text color="emerald.500" fontWeight={600}>
                                {entry.inProgressMeta}
                              </Text>
                            )}
                            {latestAttempt && (
                              <Text>
                                Latest:{' '}
                                {latestAttempt.skill === 'Writing'
                                  ? `Task 1 (${latestAttempt.details?.task1Words ?? 0}w) • Task 2 (${latestAttempt.details?.task2Words ?? 0}w)`
                                  : `${latestAttempt.totalCorrect}/${latestAttempt.totalQuestions} Qs`}
                                {entry.bestBand !== null
                                  ? ` • Best: Band ${entry.bestBand.toFixed(1)}`
                                  : ''}
                              </Text>
                            )}
                            <Text>• Updated: {dateLabel}</Text>
                          </HStack>
                        </Stack>

                        <HStack
                          spacing={2}
                          flexShrink={0}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {entry.isInProgress && entry.target && (
                            <Button
                              size="sm"
                              colorScheme="green"
                              rounded="xl"
                              leftIcon={<IconPlayerPlay size={15} />}
                              onClick={() => {
                                if (!entry.target) return;
                                if (entry.target.kind === 'exam') {
                                  onSelectExam(entry.target.exam);
                                } else if (entry.target.kind === 'writing') {
                                  onStartWritingExam(entry.target.exam);
                                } else {
                                  onStartSpeakingExam(entry.target.exam);
                                }
                              }}
                            >
                              Resume
                            </Button>
                          )}

                          {entry.target && (
                            <Button
                              size="sm"
                              variant="outline"
                              colorScheme="blue"
                              rounded="xl"
                              onClick={() => openTestDetail(entry.skill, entry.examId)}
                            >
                              View Details
                            </Button>
                          )}
                        </HStack>
                      </Flex>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Stack>
        ) : (
          /* TAB 3: MANAGE (Dedicated CRUD Studio) */
          <IeltsManageTab
            exams={exams}
            writingExams={writingExams}
            speakingExams={speakingExams}
            collections={collections}
            searchQuery={searchQuery}
            subTab={manageSubTab}
            onSubTabChange={(sub) => onNavigateHomeRoute({ tab: 'manage', subTab: sub })}
            openNewCollectionSignal={(openNewCollectionSignal || 0) + localNewColSignal}
            onSearchQueryChange={(q) => {
              setSearchQuery(q);
              menuEventChannel.emit('ieltsSearchChange', q);
            }}
            onCreateManualExam={(defaultCol, defaultSkill) =>
              onOpenEditor(null, defaultCol, defaultSkill)
            }
            onOpenSmartImport={(col, skill) => onOpenSmartImport(col, skill)}
            onPreviewTest={(row) =>
              openTestDetail(row.skill.toLowerCase() as IeltsSkillSlug, row.id)
            }
            onEditExam={(exam) => onOpenEditor(exam)}
            onEditWriting={(exam, defaultCol) => onEditWriting(exam, defaultCol)}
            onEditSpeaking={(exam, defaultCol) => onEditSpeaking(exam, defaultCol)}
            onRefreshAll={refreshAll}
            onCloudSaveExam={(payload) =>
              onCloudSaveExam?.(
                payload.skill,
                payload.examId,
                payload.title,
                payload.collection,
                payload.data
              )
            }
            onCloudDeleteExam={onCloudDeleteExam}
            onCloudCreateCollection={onCloudCreateCollection}
            onCloudRenameCollection={onCloudRenameCollection}
            onCloudDeleteCollection={onCloudDeleteCollection}
            onCloudBulkDeleteExams={onCloudBulkDeleteExams}
            onCloudBulkMoveExams={onCloudBulkMoveExams}
            onCloudRestoreDefaults={onCloudRestoreDefaults}
          />
        )}
      </Stack>
    </Container>
  );
};
