import React, { useMemo, useRef, useState, type FC } from 'react';
import { outfit } from '@pno/lib/chakra-theme';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  Grid,
  GridItem,
  HStack,
  Heading,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Text,
  Textarea,
  Tooltip,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import {
  IconBook,
  IconChevronDown,
  IconCopy,
  IconDownload,
  IconEdit,
  IconFolder,
  IconFolderPlus,
  IconHeadphones,
  IconMicrophone,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSparkles,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';

import type { Exam } from '../../types/exam';
import type { WritingExam } from '../../types/writing';
import type { SpeakingExam } from '../../types/speaking';
import type { CloudIeltsSkill } from '../../utils/cloudSync';
import {
  createCollection,
  deleteCollection,
  deleteExam,
  exportExamAsJSON,
  getExamCollection,
  getExamPartCount,
  getExamQuestionCount,
  importExamFromJSON,
  isListeningExam,
  loadFullExam,
  renameCollection,
  restoreDefaultExamsAndCollections,
  saveExam,
} from '../../utils/storage';
import {
  deleteWritingExam,
  restoreDefaultWritingExams,
  saveWritingExam,
} from '../../data/writingExams';
import {
  deleteSpeakingExam,
  restoreDefaultSpeakingExams,
  saveSpeakingExam,
} from '../../data/speakingExams';

export interface CollectionItem {
  id: string;
  name: string;
  description?: string;
  isBuiltin?: boolean;
}

export interface CloudExamPayload {
  examId: string;
  skill: CloudIeltsSkill;
  title: string;
  collection: string;
  data: Record<string, unknown>;
}

interface UnifiedTestRow {
  key: string;
  id: string;
  title: string;
  skill: CloudIeltsSkill;
  collection: string;
  meta: string;
  updatedAt: number;
  rawExam?: Exam;
  rawWriting?: WritingExam;
  rawSpeaking?: SpeakingExam;
}

type ConfirmActionState =
  | { type: 'delete_test'; row: UnifiedTestRow }
  | { type: 'bulk_delete'; rows: UnifiedTestRow[] }
  | { type: 'delete_collection'; name: string; totalCount: number; rows: UnifiedTestRow[] }
  | { type: 'restore_defaults' }
  | null;

interface IeltsManageTabProps {
  exams: Exam[];
  writingExams: WritingExam[];
  speakingExams: SpeakingExam[];
  collections: CollectionItem[];
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onCreateManualExam: (defaultCollection?: string, defaultSkill?: 'reading' | 'listening') => void;
  onOpenSmartImport: (
    collection?: string,
    skill?: 'reading' | 'listening' | 'writing' | 'speaking'
  ) => void;
  onEditExam: (exam: Exam) => void;
  onEditWriting: (exam?: WritingExam | null, defaultCollection?: string) => void;
  onEditSpeaking: (exam?: SpeakingExam | null, defaultCollection?: string) => void;
  onRefreshAll: () => void;
  onCloudSaveExam?: (payload: CloudExamPayload) => void;
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
    examsToTombstone: { examId: string; skill: CloudIeltsSkill }[]
  ) => void;
  onCloudBulkDeleteExams?: (items: { examId: string; skill: CloudIeltsSkill }[]) => void;
  onCloudBulkMoveExams?: (targetCollection: string, items: CloudExamPayload[]) => void;
  onCloudRestoreDefaults?: () => void;
}

