import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type FC,
  type ChangeEvent,
} from 'react';
import { outfit } from '@pno/lib/chakra-theme';
import type { Exam } from '../../types/exam';
import type { WritingExam } from '../../types/writing';
import type { SpeakingExam } from '../../types/speaking';
import {
  saveExam,
  getAllCollections,
  getExamCollection,
  ensureCollectionExists,
} from '../../utils/storage';
import { saveWritingExam } from '../../data/writingExams';
import { saveSpeakingExam } from '../../data/speakingExams';
import {
  parseUnifiedSmartText,
  IELTS_QUESTION_PATTERNS,
  UNIFIED_AI_PROMPT,
  UNIFIED_FORMAT_GUIDE,
  UNIFIED_SAMPLE_TEMPLATE,
  type ParsedSmartTestItem,
  type SmartMediaSlot,
  type UnifiedSmartParseResult,
} from '../../utils/textParser';
import { uploadMediaFile } from '../../utils/mediaUploader';
import { MediaEmbed } from '../exam/MediaEmbed';
import {
  Upload,
  FileText,
  Edit3,
  Copy,
  Check,
  Sparkles,
  X,
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Headphones,
  PenTool,
  Mic,
  Music,
  Loader2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Video,
  FolderPlus,
  Trash2,
  Wand2,
} from 'lucide-react';

export type SmartImportSkill = 'reading' | 'listening' | 'writing' | 'speaking';

export interface SmartBatchImportPayload {
  exams: Exam[];
  writingExams: WritingExam[];
  speakingExams: SpeakingExam[];
  action: 'save_only' | 'edit';
}

interface SmartImportModalProps {
  isOpen: boolean;
  initialCollection?: string;
  defaultSkill?: SmartImportSkill;
  onClose: () => void;
  onImportSuccess: (exam: Exam, action: 'save_only' | 'take_test' | 'edit') => void;
  onOpenManualEditor: (skill: 'reading' | 'listening', collection?: string) => void;
  onWritingImportSuccess?: (exam: WritingExam, action?: 'save_only' | 'edit') => void;
  onSpeakingImportSuccess?: (exam: SpeakingExam, action?: 'save_only' | 'edit') => void;
  onBatchImportSuccess?: (payload: SmartBatchImportPayload) => void;
  onOpenWritingEditor?: (exam?: WritingExam | null, collection?: string) => void;
  onOpenSpeakingEditor?: (exam?: SpeakingExam | null, collection?: string) => void;
  onCloudCreateCollection?: (col: { name: string; description?: string }) => void;
}

const SKILL_META: Record<
  SmartImportSkill,
  { label: string; icon: typeof BookOpen; pillClass: string }
> = {
  reading: {
    label: 'Reading',
    icon: BookOpen,
    pillClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
  },
  listening: {
    label: 'Listening',
    icon: Headphones,
    pillClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200',
  },
  writing: {
    label: 'Writing',
    icon: PenTool,
    pillClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
  },
  speaking: {
    label: 'Speaking',
    icon: Mic,
    pillClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  },
};

