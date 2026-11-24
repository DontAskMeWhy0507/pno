import dynamic from 'next/dynamic';
import React, { useCallback, useMemo, useState, useEffect, type FC } from 'react';
import { outfit } from '@quenti/lib/chakra-theme';
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
  Stack,
  Text,
  Textarea,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import {
  IconArrowLeft,
  IconArrowRight,
  IconBook,
  IconCheck,
  IconDotsVertical,
  IconEdit,
  IconFolder,
  IconHeadphones,
  IconHistory,
  IconLayoutGrid,
  IconMicrophone,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconRotateClockwise,
  IconTrash,
  IconX,
} from '@tabler/icons-react';

import { menuEventChannel } from '../../../../events/menu';
import { MenuOption } from '../../../../components/menu-option';
import type { Exam } from '../../types/exam';
import type { WritingExam } from '../../types/writing';
import type { SpeakingExam } from '../../types/speaking';
import {
  getAllWritingExams,
  saveWritingExam,
  deleteWritingExam,
} from '../../data/writingExams';
import {
  getAllSpeakingExams,
  saveSpeakingExam,
  deleteSpeakingExam,
} from '../../data/speakingExams';
import {
  deleteExam,
  getAllCollections,
  getExamCollection,
  getExamPartCount,
  getExamQuestionCount,
  createCollection,
  deleteCollection,
  isListeningExam,
} from '../../utils/storage';
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

const WritingEditorModal = dynamic(
  () =>
    import('../admin/WritingEditorModal').then((mod) => mod.WritingEditorModal),
  { ssr: false }
);
const SpeakingEditorModal = dynamic(
  () =>
    import('../admin/SpeakingEditorModal').then(
      (mod) => mod.SpeakingEditorModal
    ),
  { ssr: false }
);

interface HomePageProps {
  exams: Exam[];
  recentAttempts?: CloudAttemptRow[];
  syncStatus?: 'synced' | 'saving' | 'offline';
  onSelectExam: (exam: Exam, options?: StartExamOptions) => void;
  onOpenEditor: (exam?: Exam | null) => void;
  onOpenTestManager: () => void;
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
  onCloudDeleteCollection?: (
    name: string,
    examsToTombstone: Array<{ examId: string; skill: CloudIeltsSkill }>
  ) => void;
  onCloudClearProgress?: (skill: CloudIeltsSkill, examId: string) => void;
}