export const IeltsManageTab: FC<IeltsManageTabProps> = ({
  exams,
  writingExams,
  speakingExams,
  collections,
  searchQuery,
  onSearchQueryChange,
  onCreateManualExam,
  onOpenSmartImport,
  onEditExam,
  onEditWriting,
  onEditSpeaking,
  onRefreshAll,
  onCloudSaveExam,
  onCloudDeleteExam,
  onCloudCreateCollection,
  onCloudRenameCollection,
  onCloudDeleteCollection,
  onCloudBulkDeleteExams,
  onCloudBulkMoveExams,
  onCloudRestoreDefaults,
}) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelConfirmRef = useRef<HTMLButtonElement>(null);

  const [subTab, setSubTab] = useState<'tests' | 'collections'>('tests');
  const [skillFilter, setSkillFilter] = useState<'all' | CloudIeltsSkill>('all');
  const [collectionFilter, setCollectionFilter] = useState<string>('all');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [bulkMoveTarget, setBulkMoveTarget] = useState<string>('');
  const [isBusy, setIsBusy] = useState(false);

  // Collection Modal (Create or Edit)
  const [colModalMode, setColModalMode] = useState<'create' | 'edit' | null>(null);
  const [colEditOldName, setColEditOldName] = useState('');
  const [colFormName, setColFormName] = useState('');
  const [colFormDesc, setColFormDesc] = useState('');

  // Confirmation AlertDialog
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const subtleBg = useColorModeValue('gray.50', 'gray.900');
  const pillBg = useColorModeValue('gray.100', 'gray.800');
  const secondaryColor = useColorModeValue('gray.600', 'gray.400');
  const bulkBg = useColorModeValue('blue.50', 'blue.900');
  const bulkBorder = useColorModeValue('blue.200', 'blue.700');

  // Build unified list of tests across all 4 skills
  const allRows = useMemo<UnifiedTestRow[]>(() => {
    const rows: UnifiedTestRow[] = [];

    for (const ex of exams) {
      const isListen = isListeningExam(ex);
      const skill: CloudIeltsSkill = isListen ? 'Listening' : 'Reading';
      const parts = getExamPartCount(ex);
      const qs = getExamQuestionCount(ex);
      rows.push({
        key: `${skill}:${ex.id}`,
        id: ex.id,
        title: ex.title,
        skill,
        collection: getExamCollection(ex),
        meta: `${ex.durationMinutes || (isListen ? 30 : 60)} min • ${parts} ${isListen ? 'Sections' : 'Parts'} • ${qs} Qs`,
        updatedAt: ex.updatedAt || ex.createdAt || 0,
        rawExam: ex,
      });
    }

    for (const w of writingExams) {
      rows.push({
        key: `Writing:${w.id}`,
        id: w.id,
        title: w.title,
        skill: 'Writing',
        collection: w.collection || 'My Tests',
        meta: `${w.durationMinutes || 60} min • Task 1 & Task 2`,
        updatedAt: w.updatedAt || w.createdAt || 0,
        rawWriting: w,
      });
    }

    for (const s of speakingExams) {
      rows.push({
        key: `Speaking:${s.id}`,
        id: s.id,
        title: s.title,
        skill: 'Speaking',
        collection: s.collection || 'My Tests',
        meta: `Part 1 (${s.part1Questions.length} Qs) • Part 2 • Part 3 (${s.part3Questions.length} Qs)`,
        updatedAt: s.updatedAt || s.createdAt || 0,
        rawSpeaking: s,
      });
    }

    return rows;
  }, [exams, writingExams, speakingExams]);

  const skillCounts = useMemo(() => {
    const counts = { all: allRows.length, Reading: 0, Listening: 0, Writing: 0, Speaking: 0 };
    for (const r of allRows) {
      counts[r.skill]++;
    }
    return counts;
  }, [allRows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRows.filter((row) => {
      if (skillFilter !== 'all' && row.skill !== skillFilter) return false;
      if (
        collectionFilter !== 'all' &&
        row.collection.toLowerCase() !== collectionFilter.toLowerCase()
      ) {
        return false;
      }
      if (q && !row.title.toLowerCase().includes(q) && !row.collection.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [allRows, skillFilter, collectionFilter, searchQuery]);

  const selectedRows = useMemo(
    () => allRows.filter((r) => selectedKeys.has(r.key)),
    [allRows, selectedKeys]
  );

  const allFilteredSelected =
    filteredRows.length > 0 && filteredRows.every((r) => selectedKeys.has(r.key));

  const toggleRowSelection = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const r of filteredRows) next.delete(r.key);
        return next;
      });
    } else {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const r of filteredRows) next.add(r.key);
        return next;
      });
    }
  };

  const materializeRowForCloud = async (
    row: UnifiedTestRow,
    targetCollection?: string
  ): Promise<{ payload: CloudExamPayload; updatedRow?: unknown }> => {
    const col = targetCollection ?? row.collection;
    if (row.rawExam) {
      const full = (await loadFullExam(row.rawExam)) ?? row.rawExam;
      const updated: Exam = { ...full, collection: col, updatedAt: Date.now() };
      delete updated.dataFile;
      return {
        payload: {
          examId: updated.id,
          skill: row.skill,
          title: updated.title,
          collection: col,
          data: updated as unknown as Record<string, unknown>,
        },
        updatedRow: updated,
      };
    }
    if (row.rawWriting) {
      const updated: WritingExam = { ...row.rawWriting, collection: col, updatedAt: Date.now() };
      return {
        payload: {
          examId: updated.id,
          skill: 'Writing',
          title: updated.title,
          collection: col,
          data: updated as unknown as Record<string, unknown>,
        },
        updatedRow: updated,
      };
    }
    const updated: SpeakingExam = { ...row.rawSpeaking!, collection: col, updatedAt: Date.now() };
    return {
      payload: {
        examId: updated.id,
        skill: 'Speaking',
        title: updated.title,
        collection: col,
        data: updated as unknown as Record<string, unknown>,
      },
      updatedRow: updated,
    };
  };

  const handleMoveSingleTest = async (row: UnifiedTestRow, nextCollection: string) => {
    setIsBusy(true);
    try {
      const { payload, updatedRow } = await materializeRowForCloud(row, nextCollection);
      if (row.rawExam) {
        saveExam(updatedRow as Exam);
      } else if (row.rawWriting) {
        saveWritingExam(updatedRow as WritingExam);
      } else if (row.rawSpeaking) {
        saveSpeakingExam(updatedRow as SpeakingExam);
      }
      onCloudSaveExam?.(payload);
      onRefreshAll();
      toast({
        title: 'Moved test',
        description: `"${row.title}" → ${nextCollection}`,
        status: 'success',
        duration: 2000,
        isClosable: true,
        position: 'bottom-right',
      });
    } catch {
      toast({
        title: 'Failed to move test',
        status: 'error',
        duration: 2500,
        isClosable: true,
        position: 'bottom-right',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleBulkMove = async () => {
    const target = bulkMoveTarget || collections[0]?.name;
    if (!target || selectedRows.length === 0) return;

    setIsBusy(true);
    try {
      const cloudItems: CloudExamPayload[] = [];
      for (const row of selectedRows) {
        const { payload, updatedRow } = await materializeRowForCloud(row, target);
        if (row.rawExam) saveExam(updatedRow as Exam);
        else if (row.rawWriting) saveWritingExam(updatedRow as WritingExam);
        else if (row.rawSpeaking) saveSpeakingExam(updatedRow as SpeakingExam);
        cloudItems.push(payload);
      }
      onCloudBulkMoveExams?.(target, cloudItems);
      setSelectedKeys(new Set());
      onRefreshAll();
      toast({
        title: `Moved ${cloudItems.length} test(s)`,
        description: `Destination: ${target}`,
        status: 'success',
        duration: 2400,
        isClosable: true,
        position: 'bottom-right',
      });
    } catch {
      toast({
        title: 'Bulk move failed',
        status: 'error',
        duration: 2500,
        isClosable: true,
        position: 'bottom-right',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleDuplicateTest = async (row: UnifiedTestRow) => {
    setIsBusy(true);
    try {
      if (row.rawExam) {
        const full = (await loadFullExam(row.rawExam)) ?? row.rawExam;
        const cloned: Exam = {
          ...JSON.parse(JSON.stringify(full)),
          id: 'exam_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          title: `${full.title} (Copy)`,
          isBuiltin: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        delete cloned.dataFile;
        saveExam(cloned);
        onCloudSaveExam?.({
          examId: cloned.id,
          skill: row.skill,
          title: cloned.title,
          collection: getExamCollection(cloned),
          data: cloned as unknown as Record<string, unknown>,
        });
      } else if (row.rawWriting) {
        const cloned: WritingExam = {
          ...JSON.parse(JSON.stringify(row.rawWriting)),
          id: 'writing_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          title: `${row.rawWriting.title} (Copy)`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        saveWritingExam(cloned);
        onCloudSaveExam?.({
          examId: cloned.id,
          skill: 'Writing',
          title: cloned.title,
          collection: cloned.collection || 'My Tests',
          data: cloned as unknown as Record<string, unknown>,
        });
      } else if (row.rawSpeaking) {
        const cloned: SpeakingExam = {
          ...JSON.parse(JSON.stringify(row.rawSpeaking)),
          id: 'speaking_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          title: `${row.rawSpeaking.title} (Copy)`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        saveSpeakingExam(cloned);
        onCloudSaveExam?.({
          examId: cloned.id,
          skill: 'Speaking',
          title: cloned.title,
          collection: cloned.collection || 'My Tests',
          data: cloned as unknown as Record<string, unknown>,
        });
      }
      onRefreshAll();
      toast({
        title: 'Test duplicated',
        description: `Created "${row.title} (Copy)".`,
        status: 'success',
        duration: 2200,
        isClosable: true,
        position: 'bottom-right',
      });
    } catch {
      toast({
        title: 'Unable to duplicate test',
        status: 'error',
        duration: 2500,
        isClosable: true,
        position: 'bottom-right',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleExportTest = async (row: UnifiedTestRow) => {
    try {
      if (row.rawExam) {
        const full = (await loadFullExam(row.rawExam)) ?? row.rawExam;
        exportExamAsJSON(full);
      } else {
        const payload = row.rawWriting ?? row.rawSpeaking;
        if (!payload) return;
        const dataStr =
          'data:text/json;charset=utf-8,' +
          encodeURIComponent(JSON.stringify(payload, null, 2));
        const a = document.createElement('a');
        a.href = dataStr;
        a.download = `${(payload.title || 'ielts-test').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch {
      toast({
        title: 'Unable to export JSON',
        status: 'error',
        duration: 2500,
        isClosable: true,
        position: 'bottom-right',
      });
    }
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed && parsed.task1 && parsed.task2) {
          const newWriting: WritingExam = {
            ...parsed,
            id: 'writing_' + Date.now(),
            collection:
              parsed.collection || (collectionFilter !== 'all' ? collectionFilter : 'My Tests'),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          saveWritingExam(newWriting);
          onCloudSaveExam?.({
            examId: newWriting.id,
            skill: 'Writing',
            title: newWriting.title,
            collection: newWriting.collection || 'My Tests',
            data: newWriting as unknown as Record<string, unknown>,
          });
          onRefreshAll();
          toast({ title: `Imported Writing "${newWriting.title}"`, status: 'success', duration: 2400 });
        } else if (parsed && parsed.part2Question) {
          const newSpeaking: SpeakingExam = {
            ...parsed,
            id: 'speaking_' + Date.now(),
            collection:
              parsed.collection || (collectionFilter !== 'all' ? collectionFilter : 'My Tests'),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          saveSpeakingExam(newSpeaking);
          onCloudSaveExam?.({
            examId: newSpeaking.id,
            skill: 'Speaking',
            title: newSpeaking.title,
            collection: newSpeaking.collection || 'My Tests',
            data: newSpeaking as unknown as Record<string, unknown>,
          });
          onRefreshAll();
          toast({ title: `Imported Speaking "${newSpeaking.title}"`, status: 'success', duration: 2400 });
        } else {
          const imported = importExamFromJSON(content);
          onCloudSaveExam?.({
            examId: imported.id,
            skill: isListeningExam(imported) ? 'Listening' : 'Reading',
            title: imported.title,
            collection: getExamCollection(imported),
            data: imported as unknown as Record<string, unknown>,
          });
          onRefreshAll();
          toast({ title: `Imported "${imported.title}"`, status: 'success', duration: 2400 });
        }
      } catch (err) {
        toast({
          title: 'Invalid JSON file',
          description: err instanceof Error ? err.message : 'Unable to parse JSON.',
          status: 'error',
          duration: 3000,
        });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const openCreateCollectionModal = () => {
    setColModalMode('create');
    setColEditOldName('');
    setColFormName('');
    setColFormDesc('');
  };

  const openEditCollectionModal = (col: CollectionItem) => {
    setColModalMode('edit');
    setColEditOldName(col.name);
    setColFormName(col.name);
    setColFormDesc(col.description || '');
  };

  const handleSubmitCollectionModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const newName = colFormName.trim();
    const desc = colFormDesc.trim();
    if (!newName) return;

    setIsBusy(true);
    try {
      if (colModalMode === 'create') {
        const created = createCollection(newName, desc);
        onCloudCreateCollection?.(created);
        toast({
          title: 'Collection created',
          description: `"${created.name}" is ready.`,
          status: 'success',
          duration: 2200,
          isClosable: true,
          position: 'bottom-right',
        });
      } else if (colModalMode === 'edit') {
        const oldName = colEditOldName.trim();
        const updatedCol = renameCollection(oldName, newName, desc);
        const movedExams: CloudExamPayload[] = [];

        if (oldName.toLowerCase() !== newName.toLowerCase()) {
          const matchingRows = allRows.filter(
            (r) => r.collection.toLowerCase() === oldName.toLowerCase()
          );
          for (const row of matchingRows) {
            const { payload, updatedRow } = await materializeRowForCloud(row, newName);
            if (row.rawExam) saveExam(updatedRow as Exam);
            else if (row.rawWriting) saveWritingExam(updatedRow as WritingExam);
            else if (row.rawSpeaking) saveSpeakingExam(updatedRow as SpeakingExam);
            movedExams.push(payload);
          }
          if (collectionFilter.toLowerCase() === oldName.toLowerCase()) {
            setCollectionFilter(newName);
          }
        }

        onCloudRenameCollection?.({
          oldName,
          newName: updatedCol.name,
          description: updatedCol.description,
          movedExams,
        });

        toast({
          title: 'Collection updated',
          description:
            oldName.toLowerCase() !== newName.toLowerCase()
              ? `Renamed "${oldName}" → "${newName}".`
              : `Updated "${newName}".`,
          status: 'success',
          duration: 2200,
          isClosable: true,
          position: 'bottom-right',
        });
      }
      setColModalMode(null);
      onRefreshAll();
    } catch (err) {
      toast({
        title: 'Collection update failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        status: 'error',
        duration: 2600,
        isClosable: true,
        position: 'bottom-right',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const executeConfirmedAction = () => {
    if (!confirmAction) return;

    if (confirmAction.type === 'delete_test') {
      const { row } = confirmAction;
      if (row.rawExam) deleteExam(row.id);
      else if (row.rawWriting) deleteWritingExam(row.id);
      else if (row.rawSpeaking) deleteSpeakingExam(row.id);

      onCloudDeleteExam?.(row.skill, row.id);
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(row.key);
        return next;
      });
      onRefreshAll();
      toast({
        title: 'Test deleted',
        description: `Removed "${row.title}".`,
        status: 'info',
        duration: 2200,
        isClosable: true,
        position: 'bottom-right',
      });
    } else if (confirmAction.type === 'bulk_delete') {
      const items = confirmAction.rows.map((row) => {
        if (row.rawExam) deleteExam(row.id);
        else if (row.rawWriting) deleteWritingExam(row.id);
        else if (row.rawSpeaking) deleteSpeakingExam(row.id);
        return { examId: row.id, skill: row.skill };
      });
      onCloudBulkDeleteExams?.(items);
      setSelectedKeys(new Set());
      onRefreshAll();
      toast({
        title: `Deleted ${items.length} test(s)`,
        status: 'info',
        duration: 2200,
        isClosable: true,
        position: 'bottom-right',
      });
    } else if (confirmAction.type === 'delete_collection') {
      const { name, rows } = confirmAction;
      deleteCollection(name, true);
      for (const row of rows) {
        if (row.rawWriting) deleteWritingExam(row.id);
        else if (row.rawSpeaking) deleteSpeakingExam(row.id);
      }
      const examsToTombstone = rows.map((r) => ({ examId: r.id, skill: r.skill }));
      onCloudDeleteCollection?.(name, examsToTombstone);
      if (collectionFilter.toLowerCase() === name.toLowerCase()) {
        setCollectionFilter('all');
      }
      setSelectedKeys(new Set());
      onRefreshAll();
      toast({
        title: 'Collection deleted',
        description: `Removed "${name}" and ${rows.length} test(s).`,
        status: 'info',
        duration: 2400,
        isClosable: true,
        position: 'bottom-right',
      });
    } else if (confirmAction.type === 'restore_defaults') {
      restoreDefaultExamsAndCollections();
      restoreDefaultWritingExams();
      restoreDefaultSpeakingExams();
      onCloudRestoreDefaults?.();
      onRefreshAll();
      toast({
        title: 'Default library restored',
        description: 'Cambridge 15–21 collections and tests have been restored.',
        status: 'success',
        duration: 2500,
        isClosable: true,
        position: 'bottom-right',
      });
    }

    setConfirmAction(null);
  };

  const getSkillBadgeProps = (skill: CloudIeltsSkill) => {
    if (skill === 'Listening') return { colorScheme: 'purple', icon: IconHeadphones };
    if (skill === 'Writing') return { colorScheme: 'orange', icon: IconPencil };
    if (skill === 'Speaking') return { colorScheme: 'pink', icon: IconMicrophone };
    return { colorScheme: 'blue', icon: IconBook };
  };

  const activeCollectionDefault =
    collectionFilter !== 'all' ? collectionFilter : undefined;

  return (
    <Stack spacing={5}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportJsonFile}
      />

      {/* Top Studio Header */}
      <Flex
        justify="space-between"
        align={{ base: 'start', md: 'center' }}
        direction={{ base: 'column', md: 'row' }}
        gap={3}
        p={5}
        bg={cardBg}
        borderWidth="2px"
        borderColor={cardBorder}
        rounded="2xl"
        shadow="sm"
      >
        <Stack spacing={1}>
          <HStack spacing={2.5} flexWrap="wrap">
            <Heading size="md" fontFamily={outfit.style.fontFamily}>
              Manage IELTS Library
            </Heading>
            <Badge colorScheme="blue" variant="subtle" rounded="md" px={2} py={0.5}>
              {allRows.length} Tests
            </Badge>
            <Badge colorScheme="purple" variant="subtle" rounded="md" px={2} py={0.5}>
              {collections.length} Collections
            </Badge>
          </HStack>
          <Text fontSize="sm" color={secondaryColor}>
            Full control over all 4 skills and collections — create, edit, rename, organize, export, or delete any item.
          </Text>
        </Stack>

        <HStack spacing={2} flexWrap="wrap">
          <Menu placement="bottom-end">
            <MenuButton
              as={Button}
              size="sm"
              colorScheme="blue"
              rounded="xl"
              leftIcon={<IconPlus size={16} />}
              rightIcon={<IconChevronDown size={14} />}
              isDisabled={isBusy}
            >
              Add Test
            </MenuButton>
            <MenuList minW="260px" zIndex={40}>
              <MenuItem
                icon={<IconBook size={16} />}
                onClick={() => onCreateManualExam(activeCollectionDefault, 'reading')}
              >
                New Reading Test (Editor)
              </MenuItem>
              <MenuItem
                icon={<IconHeadphones size={16} />}
                onClick={() => onCreateManualExam(activeCollectionDefault, 'listening')}
              >
                New Listening Test (Editor)
              </MenuItem>
              <MenuItem
                icon={<IconPencil size={16} />}
                onClick={() => onEditWriting(null, activeCollectionDefault)}
              >
                New Writing Test
              </MenuItem>
              <MenuItem
                icon={<IconMicrophone size={16} />}
                onClick={() => onEditSpeaking(null, activeCollectionDefault)}
              >
                New Speaking Test
              </MenuItem>
              <MenuDivider />
              <MenuItem
                icon={<IconSparkles size={16} />}
                onClick={() => onOpenSmartImport(activeCollectionDefault)}
              >
                Smart Import (TXT / Audio)
              </MenuItem>
              <MenuItem
                icon={<IconUpload size={16} />}
                onClick={() => fileInputRef.current?.click()}
              >
                Import JSON File
              </MenuItem>
            </MenuList>
          </Menu>

          <Button
            size="sm"
            variant="outline"
            rounded="xl"
            leftIcon={<IconFolderPlus size={16} />}
            onClick={openCreateCollectionModal}
            isDisabled={isBusy}
          >
            New Collection
          </Button>

          <Button
            size="sm"
            variant="ghost"
            colorScheme="gray"
            rounded="xl"
            leftIcon={<IconRefresh size={16} />}
            onClick={() => setConfirmAction({ type: 'restore_defaults' })}
            isDisabled={isBusy}
          >
            Restore Defaults
          </Button>
        </HStack>
      </Flex>

      {/* Sub-Tabs: Tests | Collections */}
      <HStack
        bg={pillBg}
        p={1}
        rounded="xl"
        borderWidth="2px"
        borderColor={cardBorder}
        w="fit-content"
        spacing={1}
      >
        <Button
          size="sm"
          rounded="lg"
          fontWeight={700}
          variant={subTab === 'tests' ? 'solid' : 'ghost'}
          colorScheme={subTab === 'tests' ? 'blue' : 'gray'}
          onClick={() => setSubTab('tests')}
        >
          Tests ({allRows.length})
        </Button>
        <Button
          size="sm"
          rounded="lg"
          fontWeight={700}
          variant={subTab === 'collections' ? 'solid' : 'ghost'}
          colorScheme={subTab === 'collections' ? 'blue' : 'gray'}
          onClick={() => setSubTab('collections')}
        >
          Collections ({collections.length})
        </Button>
      </HStack>

      {/* SUB-TAB 1: TESTS CRUD */}
      {subTab === 'tests' && (
        <Stack spacing={4}>
          {/* Filter Bar */}
          <Flex
            justify="space-between"
            align={{ base: 'stretch', lg: 'center' }}
            direction={{ base: 'column', lg: 'row' }}
            gap={3}
            p={4}
            bg={cardBg}
            borderWidth="2px"
            borderColor={cardBorder}
            rounded="2xl"
          >
            <HStack spacing={1.5} flexWrap="wrap">
              {(
                [
                  { id: 'all', label: 'All', count: skillCounts.all },
                  { id: 'Reading', label: 'Reading', count: skillCounts.Reading },
                  { id: 'Listening', label: 'Listening', count: skillCounts.Listening },
                  { id: 'Writing', label: 'Writing', count: skillCounts.Writing },
                  { id: 'Speaking', label: 'Speaking', count: skillCounts.Speaking },
                ] as const
              ).map((tab) => (
                <Button
                  key={tab.id}
                  size="xs"
                  rounded="lg"
                  fontWeight={700}
                  variant={skillFilter === tab.id ? 'solid' : 'outline'}
                  colorScheme={skillFilter === tab.id ? 'blue' : 'gray'}
                  onClick={() => setSkillFilter(tab.id)}
                >
                  {tab.label} ({tab.count})
                </Button>
              ))}
            </HStack>

            <HStack spacing={2.5} flexWrap="wrap">
              <Select
                size="sm"
                w={{ base: 'full', sm: '210px' }}
                rounded="xl"
                value={collectionFilter}
                onChange={(e) => setCollectionFilter(e.target.value)}
              >
                <option value="all">All Collections ({allRows.length})</option>
                {collections.map((c) => {
                  const count = allRows.filter(
                    (r) => r.collection.toLowerCase() === c.name.toLowerCase()
                  ).length;
                  return (
                    <option key={c.id} value={c.name}>
                      {c.name} ({count})
                    </option>
                  );
                })}
              </Select>

              <InputGroup size="sm" w={{ base: 'full', sm: '240px' }}>
                <InputLeftElement pointerEvents="none" color="gray.400">
                  <IconSearch size={15} />
                </InputLeftElement>
                <Input
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  placeholder="Filter tests by title..."
                  rounded="xl"
                />
              </InputGroup>
            </HStack>
          </Flex>

          {/* Bulk Action Bar */}
          {selectedRows.length > 0 && (
            <Flex
              justify="space-between"
              align={{ base: 'start', md: 'center' }}
              direction={{ base: 'column', md: 'row' }}
              gap={3}
              p={3.5}
              bg={bulkBg}
              borderWidth="2px"
              borderColor={bulkBorder}
              rounded="xl"
            >
              <HStack spacing={3}>
                <Checkbox
                  isChecked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  colorScheme="blue"
                >
                  <Text fontSize="sm" fontWeight={700}>
                    {selectedRows.length} selected
                  </Text>
                </Checkbox>
                <Button size="xs" variant="ghost" onClick={() => setSelectedKeys(new Set())}>
                  Clear selection
                </Button>
              </HStack>

              <HStack spacing={2} flexWrap="wrap">
                <Select
                  size="sm"
                  w="190px"
                  bg={cardBg}
                  rounded="xl"
                  value={bulkMoveTarget || collections[0]?.name || ''}
                  onChange={(e) => setBulkMoveTarget(e.target.value)}
                >
                  {collections.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  colorScheme="blue"
                  rounded="xl"
                  isLoading={isBusy}
                  onClick={() => void handleBulkMove()}
                >
                  Move Selected
                </Button>
                <Button
                  size="sm"
                  colorScheme="red"
                  variant="solid"
                  rounded="xl"
                  leftIcon={<IconTrash size={15} />}
                  isDisabled={isBusy}
                  onClick={() => setConfirmAction({ type: 'bulk_delete', rows: selectedRows })}
                >
                  Delete Selected
                </Button>
              </HStack>
            </Flex>
          )}

          {/* Select All Strip */}
          {filteredRows.length > 0 && selectedRows.length === 0 && (
            <HStack justify="space-between" px={2}>
              <Checkbox
                size="sm"
                isChecked={allFilteredSelected}
                onChange={toggleSelectAllFiltered}
              >
                <Text fontSize="xs" fontWeight={600} color={secondaryColor}>
                  Select all {filteredRows.length} visible tests
                </Text>
              </Checkbox>
              <Text fontSize="xs" color={secondaryColor}>
                Showing {filteredRows.length} of {allRows.length} tests
              </Text>
            </HStack>
          )}

          {/* Tests List */}
          {filteredRows.length === 0 ? (
            <Box
              p={10}
              bg={cardBg}
              borderWidth="2px"
              borderColor={cardBorder}
              rounded="2xl"
              textAlign="center"
            >
              <Text fontSize="sm" color={secondaryColor} mb={3}>
                No tests match the current filters.
              </Text>
              <Button
                size="sm"
                colorScheme="blue"
                rounded="xl"
                leftIcon={<IconPlus size={16} />}
                onClick={() => onCreateManualExam(activeCollectionDefault, 'reading')}
              >
                Create New Test
              </Button>
            </Box>
          ) : (
            <Stack spacing={2.5}>
              {filteredRows.map((row) => {
                const { colorScheme, icon } = getSkillBadgeProps(row.skill);
                const isChecked = selectedKeys.has(row.key);

                return (
                  <Flex
                    key={row.key}
                    p={4}
                    bg={cardBg}
                    borderWidth="2px"
                    borderColor={isChecked ? 'blue.400' : cardBorder}
                    rounded="xl"
                    justify="space-between"
                    align={{ base: 'start', md: 'center' }}
                    direction={{ base: 'column', md: 'row' }}
                    gap={3}
                    transition="border-color 120ms ease"
                    _hover={{ borderColor: 'blue.300' }}
                  >
                    <HStack spacing={3} flex={1} minW={0} align="start">
                      <Checkbox
                        mt={1}
                        isChecked={isChecked}
                        onChange={() => toggleRowSelection(row.key)}
                        colorScheme="blue"
                      />
                      <Stack spacing={1} minW={0} flex={1}>
                        <HStack spacing={2} flexWrap="wrap">
                          <Badge
                            colorScheme={colorScheme}
                            variant="subtle"
                            rounded="md"
                            px={2}
                            py={0.5}
                            fontSize="xs"
                          >
                            <HStack spacing={1}>
                              <Icon as={icon} boxSize={3.5} />
                              <Text>{row.skill}</Text>
                            </HStack>
                          </Badge>
                          <Text fontWeight={700} fontSize="sm" noOfLines={1}>
                            {row.title}
                          </Text>
                        </HStack>
                        <Text fontSize="xs" color={secondaryColor}>
                          {row.meta}
                        </Text>
                      </Stack>
                    </HStack>

                    <HStack spacing={2} flexWrap="wrap" flexShrink={0}>
                      <Select
                        size="xs"
                        w="155px"
                        rounded="lg"
                        bg={subtleBg}
                        value={row.collection}
                        isDisabled={isBusy}
                        onChange={(e) => void handleMoveSingleTest(row, e.target.value)}
                        aria-label={`Collection for ${row.title}`}
                      >
                        {!collections.some(
                          (c) => c.name.toLowerCase() === row.collection.toLowerCase()
                        ) && <option value={row.collection}>{row.collection}</option>}
                        {collections.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </Select>

                      <Tooltip label="Edit test">
                        <IconButton
                          size="sm"
                          variant="outline"
                          rounded="lg"
                          aria-label={`Edit ${row.title}`}
                          icon={<IconEdit size={16} />}
                          onClick={() => {
                            if (row.rawExam) onEditExam(row.rawExam);
                            else if (row.rawWriting) onEditWriting(row.rawWriting);
                            else if (row.rawSpeaking) onEditSpeaking(row.rawSpeaking);
                          }}
                        />
                      </Tooltip>

                      <Tooltip label="Duplicate test">
                        <IconButton
                          size="sm"
                          variant="outline"
                          rounded="lg"
                          aria-label={`Duplicate ${row.title}`}
                          icon={<IconCopy size={16} />}
                          isDisabled={isBusy}
                          onClick={() => void handleDuplicateTest(row)}
                        />
                      </Tooltip>

                      <Tooltip label="Export JSON">
                        <IconButton
                          size="sm"
                          variant="outline"
                          rounded="lg"
                          aria-label={`Export ${row.title}`}
                          icon={<IconDownload size={16} />}
                          onClick={() => void handleExportTest(row)}
                        />
                      </Tooltip>

                      <Tooltip label="Delete test">
                        <IconButton
                          size="sm"
                          variant="outline"
                          colorScheme="red"
                          rounded="lg"
                          aria-label={`Delete ${row.title}`}
                          icon={<IconTrash size={16} />}
                          isDisabled={isBusy}
                          onClick={() => setConfirmAction({ type: 'delete_test', row })}
                        />
                      </Tooltip>
                    </HStack>
                  </Flex>
                );
              })}
            </Stack>
          )}
        </Stack>
      )}

      {/* SUB-TAB 2: COLLECTIONS CRUD */}
      {subTab === 'collections' && (
        <Grid templateColumns="repeat(auto-fill, minmax(min(100%, 300px), 1fr))" gap={4}>
          {collections.map((col) => {
            const colLower = col.name.toLowerCase();
            const matchingRows = allRows.filter((r) => r.collection.toLowerCase() === colLower);
            const rCount = matchingRows.filter((r) => r.skill === 'Reading').length;
            const lCount = matchingRows.filter((r) => r.skill === 'Listening').length;
            const wCount = matchingRows.filter((r) => r.skill === 'Writing').length;
            const sCount = matchingRows.filter((r) => r.skill === 'Speaking').length;

            return (
              <GridItem key={col.name}>
                <Box
                  h="full"
                  p={5}
                  bg={cardBg}
                  borderWidth="2px"
                  borderColor={cardBorder}
                  rounded="2xl"
                  shadow="sm"
                >
                  <Flex direction="column" justify="space-between" h="full" gap={4}>
                    <Stack spacing={2}>
                      <HStack justify="space-between" align="start">
                        <HStack spacing={2} minW={0}>
                          <Icon as={IconFolder} boxSize={5} color="blue.400" flexShrink={0} />
                          <Heading
                            size="md"
                            fontFamily={outfit.style.fontFamily}
                            noOfLines={1}
                          >
                            {col.name}
                          </Heading>
                        </HStack>
                        <Badge colorScheme="gray" variant="subtle" rounded="md" flexShrink={0}>
                          {matchingRows.length} Tests
                        </Badge>
                      </HStack>

                      <Text fontSize="sm" color={secondaryColor} noOfLines={2}>
                        {col.description || 'IELTS practice test collection'}
                      </Text>

                      <HStack spacing={1.5} flexWrap="wrap" pt={1}>
                        <Badge colorScheme="blue" variant="subtle" rounded="md">
                          {rCount} Reading
                        </Badge>
                        <Badge colorScheme="purple" variant="subtle" rounded="md">
                          {lCount} Listening
                        </Badge>
                        <Badge colorScheme="orange" variant="subtle" rounded="md">
                          {wCount} Writing
                        </Badge>
                        <Badge colorScheme="pink" variant="subtle" rounded="md">
                          {sCount} Speaking
                        </Badge>
                      </HStack>
                    </Stack>

                    <HStack justify="space-between" pt={2} borderTopWidth="1px" borderColor={cardBorder}>
                      <Button
                        size="xs"
                        variant="ghost"
                        colorScheme="blue"
                        rounded="lg"
                        onClick={() => {
                          setCollectionFilter(col.name);
                          setSubTab('tests');
                        }}
                      >
                        View Tests
                      </Button>

                      <HStack spacing={1.5}>
                        <Button
                          size="xs"
                          variant="outline"
                          rounded="lg"
                          leftIcon={<IconEdit size={14} />}
                          onClick={() => openEditCollectionModal(col)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          colorScheme="red"
                          rounded="lg"
                          leftIcon={<IconTrash size={14} />}
                          onClick={() =>
                            setConfirmAction({
                              type: 'delete_collection',
                              name: col.name,
                              totalCount: matchingRows.length,
                              rows: matchingRows,
                            })
                          }
                        >
                          Delete
                        </Button>
                      </HStack>
                    </HStack>
                  </Flex>
                </Box>
              </GridItem>
            );
          })}
        </Grid>
      )}

      {/* Create / Edit Collection Modal */}
      <Modal isOpen={colModalMode !== null} onClose={() => setColModalMode(null)} isCentered>
        <ModalOverlay />
        <ModalContent>
          <form onSubmit={(e) => void handleSubmitCollectionModal(e)}>
            <ModalHeader fontFamily={outfit.style.fontFamily}>
              {colModalMode === 'edit' ? 'Edit Collection' : 'New Collection'}
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Stack spacing={4}>
                <Box>
                  <Text fontSize="xs" fontWeight={700} mb={1}>
                    Collection Name
                  </Text>
                  <Input
                    required
                    value={colFormName}
                    onChange={(e) => setColFormName(e.target.value)}
                    placeholder="e.g. Cambridge 21, Mock Pack..."
                    rounded="xl"
                  />
                </Box>
                <Box>
                  <Text fontSize="xs" fontWeight={700} mb={1}>
                    Description (Optional)
                  </Text>
                  <Textarea
                    value={colFormDesc}
                    onChange={(e) => setColFormDesc(e.target.value)}
                    placeholder="Short notes about this collection..."
                    rows={2}
                    rounded="xl"
                  />
                </Box>
              </Stack>
            </ModalBody>
            <ModalFooter gap={2}>
              <Button variant="ghost" onClick={() => setColModalMode(null)}>
                Cancel
              </Button>
              <Button type="submit" colorScheme="blue" rounded="xl" isLoading={isBusy}>
                {colModalMode === 'edit' ? 'Save Changes' : 'Create Collection'}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Confirmation AlertDialog */}
      <AlertDialog
        isOpen={confirmAction !== null}
        leastDestructiveRef={cancelConfirmRef}
        onClose={() => setConfirmAction(null)}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold" fontFamily={outfit.style.fontFamily}>
              {confirmAction?.type === 'delete_test' && 'Delete Test?'}
              {confirmAction?.type === 'bulk_delete' &&
                `Delete ${confirmAction.rows.length} Selected Tests?`}
              {confirmAction?.type === 'delete_collection' &&
                `Delete Collection "${confirmAction.name}"?`}
              {confirmAction?.type === 'restore_defaults' && 'Restore Default Library?'}
            </AlertDialogHeader>

            <AlertDialogBody fontSize="sm">
              {confirmAction?.type === 'delete_test' &&
                `Are you sure you want to delete "${confirmAction.row.title}" (${confirmAction.row.skill})?`}
              {confirmAction?.type === 'bulk_delete' &&
                `Are you sure you want to permanently remove ${confirmAction.rows.length} selected test(s) across your library?`}
              {confirmAction?.type === 'delete_collection' &&
                `Deleting "${confirmAction.name}" will also delete all ${confirmAction.totalCount} test(s) inside it across Reading, Listening, Writing, and Speaking.`}
              {confirmAction?.type === 'restore_defaults' &&
                'This will restore all built-in Cambridge 15–21 collections and tests you previously deleted. Your custom tests and attempt history will be preserved.'}
            </AlertDialogBody>

            <AlertDialogFooter gap={2}>
              <Button ref={cancelConfirmRef} variant="ghost" onClick={() => setConfirmAction(null)}>
                Cancel
              </Button>
              <Button
                colorScheme={confirmAction?.type === 'restore_defaults' ? 'blue' : 'red'}
                rounded="xl"
                onClick={executeConfirmedAction}
              >
                {confirmAction?.type === 'restore_defaults' ? 'Restore Defaults' : 'Delete'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Stack>
  );
};