function buildParsedResultFromJson(parsed: unknown): UnifiedSmartParseResult {
  const tests: ParsedSmartTestItem[] = [];
  const mediaSlots: SmartMediaSlot[] = [];
  let detectedCollection = '';

  const pushReadingOrListening = (rawExam: Exam, idx: number) => {
    const isListening =
      rawExam.category?.toLowerCase().includes('listening') ||
      (rawExam.parts || []).some(
        (p) => Boolean(p.audioUrl) || p.title?.toLowerCase().includes('section')
      );
    const skill: 'reading' | 'listening' = isListening ? 'listening' : 'reading';
    const col = getExamCollection(rawExam);
    if (col && col !== 'My Tests' && !detectedCollection) detectedCollection = col;

    const totalQuestions = (rawExam.parts || []).reduce(
      (acc, p) => acc + (p.questionGroups || []).reduce((ga, g) => ga + (g.questions || []).length, 0),
      0
    );
    const answeredQuestions = (rawExam.parts || []).reduce(
      (acc, p) =>
        acc +
        (p.questionGroups || []).reduce(
          (ga, g) =>
            ga +
            (g.questions || []).filter(
              (q) =>
                q.correctAnswer &&
                (Array.isArray(q.correctAnswer)
                  ? q.correctAnswer.length > 0
                  : String(q.correctAnswer).trim().length > 0)
            ).length,
          0
        ),
      0
    );

    tests.push({
      index: idx,
      skill,
      title: rawExam.title || 'Imported Test',
      collection: col || 'My Tests',
      exam: rawExam,
      errors: [],
      totalQuestions,
      answeredQuestions,
    });

    (rawExam.parts || []).forEach((part, partIndex) => {
      const partLabel = skill === 'listening' ? `Section ${part.partNumber}` : `Passage ${part.partNumber}`;
      if (skill === 'listening') {
        mediaSlots.push({
          key: `t${idx}-p${partIndex}-audio`,
          testIndex: idx,
          skill,
          testTitle: rawExam.title,
          kind: 'audio',
          target: { type: 'exam_part', partIndex, partLabel },
          label: `${rawExam.title} · ${partLabel} Audio`,
          hint: 'Upload .mp3 / .m4a / .wav audio',
          currentUrl: part.audioUrl || '',
          required: true,
        });
      }
      if (part.imageUrl) {
        mediaSlots.push({
          key: `t${idx}-p${partIndex}-img`,
          testIndex: idx,
          skill,
          testTitle: rawExam.title,
          kind: 'image',
          target: { type: 'exam_part', partIndex, partLabel },
          label: `${rawExam.title} · ${partLabel} Image`,
          currentUrl: part.imageUrl,
          required: false,
        });
      }
    });
  };

  const pushWriting = (w: WritingExam, idx: number) => {
    if (w.collection && w.collection !== 'My Tests' && !detectedCollection) {
      detectedCollection = w.collection;
    }
    tests.push({
      index: idx,
      skill: 'writing',
      title: w.title || 'Imported Writing Test',
      collection: w.collection || 'My Tests',
      exam: w,
      errors: [],
    });
    mediaSlots.push({
      key: `t${idx}-writing-t1-img`,
      testIndex: idx,
      skill: 'writing',
      testTitle: w.title || 'Writing Test',
      kind: 'image',
      target: { type: 'writing_task1', label: 'Task 1 Chart / Diagram' },
      label: `${w.title || 'Writing'} · Task 1 Image`,
      hint: 'Chart, graph, table, map, or process diagram (optional)',
      currentUrl: w.task1.imageUrl || '',
      required: false,
    });
  };

  const pushSpeaking = (s: SpeakingExam, idx: number) => {
    if (s.collection && s.collection !== 'My Tests' && !detectedCollection) {
      detectedCollection = s.collection;
    }
    tests.push({
      index: idx,
      skill: 'speaking',
      title: s.title || 'Imported Speaking Test',
      collection: s.collection || 'My Tests',
      exam: s,
      errors: [],
    });
  };

  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (
      Array.isArray(obj.exams) ||
      Array.isArray(obj.writingExams) ||
      Array.isArray(obj.speakingExams)
    ) {
      let idx = 0;
      if (Array.isArray(obj.exams)) {
        (obj.exams as Exam[]).forEach((ex) => pushReadingOrListening(ex, idx++));
      }
      if (Array.isArray(obj.writingExams)) {
        (obj.writingExams as WritingExam[]).forEach((w) => pushWriting(w, idx++));
      }
      if (Array.isArray(obj.speakingExams)) {
        (obj.speakingExams as SpeakingExam[]).forEach((s) => pushSpeaking(s, idx++));
      }
    } else if (obj.task1 && obj.task2) {
      pushWriting(parsed as WritingExam, 0);
    } else if (obj.part1Questions && obj.part2Question) {
      pushSpeaking(parsed as SpeakingExam, 0);
    } else if (typeof obj.title === 'string' && Array.isArray(obj.parts)) {
      pushReadingOrListening(parsed as Exam, 0);
    }
  }

  return {
    collection: detectedCollection,
    hasExplicitCollection: Boolean(detectedCollection),
    tests,
    mediaSlots,
    errors: tests.length === 0 ? ['JSON file is missing valid exam structure.'] : [],
  };
}

