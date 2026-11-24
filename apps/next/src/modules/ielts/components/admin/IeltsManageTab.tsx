import React, { useEffect, useId, useMemo, useRef, useState, type FC } from 'react';
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
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
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
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import {
  IconBook,
  IconChevronDown,
  IconFolderPlus,
  IconHeadphones,
  IconMicrophone,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSparkles,
  IconUpload,
  IconX,
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
  exportJsonBlob,
  getExamCollection,
  getExamPartCount,
  getExamQuestionCount,
  importTestsBundleFromJSON,
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
import {
  computeTestHealth,
  sortUnifiedRows,
  type CloudExamPayload,
  type CollectionItem,
  type OriginFilter,
  type SortDirection,
  type SortField,
  type UnifiedTestRow,
} from './manage/ManageHelpers';
import { ManageTestsTable } from './manage/ManageTestsTable';
import { ManageCollectionsGrid } from './manage/ManageCollectionsGrid';

export type { CollectionItem, CloudExamPayload, UnifiedTestRow };

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
  subTab: 'tests' | 'collections';
  onSubTabChange: (sub: 'tests' | 'collections') => void;
  openNewCollectionSignal?: number;
  onSearchQueryChange: (q: string) => void;
  onCreateManualExam: (defaultCollection?: string, defaultSkill?: 'reading' | 'listening') => void;
  onOpenSmartImport: (
    collection?: string,
    skill?: 'reading' | 'listening' | 'writing' | 'speaking'
  ) => void;
  onPreviewTest: (row: UnifiedTestRow) => void;
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
  subTab,
  onSubTabChange,
  openNewCollectionSignal,
  onSearchQueryChange,
  onCreateManualExam,
  onOpenSmartImport,
  onPreviewTest,
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
  const colNameErrorId = useId();

  const [skillFilter, setSkillFilter] = useState<'all' | CloudIeltsSkill>('all');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all');
  const [collectionFilter, setCollectionFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [bulkMoveTarget, setBulkMoveTarget] = useState<string>('');
  const [isBusy, setIsBusy] = useState(false);

  // Collection Modal (Create or Edit)
  const [colModalMode, setColModalMode] = useState<'create' | 'edit' | null>(null);
  const [colEditOldName, setColEditOldName] = useState('');
  const [colFormName, setColFormName] = useState('');
  const [colFormDesc, setColFormDesc] = useState('');
  const [colFormTouched, setColFormTouched] = useState(false);
  const [colFormSubmitted, setColFormSubmitted] = useState(false);

  // Confirmation AlertDialog
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const pillBg = useColorModeValue('gray.100', 'gray.800');
  const secondaryColor = useColorModeValue('gray.600', 'gray.400');

  // Trigger New Collection modal when external shortcut fires
  useEffect(() => {
    if (openNewCollectionSignal && openNewCollectionSignal > 0) {
      openCreateCollectionModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNewCollectionSignal]);

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
        questionCount: qs,
        isBuiltin: Boolean(ex.isBuiltin),
        updatedAt: ex.updatedAt || ex.createdAt || 0,
        healthWarnings: computeTestHealth({ skill, questionCount: qs, rawExam: ex }),
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
        questionCount: 2,
        isBuiltin: w.id.startsWith('writing_test_'),
        updatedAt: w.updatedAt || w.createdAt || 0,
        healthWarnings: computeTestHealth({ skill: 'Writing', questionCount: 2, rawWriting: w }),
        rawWriting: w,
      });
    }

    for (const s of speakingExams) {
      const qs = (s.part1Questions?.length || 0) + 1 + (s.part3Questions?.length || 0);
      rows.push({
        key: `Speaking:${s.id}`,
        id: s.id,
        title: s.title,
        skill: 'Speaking',
        collection: s.collection || 'My Tests',
        meta: `Part 1 (${s.part1Questions.length} Qs) • Part 2 • Part 3 (${s.part3Questions.length} Qs)`,
        questionCount: qs,
        isBuiltin: s.id.startsWith('speaking_test_'),
        updatedAt: s.updatedAt || s.createdAt || 0,
        healthWarnings: computeTestHealth({ skill: 'Speaking', questionCount: qs, rawSpeaking: s }),
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

  const filteredAndSortedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = allRows.filter((row) => {
      if (skillFilter !== 'all' && row.skill !== skillFilter) return false;
      if (originFilter === 'custom' && row.isBuiltin) return false;
      if (originFilter === 'builtin' && !row.isBuiltin) return false;
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
    return sortUnifiedRows(filtered, sortField, sortDirection);
  }, [allRows, skillFilter, originFilter, collectionFilter, searchQuery, sortField, sortDirection]);

  const hasActiveFilters =
    skillFilter !== 'all' ||
    originFilter !== 'all' ||
    collectionFilter !== 'all' ||
    Boolean(searchQuery.trim());

  const resetFilters = () => {
    setSkillFilter('all');
    setOriginFilter('all');
    setCollectionFilter('all');
    onSearchQueryChange('');
  };

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'updatedAt' || field === 'questions' ? 'desc' : 'asc');
    }
  };

  const toggleRowSelection = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const allVisibleSelected =
      filteredAndSortedRows.length > 0 &&
      filteredAndSortedRows.every((r) => selectedKeys.has(r.key));

    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const r of filteredAndSortedRows) next.delete(r.key);
      } else {
        for (const r of filteredAndSortedRows) next.add(r.key);
      }
      return next;
    });
  };

  const materializeRowForCloud = async (
    row: UnifiedTestRow,
    overrides?: { collection?: string; title?: string }
  ): Promise<{ payload: CloudExamPayload; updatedRow: Exam | WritingExam | SpeakingExam }> => {
    const col = overrides?.collection ?? row.collection;
    const nextTitle = overrides?.title ?? row.title;
    if (row.rawExam) {
      const full = (await loadFullExam(row.rawExam)) ?? row.rawExam;
      const updated: Exam = {
        ...full,
        title: nextTitle,
        collection: col,
        updatedAt: Date.now(),
      };
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
      const updated: WritingExam = {
        ...row.rawWriting,
        title: nextTitle,
        collection: col,
        updatedAt: Date.now(),
      };
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
    const updated: SpeakingExam = {
      ...row.rawSpeaking!,
      title: nextTitle,
      collection: col,
      updatedAt: Date.now(),
    };
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

  const persistRow = (row: UnifiedTestRow, updatedRow: Exam | WritingExam | SpeakingExam) => {
    if (row.rawExam) saveExam(updatedRow as Exam);
    else if (row.rawWriting) saveWritingExam(updatedRow as WritingExam);
    else if (row.rawSpeaking) saveSpeakingExam(updatedRow as SpeakingExam);
  };

  const handleQuickRenameTest = async (row: UnifiedTestRow, nextTitle: string) => {
    setIsBusy(true);
    try {
      const { payload, updatedRow } = await materializeRowForCloud(row, { title: nextTitle });
      persistRow(row, updatedRow);
      onCloudSaveExam?.(payload);
      onRefreshAll();
      toast({
        title: 'Renamed test',
        description: `"${nextTitle}"`,
        status: 'success',
        duration: 1800,
        isClosable: true,
        position: 'bottom-right',
      });
    } catch (err) {
      toast({
        title: 'Rename failed',
        description: err instanceof Error ? err.message : undefined,
        status: 'error',
        duration: 2500,
        isClosable: true,
        position: 'bottom-right',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleMoveSingleTest = async (row: UnifiedTestRow, nextCollection: string) => {
    setIsBusy(true);
    try {
      const { payload, updatedRow } = await materializeRowForCloud(row, {
        collection: nextCollection,
      });
      persistRow(row, updatedRow);
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
    } catch (err) {
      toast({
        title: 'Failed to move test',
        description: err instanceof Error ? err.message : undefined,
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
    const visibleSelected = filteredAndSortedRows.filter((r) => selectedKeys.has(r.key));
    const target = bulkMoveTarget || collections[0]?.name;
    if (!target || visibleSelected.length === 0) return;

    setIsBusy(true);
    try {
      const cloudItems: CloudExamPayload[] = [];
      for (const row of visibleSelected) {
        const { payload, updatedRow } = await materializeRowForCloud(row, { collection: target });
        persistRow(row, updatedRow);
        cloudItems.push(payload);
      }
      onCloudBulkMoveExams?.(target, cloudItems);
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const r of visibleSelected) next.delete(r.key);
        return next;
      });
      onRefreshAll();
      toast({
        title: `Moved ${cloudItems.length} test(s)`,
        description: `Destination: ${target}`,
        status: 'success',
        duration: 2400,
        isClosable: true,
        position: 'bottom-right',
      });
    } catch (err) {
      toast({
        title: 'Bulk move failed',
        description: err instanceof Error ? err.message : undefined,
        status: 'error',
        duration: 2500,
        isClosable: true,
        position: 'bottom-right',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleBulkExport = async (rowsToExport: UnifiedTestRow[]) => {
    if (rowsToExport.length === 0) return;
    setIsBusy(true);
    try {
      const tests: unknown[] = [];
      for (const row of rowsToExport) {
        if (row.rawExam) {
          const full = (await loadFullExam(row.rawExam)) ?? row.rawExam;
          tests.push(full);
        } else if (row.rawWriting) {
          tests.push(row.rawWriting);
        } else if (row.rawSpeaking) {
          tests.push(row.rawSpeaking);
        }
      }
      exportJsonBlob(`pno_ielts_bundle_${tests.length}_tests.json`, {
        version: 1,
        exportedAt: new Date().toISOString(),
        tests,
      });
      toast({
        title: `Exported ${tests.length} test(s)`,
        status: 'success',
        duration: 2000,
        isClosable: true,
        position: 'bottom-right',
      });
    } catch {
      toast({
        title: 'Bulk export failed',
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
    } catch (err) {
      toast({
        title: 'Unable to duplicate test',
        description: err instanceof Error ? err.message : undefined,
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
        const cleanTitle = (payload.title || 'ielts-test').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        exportJsonBlob(`${cleanTitle}.json`, payload);
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

  const handleImportJsonFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsBusy(true);

    let totalImported = 0;
    const defaultCol = collectionFilter !== 'all' ? collectionFilter : 'My Tests';

    try {
      for (const file of files) {
        const content = await file.text();
        const result = importTestsBundleFromJSON(content, defaultCol);

        for (const ex of result.exams) {
          onCloudSaveExam?.({
            examId: ex.id,
            skill: isListeningExam(ex) ? 'Listening' : 'Reading',
            title: ex.title,
            collection: getExamCollection(ex),
            data: ex as unknown as Record<string, unknown>,
          });
          totalImported++;
        }
        for (const w of result.writingExams) {
          onCloudSaveExam?.({
            examId: w.id,
            skill: 'Writing',
            title: w.title,
            collection: w.collection || defaultCol,
            data: w as unknown as Record<string, unknown>,
          });
          totalImported++;
        }
        for (const s of result.speakingExams) {
          onCloudSaveExam?.({
            examId: s.id,
            skill: 'Speaking',
            title: s.title,
            collection: s.collection || defaultCol,
            data: s as unknown as Record<string, unknown>,
          });
          totalImported++;
        }
      }

      onRefreshAll();
      toast({
        title: `Imported ${totalImported} test(s)`,
        description: `Saved to ${defaultCol} (unless specified in JSON).`,
        status: 'success',
        duration: 2600,
        isClosable: true,
        position: 'bottom-right',
      });
    } catch (err) {
      toast({
        title: 'Invalid JSON file',
        description: err instanceof Error ? err.message : 'Unable to parse JSON.',
        status: 'error',
        duration: 3200,
        isClosable: true,
        position: 'bottom-right',
      });
    } finally {
      setIsBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  function openCreateCollectionModal() {
    setColModalMode('create');
    setColEditOldName('');
    setColFormName('');
    setColFormDesc('');
    setColFormTouched(false);
    setColFormSubmitted(false);
  }

  function openEditCollectionModal(col: CollectionItem) {
    setColModalMode('edit');
    setColEditOldName(col.name);
    setColFormName(col.name);
    setColFormDesc(col.description || '');
    setColFormTouched(false);
    setColFormSubmitted(false);
  }

  const trimmedColName = colFormName.trim();
  const colDuplicate = useMemo(() => {
    if (!trimmedColName || !colModalMode) return false;
    const lower = trimmedColName.toLowerCase();
    if (colModalMode === 'edit' && lower === colEditOldName.trim().toLowerCase()) {
      return false;
    }
    return collections.some((c) => c.name.toLowerCase() === lower);
  }, [trimmedColName, colModalMode, colEditOldName, collections]);

  const colValidationError = !trimmedColName
    ? 'Collection name cannot be empty.'
    : colDuplicate
      ? `Collection "${trimmedColName}" already exists.`
      : '';
  const showColValidationError = Boolean(
    colValidationError && (colFormTouched || colFormSubmitted)
  );

  const handleSubmitCollectionModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setColFormSubmitted(true);
    if (colValidationError) return;

    const newName = trimmedColName;
    const desc = colFormDesc.trim();
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
            const { payload, updatedRow } = await materializeRowForCloud(row, {
              collection: newName,
            });
            persistRow(row, updatedRow);
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
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const r of confirmAction.rows) next.delete(r.key);
        return next;
      });
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

  const activeCollectionDefault =
    collectionFilter !== 'all' ? collectionFilter : undefined;

  return (
    <Stack spacing={5}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => void handleImportJsonFiles(e)}
      />

      {/* Top Studio Header — Smart Add Test promoted to #1 Primary CTA */}
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
            Smart Add parses text into editable tests with images, audio &amp; video — or manage existing items inline below.
          </Text>
        </Stack>

        <HStack spacing={2} flexWrap="wrap">
          <Button
            size="sm"
            colorScheme="blue"
            rounded="xl"
            leftIcon={<IconSparkles size={16} />}
            onClick={() => onOpenSmartImport(activeCollectionDefault)}
            isDisabled={isBusy}
          >
            Smart Add Test
          </Button>

          <Menu placement="bottom-end">
            <MenuButton
              as={Button}
              size="sm"
              variant="outline"
              rounded="xl"
              leftIcon={<IconPlus size={16} />}
              rightIcon={<IconChevronDown size={14} />}
              isDisabled={isBusy}
            >
              Manual / Import
            </MenuButton>
            <MenuList minW="250px" zIndex={40}>
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
                icon={<IconUpload size={16} />}
                onClick={() => fileInputRef.current?.click()}
              >
                Import JSON / Bundle (.json)
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

      {/* Sub-Tabs: Tests | Collections (URL-synced) */}
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
          onClick={() => onSubTabChange('tests')}
        >
          Tests ({allRows.length})
        </Button>
        <Button
          size="sm"
          rounded="lg"
          fontWeight={700}
          variant={subTab === 'collections' ? 'solid' : 'ghost'}
          colorScheme={subTab === 'collections' ? 'blue' : 'gray'}
          onClick={() => onSubTabChange('collections')}
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
            align={{ base: 'stretch', xl: 'center' }}
            direction={{ base: 'column', xl: 'row' }}
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

            <HStack spacing={2} flexWrap="wrap">
              <Select
                size="sm"
                w={{ base: 'full', sm: '130px' }}
                rounded="xl"
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value as OriginFilter)}
                aria-label="Filter by origin"
              >
                <option value="all">All Sources</option>
                <option value="custom">Custom Only</option>
                <option value="builtin">Built-in Only</option>
              </Select>

              <Select
                size="sm"
                w={{ base: 'full', sm: '195px' }}
                rounded="xl"
                value={collectionFilter}
                onChange={(e) => setCollectionFilter(e.target.value)}
                aria-label="Filter by collection"
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

              <InputGroup size="sm" w={{ base: 'full', sm: '220px' }}>
                <InputLeftElement pointerEvents="none" color="gray.400">
                  <IconSearch size={15} />
                </InputLeftElement>
                <Input
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  placeholder="Search title or collection..."
                  rounded="xl"
                />
                {searchQuery && (
                  <InputRightElement>
                    <IconButton
                      size="xs"
                      variant="ghost"
                      aria-label="Clear search"
                      icon={<IconX size={13} />}
                      onClick={() => onSearchQueryChange('')}
                    />
                  </InputRightElement>
                )}
              </InputGroup>

              {hasActiveFilters && (
                <Button size="xs" variant="ghost" colorScheme="blue" onClick={resetFilters}>
                  Reset
                </Button>
              )}
            </HStack>
          </Flex>

          <ManageTestsTable
            rows={filteredAndSortedRows}
            totalRowsCount={allRows.length}
            collections={collections}
            selectedKeys={selectedKeys}
            sortField={sortField}
            sortDirection={sortDirection}
            bulkMoveTarget={bulkMoveTarget}
            isBusy={isBusy}
            onSortChange={handleSortChange}
            onToggleRow={toggleRowSelection}
            onToggleSelectAllVisible={toggleSelectAllVisible}
            onClearSelection={() => setSelectedKeys(new Set())}
            onBulkMoveTargetChange={setBulkMoveTarget}
            onBulkMove={() => void handleBulkMove()}
            onBulkExport={(rowsToExport) => void handleBulkExport(rowsToExport)}
            onBulkDelete={(rowsToDelete) =>
              setConfirmAction({ type: 'bulk_delete', rows: rowsToDelete })
            }
            onMoveSingleTest={(row, col) => void handleMoveSingleTest(row, col)}
            onQuickRenameTest={(row, title) => void handleQuickRenameTest(row, title)}
            onPreviewTest={onPreviewTest}
            onEditTest={(row) => {
              if (row.rawExam) onEditExam(row.rawExam);
              else if (row.rawWriting) onEditWriting(row.rawWriting);
              else if (row.rawSpeaking) onEditSpeaking(row.rawSpeaking);
            }}
            onDuplicateTest={(row) => void handleDuplicateTest(row)}
            onExportTest={(row) => void handleExportTest(row)}
            onDeleteTest={(row) => setConfirmAction({ type: 'delete_test', row })}
            onCreateNew={() => onOpenSmartImport(activeCollectionDefault)}
            onResetFilters={resetFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </Stack>
      )}

      {/* SUB-TAB 2: COLLECTIONS CRUD */}
      {subTab === 'collections' && (
        <ManageCollectionsGrid
          collections={collections}
          allRows={allRows}
          onViewTests={(colName) => {
            setCollectionFilter(colName);
            onSubTabChange('tests');
          }}
          onSmartAddToCollection={(colName) => onOpenSmartImport(colName)}
          onEditCollection={openEditCollectionModal}
          onDeleteCollection={(name, matchingRows) =>
            setConfirmAction({
              type: 'delete_collection',
              name,
              totalCount: matchingRows.length,
              rows: matchingRows,
            })
          }
          onNewCollection={openCreateCollectionModal}
        />
      )}

      {/* Create / Edit Collection Modal (with validate-input-after-interaction) */}
      <Modal isOpen={colModalMode !== null} onClose={() => setColModalMode(null)} isCentered>
        <ModalOverlay />
        <ModalContent>
          <form onSubmit={(e) => void handleSubmitCollectionModal(e)} noValidate>
            <ModalHeader fontFamily={outfit.style.fontFamily}>
              {colModalMode === 'edit' ? 'Edit Collection' : 'New Collection'}
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Stack spacing={4}>
                <FormControl isInvalid={showColValidationError}>
                  <FormLabel fontSize="xs" fontWeight={700} mb={1}>
                    Collection Name
                  </FormLabel>
                  <Input
                    required
                    value={colFormName}
                    onChange={(e) => setColFormName(e.target.value)}
                    onBlur={() => setColFormTouched(true)}
                    placeholder="e.g. Cambridge 21, Mock Pack..."
                    rounded="xl"
                    aria-invalid={showColValidationError ? 'true' : 'false'}
                    aria-describedby={showColValidationError ? colNameErrorId : undefined}
                    autoFocus
                  />
                  {showColValidationError && (
                    <FormErrorMessage id={colNameErrorId} fontSize="xs">
                      {colValidationError}
                    </FormErrorMessage>
                  )}
                </FormControl>

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
              <Button
                type="submit"
                colorScheme="blue"
                rounded="xl"
                isLoading={isBusy}
                isDisabled={Boolean(colValidationError)}
              >
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