type PrimaryTab = 'collections' | 'history';
type SkillTab = 'reading' | 'listening' | 'writing' | 'speaking';
type StatusFilter = 'all' | 'unstarted' | 'in_progress' | 'completed';
type HistorySkillFilter = 'all' | SkillTab;
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
  isCustom?: boolean;
  onOpenDetail: () => void;
  onQuickStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
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
  isCustom,
  onOpenDetail,
  onQuickStart,
  onEdit,
  onDelete,
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
                {statusBadgeLabel || 'Đang làm'}
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
                  : `${attemptCount} lượt`}
              </Badge>
            ) : isCustom ? (
              <Badge
                colorScheme="purple"
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
                  <Text>{attemptCount} lượt</Text>
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
                  label={statusType === 'in_progress' ? 'Tiếp tục làm' : 'Xem chi tiết'}
                  fontSize="sm"
                  py="6px"
                  onClick={statusType === 'in_progress' ? onQuickStart : onOpenDetail}
                />
                <MenuOption
                  icon={<IconEdit size={16} />}
                  label="Chỉnh sửa đề"
                  fontSize="sm"
                  py="6px"
                  onClick={onEdit}
                />
                {onDiscardProgress && (
                  <MenuOption
                    icon={<IconRotateClockwise size={16} />}
                    label="Bỏ bản đang làm"
                    fontSize="sm"
                    py="6px"
                    onClick={onDiscardProgress}
                  />
                )}
                <MenuOption
                  icon={<IconTrash size={16} />}
                  label="Xoá bài thi"
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

interface HistoryEntry {
  key: string;
  examId: string;
  title: string;
  collection: string;
  skill: SkillTab;
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
  onSelectExam,
  onOpenEditor,
  onOpenTestManager,
  onOpenSmartImport,
  onRefreshExams,
  onStartWritingExam,
  onStartSpeakingExam,
  onViewAttemptDetail,
  onDeleteAttempt,
  onCloudSaveExam,
  onCloudDeleteExam,
  onCloudCreateCollection,
  onCloudDeleteCollection,
  onCloudClearProgress,
}) => {
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('collections');
  const [selectedCollectionName, setSelectedCollectionName] = useState<string | null>(null);
  const [activeSkillTab, setActiveSkillTab] = useState<SkillTab>('reading');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [historySkillFilter, setHistorySkillFilter] = useState<HistorySkillFilter>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>('all');
  const [selectedTestTarget, setSelectedTestTarget] = useState<DetailTarget | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [progressVersion, setProgressVersion] = useState(0);

  const [writingExams, setWritingExams] = useState<WritingExam[]>(() =>
    getAllWritingExams()
  );
  const [speakingExams, setSpeakingExams] = useState<SpeakingExam[]>(() =>
    getAllSpeakingExams()
  );

  const [isWritingEditorOpen, setIsWritingEditorOpen] = useState(false);
  const [editingWritingExam, setEditingWritingExam] = useState<WritingExam | null>(null);
  const [isSpeakingEditorOpen, setIsSpeakingEditorOpen] = useState(false);
  const [editingSpeakingExam, setEditingSpeakingExam] = useState<SpeakingExam | null>(null);

  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const secondaryColor = useColorModeValue('gray.600', 'gray.400');
  const pillBg = useColorModeValue('gray.100', 'gray.750');

  useEffect(() => {
    setWritingExams(getAllWritingExams());
    setSpeakingExams(getAllSpeakingExams());
  }, [exams]);

  // Listen to unified PNO Navbar events
  useEffect(() => {
    const handleAddTest = () =>
      onOpenSmartImport(selectedCollectionName ?? undefined, activeSkillTab);
    const handleTestBank = () => onOpenTestManager();
    const handleNewCol = () => setShowNewCollectionModal(true);
    const handleSearch = (q: string) => setSearchQuery(q);

    menuEventChannel.on('openIeltsAddTest', handleAddTest);
    menuEventChannel.on('openIeltsTestBank', handleTestBank);
    menuEventChannel.on('openIeltsNewCollection', handleNewCol);
    menuEventChannel.on('ieltsSearchChange', handleSearch);

    return () => {
      menuEventChannel.off('openIeltsAddTest', handleAddTest);
      menuEventChannel.off('openIeltsTestBank', handleTestBank);
      menuEventChannel.off('openIeltsNewCollection', handleNewCol);
      menuEventChannel.off('ieltsSearchChange', handleSearch);
    };
  }, [activeSkillTab, onOpenSmartImport, onOpenTestManager, selectedCollectionName]);

  const refreshWriting = () => setWritingExams(getAllWritingExams());
  const refreshSpeaking = () => setSpeakingExams(getAllSpeakingExams());

  // Combine collections from Reading/Listening + Writing + Speaking
  const collections = useMemo(() => {
    const base = getAllCollections();
    const map = new Map<
      string,
      { id: string; name: string; description?: string; isBuiltin?: boolean }
    >();
    for (const c of base) {
      map.set(c.name.toLowerCase(), c);
    }
    for (const ex of exams) {
      const colName = getExamCollection(ex).trim();
      if (!map.has(colName.toLowerCase())) {
        map.set(colName.toLowerCase(), {
          id: `col_e_${colName.toLowerCase()}`,
          name: colName,
          description: `${colName} Collection`,
          isBuiltin: false,
        });
      }
    }
    for (const w of writingExams) {
      const colName = (w.collection || 'IELTS Writing').trim();
      if (!map.has(colName.toLowerCase())) {
        map.set(colName.toLowerCase(), {
          id: `col_w_${colName.toLowerCase()}`,
          name: colName,
          description: `${colName} Collection`,
          isBuiltin: false,
        });
      }
    }
    for (const s of speakingExams) {
      const colName = (s.collection || 'IELTS Speaking').trim();
      if (!map.has(colName.toLowerCase())) {
        map.set(colName.toLowerCase(), {
          id: `col_s_${colName.toLowerCase()}`,
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
  const handleSaveWriting = (examToSave: WritingExam) => {
    saveWritingExam(examToSave);
    onCloudSaveExam?.(
      'Writing',
      examToSave.id,
      examToSave.title,
      examToSave.collection || 'My Tests',
      examToSave as unknown as Record<string, unknown>
    );
    setIsWritingEditorOpen(false);
    setEditingWritingExam(null);
    refreshWriting();
    toast({
      title: 'Writing test saved',
      status: 'success',
      duration: 2200,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  const handleSaveSpeaking = (examToSave: SpeakingExam) => {
    saveSpeakingExam(examToSave);
    onCloudSaveExam?.(
      'Speaking',
      examToSave.id,
      examToSave.title,
      examToSave.collection || 'My Tests',
      examToSave as unknown as Record<string, unknown>
    );
    setIsSpeakingEditorOpen(false);
    setEditingSpeakingExam(null);
    refreshSpeaking();
    toast({
      title: 'Speaking test saved',
      status: 'success',
      duration: 2200,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  const handleDeleteExam = (exam: Exam) => {
    deleteExam(exam.id);
    onCloudDeleteExam?.(
      isListeningExam(exam) ? 'Listening' : 'Reading',
      exam.id
    );
    if (selectedTestTarget?.kind === 'exam' && selectedTestTarget.exam.id === exam.id) {
      setSelectedTestTarget(null);
    }
    onRefreshExams();
    toast({
      title: 'Đã xoá bài thi',
      description: `Đã xoá "${exam.title}".`,
      status: 'info',
      duration: 2200,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  const handleDeleteWritingExam = (id: string, title: string) => {
    deleteWritingExam(id);
    onCloudDeleteExam?.('Writing', id);
    if (selectedTestTarget?.kind === 'writing' && selectedTestTarget.exam.id === id) {
      setSelectedTestTarget(null);
    }
    refreshWriting();
    toast({
      title: 'Đã xoá bài Writing',
      description: `Đã xoá "${title}".`,
      status: 'info',
      duration: 2200,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  const handleDeleteSpeakingExam = (id: string, title: string) => {
    deleteSpeakingExam(id);
    onCloudDeleteExam?.('Speaking', id);
    if (selectedTestTarget?.kind === 'speaking' && selectedTestTarget.exam.id === id) {
      setSelectedTestTarget(null);
    }
    refreshSpeaking();
    toast({
      title: 'Đã xoá bài Speaking',
      description: `Đã xoá "${title}".`,
      status: 'info',
      duration: 2200,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  const handleDiscardExam = (exam: Exam) => {
    clearExamProgress(exam.id);
    onCloudClearProgress?.(
      isListeningExam(exam) ? 'Listening' : 'Reading',
      exam.id
    );
    setProgressVersion((v) => v + 1);
    toast({
      title: 'Đã bỏ bản làm dở',
      description: `"${exam.title}" đã sẵn sàng làm mới.`,
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
      title: 'Đã bỏ bản nháp Writing',
      description: `"${title}" đã được đặt lại.`,
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
      title: 'Đã đặt lại phiên Speaking',
      description: `"${title}" đã được đặt lại.`,
      status: 'info',
      duration: 2000,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    const created = createCollection(
      newCollectionName.trim(),
      newCollectionDesc.trim()
    );
    onCloudCreateCollection?.(created);
    setNewCollectionName('');
    setNewCollectionDesc('');
    setShowNewCollectionModal(false);
    onRefreshExams();
    toast({
      title: 'Đã tạo bộ đề mới',
      status: 'success',
      duration: 2200,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  const handleDeleteCollection = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    const examsToTombstone = exams
      .filter((ex) => getExamCollection(ex).toLowerCase() === name.trim().toLowerCase())
      .map((ex) => ({
        examId: ex.id,
        skill: (isListeningExam(ex) ? 'Listening' : 'Reading') as CloudIeltsSkill,
      }));
    deleteCollection(name);
    onCloudDeleteCollection?.(name, examsToTombstone);
    if (selectedCollectionName === name) setSelectedCollectionName(null);
    onRefreshExams();
    toast({
      title: 'Đã xoá bộ đề',
      description: `Đã xoá "${name}".`,
      status: 'info',
      duration: 2200,
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
      const skill: SkillTab = isListen ? 'listening' : 'reading';
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
          ? `${saved.answeredCount}/${totalQ} câu • Còn ${Math.ceil(saved.timeRemaining / 60)} phút`
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
        collection: w.collection || 'IELTS Writing',
        skill: 'writing',
        skillLabel: 'Writing',
        isInProgress: Boolean(saved),
        inProgressMeta: saved
          ? `Task 1: ${saved.task1Words} từ • Task 2: ${saved.task2Words} từ`
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
        collection: s.collection || 'IELTS Speaking',
        skill: 'speaking',
        skillLabel: 'Speaking',
        isInProgress: Boolean(saved),
        inProgressMeta: saved ? `Đang ở Part ${saved.activePart}` : undefined,
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
      const skill = first.skill.toLowerCase() as SkillTab;
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

  // Helper to select a collection and pick its first non-empty skill tab
  const handleOpenCollection = (colName: string) => {
    const colLower = colName.toLowerCase();
    const rCount = readingExams.filter(
      (e) => getExamCollection(e).toLowerCase() === colLower
    ).length;
    const lCount = listeningExams.filter(
      (e) => getExamCollection(e).toLowerCase() === colLower
    ).length;
    const wCount = writingExams.filter(
      (w) => (w.collection || 'IELTS Writing').toLowerCase() === colLower
    ).length;
    const sCount = speakingExams.filter(
      (s) => (s.collection || 'IELTS Speaking').toLowerCase() === colLower
    ).length;

    let initialSkill: SkillTab = 'reading';
    if (rCount > 0) initialSkill = 'reading';
    else if (lCount > 0) initialSkill = 'listening';
    else if (wCount > 0) initialSkill = 'writing';
    else if (sCount > 0) initialSkill = 'speaking';

    setSelectedCollectionName(colName);
    setActiveSkillTab(initialSkill);
    setStatusFilter('all');
    setSelectedTestTarget(null);
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
      ? `Còn ${Math.ceil(savedProgress.timeRemaining / 60)} phút`
      : `${test.durationMinutes || (isListen ? 30 : 60)} phút`;

    return (
      <GridItem key={`${test.id}-${progressVersion}`}>
        <UnifiedIeltsCard
          title={test.title}
          collectionName={colName}
          metaText={`${mins} • ${totalParts} ${
            isListen ? 'Sections' : 'Parts'
          } • ${totalQ} câu`}
          skillColor={isListen ? 'purple.400' : 'blue.400'}
          skillBadgeLabel={skillLabel}
          skillIcon={isListen ? IconHeadphones : IconBook}
          statusType={statusType}
          statusBadgeLabel={
            savedProgress
              ? `Đang làm (${savedProgress.answeredCount}/${totalQ})`
              : undefined
          }
          attemptCount={attempts.length}
          bestBand={bestBand}
          isCustom={test.isBuiltin === false || colName === 'My Tests'}
          onOpenDetail={() => setSelectedTestTarget({ kind: 'exam', exam: test })}
          onQuickStart={() => onSelectExam(test)}
          onEdit={() => onOpenEditor(test)}
          onDelete={() => handleDeleteExam(test)}
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
          collectionName={test.collection || 'IELTS Writing'}
          metaText={
            savedW
              ? `Còn ${Math.ceil(savedW.timeRemaining / 60)} phút • T1: ${savedW.task1Words}w • T2: ${savedW.task2Words}w`
              : `${test.durationMinutes} phút • Task 1 & Task 2`
          }
          subText={test.task2.prompt}
          skillColor="orange.400"
          skillBadgeLabel="Writing"
          skillIcon={IconPencil}
          statusType={statusType}
          statusBadgeLabel="Đang làm"
          attemptCount={attempts.length}
          onOpenDetail={() => setSelectedTestTarget({ kind: 'writing', exam: test })}
          onQuickStart={() => onStartWritingExam(test)}
          onEdit={() => {
            setEditingWritingExam(test);
            setIsWritingEditorOpen(true);
          }}
          onDelete={() => handleDeleteWritingExam(test.id, test.title)}
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
          collectionName={test.collection || 'IELTS Speaking'}
          metaText={`Part 1 (${test.part1Questions.length} Qs) • Part 2 • Part 3 (${test.part3Questions.length} Qs)`}
          subText={`Cue Card: "${test.part2Question.questionText}"`}
          skillColor="pink.400"
          skillBadgeLabel="Speaking"
          skillIcon={IconMicrophone}
          statusType={statusType}
          statusBadgeLabel="Đang làm"
          attemptCount={attempts.length}
          onOpenDetail={() => setSelectedTestTarget({ kind: 'speaking', exam: test })}
          onQuickStart={() => onStartSpeakingExam(test)}
          onEdit={() => {
            setEditingSpeakingExam(test);
            setIsSpeakingEditorOpen(true);
          }}
          onDelete={() => handleDeleteSpeakingExam(test.id, test.title)}
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
      (w) => (w.collection || 'IELTS Writing').toLowerCase() === colLower
    );
    const sAll = speakingExams.filter(
      (s) => (s.collection || 'IELTS Speaking').toLowerCase() === colLower
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

    return {
      reading: getCountsForRL(rAll, 'Reading'),
      listening: getCountsForRL(lAll, 'Listening'),
      writing: getCountsForWriting(wAll),
      speaking: getCountsForSpeaking(sAll),
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

  // Global search results when on root Bộ đề view
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

  return (
    <Container maxW="7xl" py={{ base: 4, md: 6 }} flex="1">
      <Stack spacing={6}>
        {/* TOP PRIMARY TABS: Bộ đề | History */}
        <Flex
          justify="space-between"
          align={{ base: 'stretch', sm: 'center' }}
          direction={{ base: 'column', sm: 'row' }}
          gap={3}
        >
          <HStack spacing={2}>
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
              onClick={() => {
                setPrimaryTab('collections');
                setSelectedTestTarget(null);
              }}
            >
              <HStack spacing={2}>
                <Text>Bộ đề</Text>
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
              onClick={() => {
                setPrimaryTab('history');
                setSelectedTestTarget(null);
              }}
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
                ? 'Đang lưu nền...'
                : syncStatus === 'offline'
                  ? 'Lưu cục bộ (Offline)'
                  : 'Tự động lưu nền'}
            </Badge>
          </HStack>
        </Flex>

        {/* Active Search Filter Notice */}
        {searchQuery.trim() && !selectedTestTarget && (
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
              Tìm kiếm: &ldquo;{searchQuery}&rdquo;
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
              Xoá bộ lọc
            </Button>
          </HStack>
        )}

        {/* SCREEN 3: TEST DETAIL VIEW (Study4-inspired layout) */}
        {selectedTestTarget ? (
          <TestDetailView
            target={selectedTestTarget}
            progressVersion={progressVersion}
            attempts={
              selectedTestTarget.kind === 'exam'
                ? getAttemptsFor(
                    isListeningExam(selectedTestTarget.exam)
                      ? 'Listening'
                      : 'Reading',
                    selectedTestTarget.exam.id
                  )
                : selectedTestTarget.kind === 'writing'
                  ? getAttemptsFor('Writing', selectedTestTarget.exam.id)
                  : getAttemptsFor('Speaking', selectedTestTarget.exam.id)
            }
            onBack={() => setSelectedTestTarget(null)}
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
            onOpenEditor={() => {
              if (selectedTestTarget.kind === 'exam') {
                onOpenEditor(selectedTestTarget.exam);
              } else if (selectedTestTarget.kind === 'writing') {
                setEditingWritingExam(selectedTestTarget.exam);
                setIsWritingEditorOpen(true);
              } else {
                setEditingSpeakingExam(selectedTestTarget.exam);
                setIsSpeakingEditorOpen(true);
              }
            }}
          />
        ) : primaryTab === 'collections' ? (
          /* TAB 1: BỘ ĐỀ */
          selectedCollectionName && collectionData ? (
            /* SCREEN 2: INSIDE A COLLECTION (2 rows of tabs) */
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
                      setSelectedCollectionName(null);
                      setStatusFilter('all');
                    }}
                  >
                    Tất cả bộ đề
                  </Button>
                  <Heading size="lg" fontFamily={outfit.style.fontFamily}>
                    {selectedCollectionName}
                  </Heading>
                </HStack>

                <Button
                  size="sm"
                  colorScheme="blue"
                  rounded="xl"
                  leftIcon={<IconPlus size={16} />}
                  onClick={() => {
                    if (activeSkillTab === 'writing') {
                      setEditingWritingExam(null);
                      setIsWritingEditorOpen(true);
                    } else if (activeSkillTab === 'speaking') {
                      setEditingSpeakingExam(null);
                      setIsSpeakingEditorOpen(true);
                    } else {
                      onOpenSmartImport(selectedCollectionName, activeSkillTab);
                    }
                  }}
                >
                  Thêm đề vào {selectedCollectionName}
                </Button>
              </Flex>

              {/* Row 1: Reading | Listening | Writing | Speaking */}
              <HStack spacing={2} overflowX="auto" pb={1} flexWrap="wrap">
                {(
                  [
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
                        setActiveSkillTab(tab.id);
                        setStatusFilter('all');
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

              {/* Row 2: Tất cả | Chưa làm | Đang làm | Đã làm */}
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
                      label: 'Tất cả',
                      count: activeStatusCounts.allCount,
                    },
                    {
                      id: 'unstarted',
                      label: 'Chưa làm',
                      count: activeStatusCounts.unstarted,
                    },
                    {
                      id: 'in_progress',
                      label: 'Đang làm',
                      count: activeStatusCounts.inProgress,
                    },
                    {
                      id: 'completed',
                      label: 'Đã làm',
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
                      Không có bài Reading nào trong mục này.
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
                      Không có bài Listening nào trong mục này.
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
                      Không có bài Writing nào trong mục này.
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
                      Không có bài Speaking nào trong mục này.
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
            /* SCREEN 1: COLLECTIONS FOLDER GRID */
            <Stack spacing={6}>
              {qLower && globalSearchExams.length > 0 && (
                <Stack spacing={3}>
                  <Heading size="md" fontFamily={outfit.style.fontFamily}>
                    Kết quả tìm kiếm ({globalSearchExams.length})
                  </Heading>
                  <Grid
                    templateColumns="repeat(auto-fill, minmax(min(100%, 280px), 1fr))"
                    gap={4}
                  >
                    {globalSearchExams.map((test) => renderExamCard(test))}
                  </Grid>
                </Stack>
              )}

              <Flex justify="space-between" align="center" flexWrap="wrap" gap={3}>
                <Stack spacing={0.5}>
                  <Heading size="lg" fontFamily={outfit.style.fontFamily}>
                    Bộ đề luyện thi IELTS
                  </Heading>
                  <Text fontSize="sm" color={secondaryColor}>
                    Chọn một bộ đề để xem đầy đủ bài thi 4 kỹ năng và lọc theo trạng thái làm bài
                  </Text>
                </Stack>

                <Button
                  size="sm"
                  variant="outline"
                  rounded="xl"
                  leftIcon={<IconPlus size={16} />}
                  onClick={() => setShowNewCollectionModal(true)}
                >
                  Tạo bộ đề mới
                </Button>
              </Flex>

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
                        (w.collection || 'IELTS Writing').toLowerCase() ===
                        colLower
                    );
                    const colSpeaking = speakingExams.filter(
                      (s) =>
                        (s.collection || 'IELTS Speaking').toLowerCase() ===
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
                                  'Bộ đề luyện thi IELTS tổng hợp'}
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
                                    Trống
                                  </Badge>
                                )}
                              </HStack>

                              <HStack justify="space-between" pt={1}>
                                <HStack spacing={2} fontSize="xs" color={secondaryColor}>
                                  {doneCount > 0 && (
                                    <Text color="green.500" fontWeight={600}>
                                      Đã làm: {doneCount}/{totalTests}
                                    </Text>
                                  )}
                                  {inProgCount > 0 && (
                                    <Text color="emerald.500" fontWeight={600}>
                                      • Đang làm: {inProgCount}
                                    </Text>
                                  )}
                                  {doneCount === 0 && inProgCount === 0 && (
                                    <Text>{totalTests} bài thi</Text>
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
        ) : (
          /* SCREEN 4: TAB HISTORY (Đã làm & Đang làm, hỗ trợ nhiều lượt) */
          <Stack spacing={5}>
            <Flex
              justify="space-between"
              align={{ base: 'start', md: 'center' }}
              direction={{ base: 'column', md: 'row' }}
              gap={3}
            >
              <Stack spacing={0.5}>
                <Heading size="lg" fontFamily={outfit.style.fontFamily}>
                  Lịch sử làm bài
                </Heading>
                <Text fontSize="sm" color={secondaryColor}>
                  Các bài đã nộp và đang làm dở được tự động lưu nền. Một bài có thể xem nhiều lượt làm.
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
                    { id: 'all', label: 'Tất cả kỹ năng' },
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
                    { id: 'all', label: 'Tất cả' },
                    { id: 'in_progress', label: 'Đang làm' },
                    { id: 'completed', label: 'Đã làm' },
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
                  Chưa có bài thi nào đã làm hoặc đang làm dở phù hợp bộ lọc.
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
                  ).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
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
                          setSelectedTestTarget(entry.target);
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
                                Đang làm dở
                              </Badge>
                            )}
                            {entry.attempts.length > 0 && (
                              <Badge colorScheme="blue" variant="subtle" rounded="md" fontSize="xs">
                                {entry.attempts.length} lượt đã nộp
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
                                Gần nhất:{' '}
                                {latestAttempt.skill === 'Writing'
                                  ? `Task 1 (${latestAttempt.details?.task1Words ?? 0}w) • Task 2 (${latestAttempt.details?.task2Words ?? 0}w)`
                                  : `${latestAttempt.totalCorrect}/${latestAttempt.totalQuestions} câu`}
                                {entry.bestBand !== null
                                  ? ` • Cao nhất: Band ${entry.bestBand.toFixed(1)}`
                                  : ''}
                              </Text>
                            )}
                            <Text>• Cập nhật: {dateLabel}</Text>
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
                              Tiếp tục
                            </Button>
                          )}

                          {entry.target && (
                            <Button
                              size="sm"
                              variant="outline"
                              colorScheme="blue"
                              rounded="xl"
                              onClick={() => setSelectedTestTarget(entry.target)}
                            >
                              Xem chi tiết
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
              Tạo bộ đề mới
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Stack spacing={4}>
                <Box>
                  <Text fontSize="xs" fontWeight={700} mb={1}>
                    Tên bộ đề (ví dụ: Cambridge 20, Vol 11...)
                  </Text>
                  <Input
                    required
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="Nhập tên bộ đề..."
                    rounded="xl"
                  />
                </Box>
                <Box>
                  <Text fontSize="xs" fontWeight={700} mb={1}>
                    Mô tả ngắn (Tuỳ chọn)
                  </Text>
                  <Textarea
                    value={newCollectionDesc}
                    onChange={(e) => setNewCollectionDesc(e.target.value)}
                    placeholder="Ghi chú về bộ đề này..."
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
                Huỷ
              </Button>
              <Button type="submit" colorScheme="blue" rounded="xl">
                Tạo bộ đề
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Writing & Speaking Editor Modals */}
      {isWritingEditorOpen && (
        <WritingEditorModal
          key={editingWritingExam?.id || 'new-writing'}
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
          key={editingSpeakingExam?.id || 'new-speaking'}
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