function applyMediaOverridesToTests(
  parsed: UnifiedSmartParseResult,
  mediaOverrides: Record<string, string>,
  finalCollection: string
): {
  exams: Exam[];
  writingExams: WritingExam[];
  speakingExams: SpeakingExam[];
} {
  const exams: Exam[] = [];
  const writingExams: WritingExam[] = [];
  const speakingExams: SpeakingExam[] = [];

  for (const item of parsed.tests) {
    if (item.errors.length > 0) continue;
    const itemSlots = parsed.mediaSlots.filter((s) => s.testIndex === item.index);

    if (item.skill === 'reading' || item.skill === 'listening') {
      const clonedParts = item.exam.parts.map((part, partIdx) => {
        let nextAudio = part.audioUrl || '';
        let nextImg = part.imageUrl || '';
        let nextVid = part.videoUrl || '';

        const clonedGroups = (part.questionGroups || []).map((g, gIdx) => {
          let gImg = g.imageUrl || '';
          const groupSlot = itemSlots.find(
            (s) =>
              s.target.type === 'exam_group' &&
              s.target.partIndex === partIdx &&
              s.target.groupIndex === gIdx
          );
          if (groupSlot && mediaOverrides[groupSlot.key] !== undefined) {
            gImg = mediaOverrides[groupSlot.key]!;
          }
          return { ...g, imageUrl: gImg || undefined };
        });

        for (const s of itemSlots) {
          if (s.target.type === 'exam_part' && s.target.partIndex === partIdx) {
            const val = mediaOverrides[s.key];
            if (val !== undefined) {
              if (s.kind === 'audio') nextAudio = val;
              else if (s.kind === 'image') nextImg = val;
              else if (s.kind === 'video') nextVid = val;
            }
          }
        }

        return {
          ...part,
          audioUrl: nextAudio,
          imageUrl: nextImg || undefined,
          videoUrl: nextVid || undefined,
          questionGroups: clonedGroups,
        };
      });

      exams.push({
        ...item.exam,
        collection: finalCollection,
        parts: clonedParts,
      });
    } else if (item.skill === 'writing') {
      const imgSlot = itemSlots.find((s) => s.target.type === 'writing_task1');
      const nextImg =
        imgSlot && mediaOverrides[imgSlot.key] !== undefined
          ? mediaOverrides[imgSlot.key]
          : item.exam.task1.imageUrl;

      writingExams.push({
        ...item.exam,
        collection: finalCollection,
        task1: {
          ...item.exam.task1,
          imageUrl: nextImg || undefined,
        },
      });
    } else if (item.skill === 'speaking' && item.exam) {
      const imgSlot = itemSlots.find(
        (s) => s.target.type === 'speaking_part2' && s.kind === 'image'
      );
      const vidSlot = itemSlots.find(
        (s) => s.target.type === 'speaking_part2' && s.kind === 'video'
      );
      const nextImg =
        imgSlot && mediaOverrides[imgSlot.key] !== undefined
          ? mediaOverrides[imgSlot.key]
          : item.exam.part2Question.imageUrl;
      const nextVid =
        vidSlot && mediaOverrides[vidSlot.key] !== undefined
          ? mediaOverrides[vidSlot.key]
          : item.exam.part2Question.videoUrl;

      speakingExams.push({
        ...item.exam,
        collection: finalCollection,
        part2Question: {
          ...item.exam.part2Question,
          imageUrl: nextImg || undefined,
          videoUrl: nextVid || undefined,
        },
      });
    }
  }

  return { exams, writingExams, speakingExams };
}

export const SmartImportModal: FC<SmartImportModalProps> = ({
  isOpen,
  initialCollection,
  defaultSkill = 'reading',
  onClose,
  onImportSuccess,
  onOpenManualEditor,
  onWritingImportSuccess,
  onSpeakingImportSuccess,
  onBatchImportSuccess,
  onOpenWritingEditor,
  onOpenSpeakingEditor,
  onCloudCreateCollection,
}) => {
  const [txtContent, setTxtContent] = useState('');
  const [jsonResult, setJsonResult] = useState<UnifiedSmartParseResult | null>(null);
  const [jsonFileName, setJsonFileName] = useState<string | null>(null);
  const [mediaOverrides, setMediaOverrides] = useState<Record<string, string>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const [selectedCollection, setSelectedCollection] = useState<string>(
    initialCollection || 'My Tests'
  );
  const [hasUserPickedCollection, setHasUserPickedCollection] = useState<boolean>(
    Boolean(initialCollection)
  );
  const [showNewColInput, setShowNewColInput] = useState(false);
  const [newColDraft, setNewColDraft] = useState('');

  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showGuideDetails, setShowGuideDetails] = useState(false);
  const [copiedMode, setCopiedMode] = useState<'prompt' | 'template' | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showBlankMenu, setShowBlankMenu] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetAllState = useCallback(() => {
    setTxtContent('');
    setJsonResult(null);
    setJsonFileName(null);
    setMediaOverrides({});
    setUploadingKey(null);
    setErrorMsg(null);
    setShowCloseConfirm(false);
    setShowNewColInput(false);
    setNewColDraft('');
    setShowBlankMenu(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetAllState();
      setSelectedCollection(initialCollection || 'My Tests');
      setHasUserPickedCollection(Boolean(initialCollection));
    }
  }, [isOpen, initialCollection, resetAllState]);

  // Live parse text whenever txtContent changes
  const parsedResult: UnifiedSmartParseResult | null = useMemo(() => {
    if (jsonResult) return jsonResult;
    if (!txtContent.trim()) return null;
    return parseUnifiedSmartText(txtContent);
  }, [jsonResult, txtContent]);

  const listeningAudioSlotsByTest = useMemo(() => {
    if (!parsedResult) return new Map<number, SmartMediaSlot[]>();
    const map = new Map<number, SmartMediaSlot[]>();
    parsedResult.mediaSlots
      .filter((s) => s.kind === 'audio' && s.skill === 'listening')
      .forEach((s) => {
        const list = map.get(s.testIndex) || [];
        list.push(s);
        map.set(s.testIndex, list);
      });
    return map;
  }, [parsedResult]);

  // Auto-sync collection from parsed text unless user manually picked one
  useEffect(() => {
    if (!parsedResult) return;
    if (!hasUserPickedCollection && parsedResult.hasExplicitCollection && parsedResult.collection) {
      setSelectedCollection(parsedResult.collection);
    }
  }, [parsedResult, hasUserPickedCollection]);

  const hasUnsavedDraft = Boolean(txtContent.trim() || jsonResult);

  const requestClose = useCallback(() => {
    if (hasUnsavedDraft && !showCloseConfirm) {
      setShowCloseConfirm(true);
      return;
    }
    resetAllState();
    onClose();
  }, [hasUnsavedDraft, showCloseConfirm, resetAllState, onClose]);

  const ensureAndSyncCollection = useCallback(
    (colName: string): string => {
      const target = colName.trim() || 'My Tests';
      const { collection, created } = ensureCollectionExists(target);
      if (created) {
        onCloudCreateCollection?.(collection);
      }
      return collection.name;
    },
    [onCloudCreateCollection]
  );

  // Esc key handler
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showCloseConfirm) {
          setShowCloseConfirm(false);
        } else {
          requestClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, showCloseConfirm, requestClose]);

  // Upload media for a specific slot (or all listening audio slots)
  const handleUploadSlotMedia = async (file: File, slot: SmartMediaSlot) => {
    setUploadingKey(slot.key);
    setErrorMsg(null);
    try {
      const testObj = parsedResult?.tests[slot.testIndex];
      const testId =
        (testObj && 'exam' in testObj && testObj.exam?.id) || `${slot.skill}_${Date.now()}`;
      const res = await uploadMediaFile(file, slot.skill, testId);
      setMediaOverrides((prev) => ({ ...prev, [slot.key]: res.url }));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload media file.');
    } finally {
      setUploadingKey(null);
    }
  };

  const handleUploadBulkListeningAudio = async (file: File, audioSlots: SmartMediaSlot[]) => {
    if (audioSlots.length === 0) return;
    setUploadingKey('bulk-listening-audio');
    setErrorMsg(null);
    try {
      const first = audioSlots[0]!;
      const testObj = parsedResult?.tests[first.testIndex];
      const testId =
        (testObj && 'exam' in testObj && testObj.exam?.id) || `listening_${Date.now()}`;
      const res = await uploadMediaFile(file, 'listening', testId);
      setMediaOverrides((prev) => {
        const next = { ...prev };
        audioSlots.forEach((s) => {
          next[s.key] = res.url;
        });
        return next;
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload audio file.');
    } finally {
      setUploadingKey(null);
    }
  };

  // Clipboard image paste (Ctrl+V) fills the first empty image slot when parsed
  useEffect(() => {
    if (!isOpen || !parsedResult) return;
    const imageSlots = parsedResult.mediaSlots.filter((s) => s.kind === 'image');
    if (imageSlots.length === 0) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          const targetSlot =
            imageSlots.find((s) => !(mediaOverrides[s.key] ?? s.currentUrl)) || imageSlots[0]!;
          e.preventDefault();
          await handleUploadSlotMedia(file, targetSlot);
          break;
        }
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      void handlePaste(e);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, parsedResult, mediaOverrides]);

  if (!isOpen) return null;

  const collections = getAllCollections();
  const collectionExistsInList = collections.some(
    (c) => c.name.toLowerCase() === selectedCollection.toLowerCase()
  );

  const validTests = parsedResult ? parsedResult.tests.filter((t) => t.errors.length === 0) : [];
  const invalidTests = parsedResult ? parsedResult.tests.filter((t) => t.errors.length > 0) : [];
  const canSave = validTests.length > 0 && invalidTests.length === 0;

  // Process dropped or browsed .txt / .json file
  const processFiles = async (files: FileList | File[]) => {
    const file = files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setMediaOverrides({});

    const lower = file.name.toLowerCase();
    try {
      const text = await file.text();
      if (lower.endsWith('.json')) {
        const parsedJson: unknown = JSON.parse(text);
        const result = buildParsedResultFromJson(parsedJson);
        if (result.errors.length > 0) {
          throw new Error(result.errors[0]);
        }
        setJsonResult(result);
        setJsonFileName(file.name);
        setTxtContent('');
      } else if (lower.endsWith('.txt') || lower.endsWith('.md')) {
        setJsonResult(null);
        setJsonFileName(null);
        setTxtContent(text);
      } else {
        throw new Error('Only .txt, .md, or .json files are supported.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not read file.');
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void processFiles(e.target.files);
    }
  };

  const handleCreateInlineCollection = () => {
    const trimmed = newColDraft.trim();
    if (!trimmed) return;
    const synced = ensureAndSyncCollection(trimmed);
    setSelectedCollection(synced);
    setHasUserPickedCollection(true);
    setNewColDraft('');
    setShowNewColInput(false);
  };

  const handleCopy = async (mode: 'prompt' | 'template') => {
    const text = mode === 'prompt' ? UNIFIED_AI_PROMPT : UNIFIED_SAMPLE_TEMPLATE;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMode(mode);
      setTimeout(() => setCopiedMode(null), 2000);
    } catch {
      // Clipboard blocked
    }
  };

  const handleSave = (action: 'save_only' | 'edit') => {
    if (!parsedResult || !canSave) return;
    setErrorMsg(null);

    const finalCol = ensureAndSyncCollection(selectedCollection);
    const { exams, writingExams, speakingExams } = applyMediaOverridesToTests(
      parsedResult,
      mediaOverrides,
      finalCol
    );

    const totalSaved = exams.length + writingExams.length + speakingExams.length;
    if (totalSaved === 0) {
      setErrorMsg('No valid tests found to save.');
      return;
    }

    // Persist locally
    exams.forEach((ex) => saveExam(ex));
    writingExams.forEach((w) => saveWritingExam(w));
    speakingExams.forEach((s) => saveSpeakingExam(s));

    // If multi-test batch or caller supports batch sync, use onBatchImportSuccess
    if (totalSaved > 1 && onBatchImportSuccess) {
      resetAllState();
      onBatchImportSuccess({ exams, writingExams, speakingExams, action });
      onClose();
      return;
    }

    // Single test path (or fallback if onBatchImportSuccess wasn't provided)
    if (totalSaved === 1) {
      if (exams.length === 1) {
        const saved = exams[0]!;
        resetAllState();
        onImportSuccess(saved, action);
        onClose();
        return;
      }
      if (writingExams.length === 1) {
        const saved = writingExams[0]!;
        resetAllState();
        onWritingImportSuccess?.(saved, action);
        if (action === 'edit' && onOpenWritingEditor) {
          onOpenWritingEditor(saved, finalCol);
        }
        onClose();
        return;
      }
      if (speakingExams.length === 1) {
        const saved = speakingExams[0]!;
        resetAllState();
        onSpeakingImportSuccess?.(saved, action);
        if (action === 'edit' && onOpenSpeakingEditor) {
          onOpenSpeakingEditor(saved, finalCol);
        }
        onClose();
        return;
      }
    }

    // Fallback multi-test save if onBatchImportSuccess wasn't passed
    exams.forEach((ex) => onImportSuccess(ex, 'save_only'));
    writingExams.forEach((w) => onWritingImportSuccess?.(w, 'save_only'));
    speakingExams.forEach((s) => onSpeakingImportSuccess?.(s, 'save_only'));
    resetAllState();
    onClose();
  };

  const openBlankEditorFor = (skill: SmartImportSkill) => {
    const col = ensureAndSyncCollection(selectedCollection);
    resetAllState();
    if (skill === 'writing') {
      onOpenWritingEditor?.(null, col);
    } else if (skill === 'speaking') {
      onOpenSpeakingEditor?.(null, col);
    } else {
      onOpenManualEditor(skill, col);
    }
    onClose();
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDragOver) setIsDragOver(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          void processFiles(e.dataTransfer.files);
        }
      }}
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 font-sans"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="smart-import-title"
        className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 text-slate-900 dark:text-gray-100 relative"
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="smart-import-title"
                className="text-lg font-extrabold text-gray-900 dark:text-gray-100 leading-tight"
                style={{ fontFamily: outfit.style.fontFamily }}
              >
                Smart Add Test
              </h3>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
                Paste text or drop .txt / .json · Auto-detects collection, skills &amp; full tests · Attach audio &amp; images inline
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition shrink-0"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Scrollable Body ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5 text-red-800 dark:text-red-200 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <div className="flex-1 font-semibold leading-relaxed">{errorMsg}</div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-red-500 hover:text-red-700 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ── 1. SINGLE UNIFIED PASTE / DROP INPUT ─────────────────────────── */}
          <div
            className={`rounded-2xl border-2 transition-all p-3.5 space-y-2.5 ${
              isDragOver
                ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40'
                : 'border-gray-200 dark:border-gray-700 bg-slate-50/70 dark:bg-gray-900/50'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200">
                  Paste Unified Content or Drop File (.txt / .json)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => {
                    setJsonResult(null);
                    setJsonFileName(null);
                    setMediaOverrides({});
                    setTxtContent(UNIFIED_SAMPLE_TEMPLATE);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-1 transition"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>Insert Sample</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 text-[11px] font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center gap-1 transition"
                >
                  <Upload className="w-3 h-3" />
                  <span>Browse File</span>
                </button>
                {(txtContent.trim() || jsonResult) && (
                  <button
                    type="button"
                    onClick={resetAllState}
                    className="px-2 py-1 text-[11px] font-bold text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 flex items-center gap-1 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            {jsonResult ? (
              <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-gray-900 dark:text-gray-100 truncate">
                      Loaded JSON: {jsonFileName}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      Detected {jsonResult.tests.length} test(s) · Clear to switch back to text paste
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetAllState}
                  className="px-3 py-1.5 text-xs font-bold bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="relative">
                <textarea
                  value={txtContent}
                  onChange={(e) => {
                    setTxtContent(e.target.value);
                    setErrorMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canSave) {
                      e.preventDefault();
                      handleSave('save_only');
                    }
                  }}
                  rows={9}
                  spellCheck={false}
                  placeholder={`Paste 1 test or an entire Full Test here (or drag & drop a .txt / .json file).\nSupports [COLLECTION], [TEST], [SKILL], [IMAGE: ...], [AUDIO: ...] — skill, collection & required media are detected automatically!`}
                  className="w-full font-mono text-xs p-3.5 bg-white dark:bg-gray-950 text-slate-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-blue-600 leading-relaxed resize-y"
                />
                {txtContent.length > 0 && (
                  <div className="absolute bottom-2.5 right-3 text-[10px] font-bold text-slate-500 dark:text-gray-400 bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded-lg pointer-events-none">
                    {txtContent.length.toLocaleString()} chars
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 2. AUTO-DETECTED SUMMARY & MEDIA CHECKLIST ──────────────────── */}
          {parsedResult && (
            <div className="space-y-3.5 animate-in fade-in">
              {/* Collection bar */}
              <div className="px-4 py-3 rounded-2xl bg-slate-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300">
                    Collection:
                  </span>
                  <select
                    value={selectedCollection}
                    onChange={(e) => {
                      setSelectedCollection(e.target.value);
                      setHasUserPickedCollection(true);
                    }}
                    className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1 text-xs text-gray-900 dark:text-gray-100 font-bold outline-none focus:border-blue-600 cursor-pointer"
                  >
                    {!collectionExistsInList && selectedCollection && (
                      <option value={selectedCollection}>
                        {selectedCollection} (New collection)
                      </option>
                    )}
                    {collections.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {!collectionExistsInList && selectedCollection && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                      Auto-creates &ldquo;{selectedCollection}&rdquo;
                    </span>
                  )}

                  {showNewColInput ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newColDraft}
                        onChange={(e) => setNewColDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateInlineCollection();
                          }
                        }}
                        placeholder="New collection name..."
                        className="px-2 py-1 text-xs rounded-lg border border-blue-400 bg-white dark:bg-gray-800 outline-none w-36"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleCreateInlineCollection}
                        className="px-2 py-1 text-xs font-bold bg-blue-600 text-white rounded-lg"
                      >
                        Set
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewColInput(false);
                          setNewColDraft('');
                        }}
                        className="px-1.5 py-1 text-xs text-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowNewColInput(true)}
                      className="px-2 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg flex items-center gap-1 transition"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>New</span>
                    </button>
                  )}
                </div>

                <div className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                  Detected{' '}
                  <span className="text-blue-600 dark:text-blue-400">
                    {parsedResult.tests.length}
                  </span>{' '}
                  {parsedResult.tests.length === 1 ? 'test' : 'tests'}
                </div>
              </div>

              {/* Top-level parser errors */}
              {parsedResult.errors.length > 0 && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-800 dark:text-red-200 space-y-1">
                  {parsedResult.errors.map((err, i) => (
                    <div key={i} className="font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Detected Test Cards */}
              {parsedResult.tests.length > 0 && (
                <div
                  className={`grid gap-2.5 ${
                    parsedResult.tests.length === 1
                      ? 'grid-cols-1'
                      : parsedResult.tests.length === 2
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  }`}
                >
                  {parsedResult.tests.map((item) => {
                    const meta = SKILL_META[item.skill];
                    const Icon = meta.icon;
                    const testMediaSlots = parsedResult.mediaSlots.filter(
                      (s) => s.testIndex === item.index
                    );
                    const missingRequiredMedia = testMediaSlots.filter(
                      (s) => s.required && !(mediaOverrides[s.key] ?? s.currentUrl)
                    );
                    const hasError = item.errors.length > 0;

                    return (
                      <div
                        key={item.index}
                        className={`p-3.5 rounded-2xl border-2 space-y-2 ${
                          hasError
                            ? 'bg-red-50/70 dark:bg-red-950/30 border-red-300 dark:border-red-800'
                            : 'bg-white dark:bg-gray-800/90 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${meta.pillClass}`}
                          >
                            <Icon className="w-3 h-3" />
                            <span>{meta.label}</span>
                          </span>

                          {hasError ? (
                            <span className="text-[10px] font-extrabold text-red-600 dark:text-red-400">
                              Needs Fix
                            </span>
                          ) : missingRequiredMedia.length > 0 ? (
                            <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-md">
                              +{missingRequiredMedia.length} Media Needed
                            </span>
                          ) : (
                            <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-md">
                              Ready
                            </span>
                          )}
                        </div>

                        <div
                          className="text-xs font-extrabold text-gray-900 dark:text-gray-100 truncate"
                          title={item.title}
                        >
                          {item.title}
                        </div>

                        <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                          {(item.skill === 'reading' || item.skill === 'listening') && (
                            <>
                              {item.exam.parts.length}{' '}
                              {item.skill === 'listening' ? 'Sections' : 'Passages'} ·{' '}
                              {item.totalQuestions} Qs ·{' '}
                              <span
                                className={
                                  item.answeredQuestions < item.totalQuestions
                                    ? 'text-amber-600 dark:text-amber-400 font-bold'
                                    : 'text-emerald-600 dark:text-emerald-400 font-bold'
                                }
                              >
                                {item.answeredQuestions}/{item.totalQuestions} answered
                              </span>
                            </>
                          )}
                          {item.skill === 'writing' && (
                            <>
                              Task 1 ({item.exam.task1.chartType || 'report'}) + Task 2 Essay
                            </>
                          )}
                          {item.skill === 'speaking' && item.exam && (
                            <>
                              Part 1 ({item.exam.part1Questions.length} Qs) · Part 2 · Part 3 (
                              {item.exam.part3Questions.length} Qs)
                            </>
                          )}
                        </div>

                        {hasError && (
                          <ul className="text-[11px] text-red-700 dark:text-red-300 space-y-0.5 pt-1 list-disc list-inside">
                            {item.errors.slice(0, 3).map((e, idx) => (
                              <li key={idx} className="truncate" title={e}>
                                {e}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Dynamic Media Checklist */}
              {parsedResult.mediaSlots.length > 0 && (
                <div className="rounded-2xl border-2 border-amber-200/80 dark:border-amber-800/70 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-extrabold text-gray-900 dark:text-gray-100">
                        Media Attachments (TXT cannot carry files — attach audio &amp; images here)
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                      Tip: You can also press Ctrl+V to paste a screenshot into image slots
                    </span>
                  </div>

                  {/* Quick Apply 1 Audio to all sections if a Listening test has >1 audio slot */}
                  {Array.from(listeningAudioSlotsByTest.entries()).map(([testIdx, slots]) => {
                    if (slots.length <= 1) return null;
                    const testTitle = slots[0]?.testTitle || `Listening #${testIdx + 1}`;
                    return (
                      <div
                        key={`bulk-${testIdx}`}
                        className="p-2.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Music className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span className="font-bold text-indigo-950 dark:text-indigo-100">
                            {testTitle}: Have 1 full audio file for all {slots.length} sections?
                          </span>
                        </div>
                        <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition">
                          {uploadingKey === 'bulk-listening-audio' ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5" />
                              <span>Apply 1 Full Audio</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="audio/*,video/mp4"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleUploadBulkListeningAudio(f, slots);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    );
                  })}

                  <div className="space-y-2">
                    {parsedResult.mediaSlots.map((slot) => {
                      const activeUrl = mediaOverrides[slot.key] ?? slot.currentUrl ?? '';
                      const isBusy = uploadingKey === slot.key;
                      const SlotIcon =
                        slot.kind === 'audio' ? Music : slot.kind === 'video' ? Video : ImageIcon;
                      const acceptAttr =
                        slot.kind === 'audio'
                          ? 'audio/*,video/mp4'
                          : slot.kind === 'video'
                            ? 'video/*,audio/*'
                            : 'image/*';

                      return (
                        <div
                          key={slot.key}
                          className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <SlotIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-xs font-extrabold text-gray-900 dark:text-gray-100 truncate">
                                  {slot.label}
                                </div>
                                {slot.hint && (
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                    {slot.hint}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {activeUrl ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200">
                                  Attached
                                </span>
                              ) : slot.required ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200">
                                  Missing
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                  Optional
                                </span>
                              )}

                              <label className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition">
                                {isBusy ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Uploading...</span>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>
                                      {activeUrl ? 'Replace' : `Upload ${slot.kind}`}
                                    </span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept={acceptAttr}
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void handleUploadSlotMedia(f, slot);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={activeUrl}
                              onChange={(e) =>
                                setMediaOverrides((prev) => ({
                                  ...prev,
                                  [slot.key]: e.target.value,
                                }))
                              }
                              placeholder={`Or paste ${slot.kind} URL here...`}
                              className="flex-1 px-2.5 py-1.5 text-[11px] font-mono bg-slate-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                            />
                            {activeUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setMediaOverrides((prev) => ({ ...prev, [slot.key]: '' }))
                                }
                                className="p-1.5 text-gray-400 hover:text-red-500 transition"
                                title="Clear media"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {activeUrl && (
                            <MediaEmbed url={activeUrl} kindHint={slot.kind} compact />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 3. UNIFIED FORMAT GUIDE (ALWAYS BELOW) ──────────────────────── */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-slate-50/70 dark:bg-gray-900/50 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-extrabold text-gray-900 dark:text-gray-100">
                  Unified Format Guide (1 Format for All Skills &amp; Full Tests)
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  Use <code className="px-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">[COLLECTION]</code>,{' '}
                  <code className="px-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">[TEST]</code>,{' '}
                  <code className="px-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">[SKILL]</code>, and placeholders like{' '}
                  <code className="px-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">[AUDIO: ...]</code> /{' '}
                  <code className="px-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">[IMAGE: ...]</code>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy('prompt')}
                  className="px-2.5 py-1.5 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 transition"
                >
                  {copiedMode === 'prompt' ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedMode === 'prompt' ? 'Copied AI Prompt!' : 'Copy AI Prompt'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy('template')}
                  className="px-2.5 py-1.5 text-[11px] font-bold bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center gap-1.5 transition"
                >
                  {copiedMode === 'template' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedMode === 'template' ? 'Copied Template!' : 'Copy Template'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowGuideDetails((v) => !v)}
                  className="px-2.5 py-1.5 text-[11px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-gray-700 rounded-lg flex items-center gap-1 transition"
                >
                  <span>{showGuideDetails ? 'Hide Details' : 'Full Format Spec'}</span>
                  {showGuideDetails ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {showGuideDetails && (
              <div className="space-y-3 pt-1 animate-in fade-in">
                <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-72">
                  {UNIFIED_FORMAT_GUIDE}
                </pre>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {IELTS_QUESTION_PATTERNS.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold text-gray-900 dark:text-gray-100">
                          {p.englishName}
                        </span>
                        <code className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          [TYPE] {p.id}
                        </code>
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{p.syntax}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-wrap items-center justify-between gap-3 shrink-0 relative">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowBlankMenu((v) => !v)}
              className="px-3 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5 rounded-xl hover:bg-gray-200/70 dark:hover:bg-gray-800 transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Open Blank Editor</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showBlankMenu && (
              <div className="absolute bottom-11 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-1.5 w-44 z-20 space-y-0.5">
                {(['reading', 'listening', 'writing', 'speaking'] as const).map((sk) => (
                  <button
                    key={sk}
                    type="button"
                    onClick={() => openBlankEditorFor(sk)}
                    className={`w-full text-left px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${
                      defaultSkill === sk ? 'text-blue-600 dark:text-blue-400' : ''
                    }`}
                  >
                    <span>{SKILL_META[sk].label} Editor</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {validTests.length === 1 && canSave && (
              <button
                type="button"
                onClick={() => handleSave('edit')}
                className="px-4 py-2 text-xs font-extrabold rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 transition"
              >
                Save &amp; Open Editor
              </button>
            )}
            <button
              type="button"
              disabled={!canSave}
              onClick={() => handleSave('save_only')}
              className="px-5 py-2 text-xs font-extrabold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center gap-1.5 shadow-xs transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {validTests.length > 1
                  ? `Save All (${validTests.length} Tests)`
                  : 'Save Test'}
              </span>
            </button>
          </div>
        </div>

        {/* ── Unsaved Draft Confirmation Overlay ─────────────────────────────── */}
        {showCloseConfirm && (
          <div className="absolute inset-0 z-30 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                Discard pasted draft?
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                You have unsaved test content in Smart Add Test. Closing now will discard it.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCloseConfirm(false)}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetAllState();
                    onClose();
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700"
                >
                  Discard &amp; Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
