import {
  useState,
  useEffect,
  useRef,
  useCallback,
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
  parseIELTSText,
  parseWritingText,
  parseSpeakingText,
  detectSkillFromText,
  type SpeakingParseError,
  SAMPLE_TXT_TEMPLATE,
  SAMPLE_LISTENING_TXT_TEMPLATE,
  SAMPLE_WRITING_TXT_TEMPLATE,
  SAMPLE_SPEAKING_TXT_TEMPLATE,
  FULL_WRITING_PATTERN_SPEC,
  FULL_SPEAKING_PATTERN_SPEC,
  FULL_40_QUESTIONS_TXT_TEMPLATE,
  FULL_IELTS_PATTERN_SPEC,
} from '../../utils/textParser';
import { parseQuickKeyText, mergeKeysIntoExam } from '../../utils/keyMatcher';
import { uploadMediaFile } from '../../utils/mediaUploader';
import { MediaEmbed } from '../exam/MediaEmbed';
import {
  Upload,
  FileText,
  HelpCircle,
  Edit3,
  Copy,
  Check,
  Sparkles,
  X,
  AlertCircle,
  AlertTriangle,
  Play,
  BookOpen,
  Headphones,
  PenTool,
  Mic,
  Music,
  KeyRound,
  Loader2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Video,
  FolderPlus,
  Trash2,
} from 'lucide-react';

export type SmartImportSkill = 'reading' | 'listening' | 'writing' | 'speaking';

interface SmartImportModalProps {
  isOpen: boolean;
  initialCollection?: string;
  defaultSkill?: SmartImportSkill;
  onClose: () => void;
  onImportSuccess: (exam: Exam, action: 'save_only' | 'take_test' | 'edit') => void;
  onOpenManualEditor: (skill: 'reading' | 'listening', collection?: string) => void;
  onWritingImportSuccess?: (exam: WritingExam, action?: 'save_only' | 'edit') => void;
  onSpeakingImportSuccess?: (exam: SpeakingExam, action?: 'save_only' | 'edit') => void;
  onOpenWritingEditor?: (exam?: WritingExam | null, collection?: string) => void;
  onOpenSpeakingEditor?: (exam?: SpeakingExam | null, collection?: string) => void;
  onCloudCreateCollection?: (col: { name: string; description?: string }) => void;
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
  onOpenWritingEditor,
  onOpenSpeakingEditor,
  onCloudCreateCollection,
}) => {
  const [selectedSkill, setSelectedSkill] = useState<SmartImportSkill>(defaultSkill);
  const [autoDetectedInfo, setAutoDetectedInfo] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'txt_paste' | 'guide'>('txt_paste');
  const [txtContent, setTxtContent] = useState('');
  const [answerKeyText, setAnswerKeyText] = useState('');
  const [showKeyMatcher, setShowKeyMatcher] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [uploadingMediaKey, setUploadingMediaKey] = useState<string | null>(null);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [speakingValidationErrors, setSpeakingValidationErrors] = useState<SpeakingParseError[]>([]);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Previews
  const [successPreview, setSuccessPreview] = useState<Exam | null>(null);
  const [writingPreview, setWritingPreview] = useState<WritingExam | null>(null);
  const [speakingPreview, setSpeakingPreview] = useState<SpeakingExam | null>(null);
  const [activeMediaPartIdx, setActiveMediaPartIdx] = useState<number>(0);

  // Collection state (preserve user choice; support inline new collection)
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string>(initialCollection || 'My Tests');
  const [hasUserPickedCollection, setHasUserPickedCollection] = useState<boolean>(Boolean(initialCollection));
  const [showNewColInput, setShowNewColInput] = useState(false);
  const [newColDraft, setNewColDraft] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  const resetAllState = useCallback(
    (keepSkill?: SmartImportSkill) => {
      setSuccessPreview(null);
      setWritingPreview(null);
      setSpeakingPreview(null);
      setActiveMediaPartIdx(0);
      setErrorMsg(null);
      setWarningMsg(null);
      setSpeakingValidationErrors([]);
      setTxtContent('');
      setAnswerKeyText('');
      setShowKeyMatcher(false);
      setAudioNotice(null);
      setAutoDetectedInfo(null);
      setShowCloseConfirm(false);
      setShowNewColInput(false);
      setNewColDraft('');
      if (keepSkill) setSelectedSkill(keepSkill);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (audioFileInputRef.current) audioFileInputRef.current.value = '';
    },
    []
  );

  // Reset clean state each time modal opens
  useEffect(() => {
    if (isOpen) {
      resetAllState(defaultSkill || 'reading');
      setSelectedCollection(initialCollection || 'My Tests');
      setHasUserPickedCollection(Boolean(initialCollection));
      setActiveTab('txt_paste');
    }
  }, [isOpen, initialCollection, defaultSkill, resetAllState]);

  const hasUnsavedDraft = Boolean(
    txtContent.trim() || successPreview || writingPreview || speakingPreview
  );

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

  // Keyboard shortcuts: Esc to close (with unsaved check), Ctrl+Enter to Import & Edit
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

  // Clipboard image paste (Ctrl+V) when Preview card is open
  useEffect(() => {
    if (!isOpen) return;
    const hasPreview = Boolean(successPreview || writingPreview || speakingPreview);
    if (!hasPreview) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          e.preventDefault();
          await handleAttachMediaFile(
            file,
            'image',
            successPreview ? activeMediaPartIdx : undefined
          );
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, successPreview, writingPreview, speakingPreview, activeMediaPartIdx]);

  if (!isOpen) return null;

  const collections = getAllCollections();
  const collectionExistsInList = collections.some(
    (c) => c.name.toLowerCase() === selectedCollection.toLowerCase()
  );

  const speakingValidation =
    selectedSkill === 'speaking' && txtContent.trim()
      ? parseSpeakingText(txtContent)
      : null;
  const hasSpeakingValidationErrors = Boolean(
    speakingValidation && speakingValidation.errors.length > 0
  );
  const displayedSpeakingErrors =
    speakingValidation?.errors ?? speakingValidationErrors;

  const applyCollectionFromParsed = (parsedCol?: string) => {
    const trimmed = (parsedCol || '').trim();
    if (!hasUserPickedCollection && trimmed) {
      setSelectedCollection(trimmed);
      return trimmed;
    }
    return selectedCollection;
  };

  const applySpeakingParseResult = (text: string, collectionOverride?: string) => {
    const result = parseSpeakingText(text);
    setSpeakingValidationErrors(result.errors);
    if (!result.exam) {
      setSpeakingPreview(null);
      setActiveTab('txt_paste');
      return null;
    }
    const finalCol = collectionOverride ?? applyCollectionFromParsed(result.exam.collection);
    const exam = { ...result.exam, collection: finalCol };
    setSpeakingPreview(exam);
    return exam;
  };

  const maybeAutoDetectSkill = (raw: string) => {
    if (raw.trim().length < 25) {
      setAutoDetectedInfo(null);
      return selectedSkill;
    }
    const detected = detectSkillFromText(raw);
    if (detected.confidence === 'high' && detected.skill !== selectedSkill) {
      setSelectedSkill(detected.skill);
      setAutoDetectedInfo(`Auto-detected ${detected.skill.toUpperCase()} (${detected.reason})`);
      return detected.skill;
    }
    return selectedSkill;
  };

  // ── Attach Image / Audio / Video inside Preview ──────────────────────────────
  const handleAttachMediaFile = async (
    file: File,
    kind: 'image' | 'audio' | 'video',
    partIdx = 0
  ) => {
    const busyKey = `${kind}-${partIdx}`;
    setUploadingMediaKey(busyKey);
    setErrorMsg(null);

    try {
      const targetId =
        successPreview?.id ||
        writingPreview?.id ||
        speakingPreview?.id ||
        `${selectedSkill}_${Date.now()}`;
      const res = await uploadMediaFile(file, selectedSkill, targetId);

      if (successPreview) {
        setSuccessPreview((prev) => {
          if (!prev) return prev;
          const nextParts = prev.parts.map((p, idx) => {
            if (idx !== partIdx) return p;
            if (kind === 'image') return { ...p, imageUrl: res.url };
            if (kind === 'video') return { ...p, videoUrl: res.url };
            return { ...p, audioUrl: res.url };
          });
          return { ...prev, parts: nextParts };
        });
      } else if (writingPreview && kind === 'image') {
        setWritingPreview((prev) =>
          prev ? { ...prev, task1: { ...prev.task1, imageUrl: res.url } } : prev
        );
      } else if (speakingPreview) {
        setSpeakingPreview((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            part2Question: {
              ...prev.part2Question,
              ...(kind === 'image' ? { imageUrl: res.url } : {}),
              ...(kind === 'video' ? { videoUrl: res.url } : {}),
            },
          };
        });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload media file.');
    } finally {
      setUploadingMediaKey(null);
    }
  };

  const handleUpdatePreviewPartMedia = (
    partIdx: number,
    field: 'audioUrl' | 'imageUrl' | 'videoUrl',
    val: string
  ) => {
    setSuccessPreview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        parts: prev.parts.map((p, idx) => (idx === partIdx ? { ...p, [field]: val } : p)),
      };
    });
  };

  // ── File Processing ──────────────────────────────────────────────────────────
  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const testFile = files[0];
    if (!testFile) return;

    setErrorMsg(null);
    setWarningMsg(null);
    setSpeakingValidationErrors([]);
    setSuccessPreview(null);
    setWritingPreview(null);
    setSpeakingPreview(null);
    setIsLoading(true);

    const fileName = testFile.name.toLowerCase();

    try {
      if (fileName.endsWith('.json')) {
        const text = await testFile.text();
        const parsed = JSON.parse(text);

        if (parsed.task1 && parsed.task2) {
          setSelectedSkill('writing');
          const col = applyCollectionFromParsed(parsed.collection);
          setWritingPreview({ ...parsed, collection: col });
        } else if (parsed.part1Questions && parsed.part2Question) {
          setSelectedSkill('speaking');
          const col = applyCollectionFromParsed(parsed.collection);
          setSpeakingPreview({ ...parsed, collection: col });
        } else if (parsed.title && Array.isArray(parsed.parts)) {
          const isListening = parsed.parts.some(
            (p: { audioUrl?: string; title?: string }) =>
              p.audioUrl || p.title?.toLowerCase().includes('section')
          );
          setSelectedSkill(isListening ? 'listening' : 'reading');
          const col = applyCollectionFromParsed(getExamCollection(parsed));
          setSuccessPreview({ ...parsed, collection: col });
        } else {
          throw new Error('JSON file is missing valid exam structure.');
        }
      } else if (fileName.endsWith('.txt')) {
        const text = await testFile.text();
        setTxtContent(text);
        const skillToUse = maybeAutoDetectSkill(text);

        if (skillToUse === 'writing') {
          const res = parseWritingText(text);
          const col = applyCollectionFromParsed(res.exam.collection);
          setWritingPreview({ ...res.exam, collection: col });
          if (res.warning) setWarningMsg(res.warning);
        } else if (skillToUse === 'speaking') {
          applySpeakingParseResult(text);
        } else {
          const result = parseIELTSText(text);
          const col = applyCollectionFromParsed(result.exam.collection);
          setSuccessPreview({ ...result.exam, collection: col });
          if (result.warning) setWarningMsg(result.warning);
        }
      } else {
        throw new Error(
          'Only standardized .txt and .json files are supported here. For Word/web text, copy & paste directly into "Paste Export Text".'
        );
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error reading file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void processFiles(e.target.files);
    }
  };

  // ── Drag & Drop ──────────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void processFiles(e.dataTransfer.files);
    }
  };

  // ── Audio Upload for Listening (Paste tab) ───────────────────────────────────
  const handleAudioUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAudio(true);
    setAudioNotice(null);
    setErrorMsg(null);

    try {
      const examId = `listening_${Date.now()}`;
      const res = await uploadMediaFile(file, 'listening', examId);
      setAudioNotice(`Audio uploaded: ${res.filename}`);

      setTxtContent((prev) => {
        if (/^\[AUDIO\]/im.test(prev)) {
          return prev.replace(/^\[AUDIO\].*$/im, `[AUDIO] ${res.url}`);
        } else if (prev.includes('=== SECTION 1 ===')) {
          return prev.replace('=== SECTION 1 ===', `=== SECTION 1 ===\n[AUDIO] ${res.url}`);
        } else {
          return `[AUDIO] ${res.url}\n\n` + prev;
        }
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload audio file.');
    } finally {
      setIsUploadingAudio(false);
      if (audioFileInputRef.current) audioFileInputRef.current.value = '';
    }
  };

  // ── TXT Parse (Step 1 -> Step 2 Preview + Quick Media Attach) ────────────────
  const handleParseTxt = () => {
    const trimmed = txtContent.trim();
    if (!trimmed) {
      setErrorMsg('Please paste or type exam content before checking.');
      return;
    }
    setErrorMsg(null);
    setWarningMsg(null);
    setSpeakingValidationErrors([]);
    setSuccessPreview(null);
    setWritingPreview(null);
    setSpeakingPreview(null);
    setActiveMediaPartIdx(0);
    setIsLoading(true);

    try {
      const skillToUse = maybeAutoDetectSkill(trimmed);

      if (skillToUse === 'writing') {
        const res = parseWritingText(trimmed);
        const col = applyCollectionFromParsed(res.exam.collection);
        setWritingPreview({ ...res.exam, collection: col });
        if (res.warning) setWarningMsg(res.warning);
      } else if (skillToUse === 'speaking') {
        applySpeakingParseResult(trimmed);
      } else {
        const result = parseIELTSText(trimmed);
        let finalExam = result.exam;

        if (answerKeyText.trim()) {
          const parsedKeys = parseQuickKeyText(answerKeyText.trim());
          if (parsedKeys.length > 0) {
            const merged = mergeKeysIntoExam(finalExam, parsedKeys);
            finalExam = merged.exam;
            setWarningMsg(
              `Attached ${merged.updatedCount} answers & explanations to the test questions!`
            );
          }
        }

        const col = applyCollectionFromParsed(finalExam.collection);
        setSuccessPreview({ ...finalExam, collection: col });
        if (result.warning && !answerKeyText.trim()) setWarningMsg(result.warning);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid TXT format.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Direct Parse + Save + Action (Default = 'edit') ──────────────────────────
  const handleDirectAction = (action: 'save_only' | 'take_test' | 'edit') => {
    const trimmed = txtContent.trim();
    if (!trimmed) {
      setErrorMsg('Please paste or type exam content first.');
      return;
    }
    setErrorMsg(null);
    try {
      const skillToUse = maybeAutoDetectSkill(trimmed);

      if (skillToUse === 'writing') {
        const res = parseWritingText(trimmed);
        const targetCol = ensureAndSyncCollection(applyCollectionFromParsed(res.exam.collection));
        const exToSave = { ...res.exam, collection: targetCol };
        saveWritingExam(exToSave);
        resetAllState();
        onWritingImportSuccess?.(exToSave, action === 'edit' ? 'edit' : 'save_only');
        if (action === 'edit' && onOpenWritingEditor) {
          onOpenWritingEditor(exToSave, targetCol);
        }
        onClose();
      } else if (skillToUse === 'speaking') {
        const res = parseSpeakingText(trimmed);
        setSpeakingValidationErrors(res.errors);
        if (!res.exam) return;
        const targetCol = ensureAndSyncCollection(applyCollectionFromParsed(res.exam.collection));
        const exToSave = { ...res.exam, collection: targetCol };
        saveSpeakingExam(exToSave);
        resetAllState();
        onSpeakingImportSuccess?.(exToSave, action === 'edit' ? 'edit' : 'save_only');
        if (action === 'edit' && onOpenSpeakingEditor) {
          onOpenSpeakingEditor(exToSave, targetCol);
        }
        onClose();
      } else {
        const result = parseIELTSText(trimmed);
        let finalExam = result.exam;

        if (answerKeyText.trim()) {
          const parsedKeys = parseQuickKeyText(answerKeyText.trim());
          if (parsedKeys.length > 0) {
            const merged = mergeKeysIntoExam(finalExam, parsedKeys);
            finalExam = merged.exam;
          }
        }

        const targetCol = ensureAndSyncCollection(applyCollectionFromParsed(finalExam.collection));
        const examToSave = { ...finalExam, collection: targetCol };
        saveExam(examToSave);
        resetAllState();
        onImportSuccess(examToSave, action);
        onClose();
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Invalid TXT format — check the syntax guide.'
      );
    }
  };

  // ── Save actions from Preview card ───────────────────────────────────────────
  const finalizePreview = (action: 'save_only' | 'take_test' | 'edit') => {
    const finalCol = ensureAndSyncCollection(selectedCollection);

    if (successPreview) {
      const examToSave = { ...successPreview, collection: finalCol };
      saveExam(examToSave);
      resetAllState();
      onImportSuccess(examToSave, action);
      onClose();
    } else if (writingPreview) {
      const examToSave = { ...writingPreview, collection: finalCol };
      saveWritingExam(examToSave);
      resetAllState();
      onWritingImportSuccess?.(examToSave, action === 'edit' ? 'edit' : 'save_only');
      if (action === 'edit' && onOpenWritingEditor) {
        onOpenWritingEditor(examToSave, finalCol);
      }
      onClose();
    } else if (speakingPreview) {
      const examToSave = { ...speakingPreview, collection: finalCol };
      saveSpeakingExam(examToSave);
      resetAllState();
      onSpeakingImportSuccess?.(examToSave, action === 'edit' ? 'edit' : 'save_only');
      if (action === 'edit' && onOpenSpeakingEditor) {
        onOpenSpeakingEditor(examToSave, finalCol);
      }
      onClose();
    }
  };

  // ── Template & Guide helpers ────────────────────────────────────────────────
  const getSkillTemplate = () => {
    switch (selectedSkill) {
      case 'reading':
        return FULL_40_QUESTIONS_TXT_TEMPLATE;
      case 'listening':
        return SAMPLE_LISTENING_TXT_TEMPLATE;
      case 'writing':
        return SAMPLE_WRITING_TXT_TEMPLATE;
      case 'speaking':
        return SAMPLE_SPEAKING_TXT_TEMPLATE;
      default:
        return SAMPLE_TXT_TEMPLATE;
    }
  };

  const getSkillSyntaxSpec = () => {
    switch (selectedSkill) {
      case 'reading':
        return FULL_IELTS_PATTERN_SPEC;
      case 'listening':
        return `================================================================================
IELTS LISTENING TXT SPECIFICATION GUIDE (SECTIONS 1–4)
================================================================================
The parser creates an authentic Computer-Delivered IELTS Listening Test with uninterrupted audio.

I. HEADER & GENERAL TAGS:
--------------------------------------------------------------------------------
[TITLE] <Exam Name - Example: CAMBRIDGE 19 - PRACTICE TEST 1 LISTENING>
[TIME] 30
[COLLECTION] <Collection Name - Auto-created if new, e.g. Cambridge 19>

II. SECTION STRUCTURE:
--------------------------------------------------------------------------------
=== SECTION 1 ===
[SECTION_TITLE] Accommodation Booking Form
[AUDIO] /audio/vol9/test1.mp4  <-- (Or web MP3 URL, or upload after pasting text)
[IMAGE] <Optional map/diagram image URL>
[VIDEO] <Optional MP4 / YouTube URL>

--- Questions 1–10 ---
Complete the notes below.
Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.

Customer Booking Form
Caller name: Sarah {{1}}
* A. Mitchell
Contact number: {{2}}
* A. 07945 882910

III. MULTIPLE CHOICE SYNTAX:
--------------------------------------------------------------------------------
11. When was the fitness centre originally opened?
A. 1995
B. 2005
C. 2015
* B. 2005
[EXPLAIN] Section 2 audio confirms opening in 2005.

IV. MATCHING / CLASSIFICATION SYNTAX:
--------------------------------------------------------------------------------
[OPTIONS]
A. Section 1 (Introduction)
B. Section 2 (Literature Review)
C. Section 3 (Methodology)

26. Historical background on wind farms
* B. Section 2 (Literature Review)`;
      case 'writing':
        return FULL_WRITING_PATTERN_SPEC;
      case 'speaking':
        return FULL_SPEAKING_PATTERN_SPEC;
      default:
        return FULL_IELTS_PATTERN_SPEC;
    }
  };

  const handleCopySkillTemplate = () => {
    void navigator.clipboard.writeText(getSkillTemplate());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLoadSkillTemplateToEditor = () => {
    setTxtContent(getSkillTemplate());
    setAutoDetectedInfo(null);
    setActiveTab('txt_paste');
  };

  const handleCreateInlineCollection = () => {
    const trimmed = newColDraft.trim();
    if (!trimmed) return;
    setSelectedCollection(trimmed);
    setHasUserPickedCollection(true);
    setShowNewColInput(false);
    setNewColDraft('');
  };

  // ── Derived stats ────────────────────────────────────────────────────────────
  const totalQuestions = successPreview
    ? successPreview.parts.reduce(
        (acc, p) =>
          acc + (p.questionGroups || []).reduce((gAcc, g) => gAcc + (g.questions || []).length, 0),
        0
      )
    : 0;

  const answeredQuestionsCount = successPreview
    ? successPreview.parts.reduce(
        (acc, p) =>
          acc +
          (p.questionGroups || []).reduce(
            (gAcc, g) =>
              gAcc +
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
      )
    : 0;

  const explainedQuestionsCount = successPreview
    ? successPreview.parts.reduce(
        (acc, p) =>
          acc +
          (p.questionGroups || []).reduce(
            (gAcc, g) =>
              gAcc +
              (g.questions || []).filter((q) => q.explanation && q.explanation.trim().length > 0)
                .length,
            0
          ),
        0
      )
    : 0;

  const charCount = txtContent.length;

  const renderCollectionSelector = () => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 shrink-0">
        Collection:
      </span>
      <select
        value={selectedCollection}
        onChange={(e) => {
          setSelectedCollection(e.target.value);
          setHasUserPickedCollection(true);
        }}
        className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 font-bold outline-none focus:border-blue-600 cursor-pointer"
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
            className="px-2.5 py-1 text-xs rounded-lg border-2 border-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none w-40"
            autoFocus
          />
          <button
            type="button"
            onClick={handleCreateInlineCollection}
            className="px-2 py-1 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Set
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNewColInput(false);
              setNewColDraft('');
            }}
            className="px-2 py-1 text-xs font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNewColInput(true)}
          className="px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-1 transition"
          title="Type a brand-new collection name"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>New</span>
        </button>
      )}
    </div>
  );

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 font-sans"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="smart-import-title"
        className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 text-slate-900 dark:text-gray-100 relative"
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b-2 border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 shrink-0">
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
                Paste TXT or drop JSON/TXT · Auto-detects skill &amp; creates collection · Attach images, audio &amp; video · Opens straight in Editor
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

        {/* ── 4 SKILL OPTIONS SELECTOR ────────────────────────────────────────── */}
        <div className="px-6 pt-3.5 pb-3.5 bg-slate-50/80 dark:bg-gray-900/60 border-b-2 border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Step 1: Skill Format (Auto-detected on paste)
            </span>
            {autoDetectedInfo ? (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                <span>{autoDetectedInfo}</span>
              </span>
            ) : (
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold">
                Click any skill card to switch manually
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              {
                id: 'reading' as const,
                title: 'Reading Test',
                subtitle: '3 Passages · 40 Qs · 60m',
                icon: BookOpen,
                badge: '8 Question Types',
              },
              {
                id: 'listening' as const,
                title: 'Listening Test',
                subtitle: '4 Sections · 40 Qs · 30m',
                icon: Headphones,
                badge: 'Audio + Maps',
              },
              {
                id: 'writing' as const,
                title: 'Writing Test',
                subtitle: 'Task 1 (150w) & Task 2 (250w)',
                icon: PenTool,
                badge: 'Chart Image',
              },
              {
                id: 'speaking' as const,
                title: 'Speaking Test',
                subtitle: 'Parts 1, 2, 3 · Mic Studio',
                icon: Mic,
                badge: 'Cue Card Media',
              },
            ].map((skill) => {
              const Icon = skill.icon;
              const isSelected = selectedSkill === skill.id;
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => {
                    if (selectedSkill !== skill.id) {
                      setSelectedSkill(skill.id);
                      setAutoDetectedInfo(null);
                      setSuccessPreview(null);
                      setWritingPreview(null);
                      setSpeakingPreview(null);
                      setErrorMsg(null);
                      setWarningMsg(null);
                    }
                  }}
                  className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col justify-between gap-2 relative ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/60 text-blue-950 dark:text-blue-100 shadow-xs'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-600 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div
                      className={`p-1.5 rounded-xl shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                      {skill.badge}
                    </span>
                  </div>
                  <div>
                    <div
                      className="text-xs font-extrabold"
                      style={{ fontFamily: outfit.style.fontFamily }}
                    >
                      {skill.title}
                    </div>
                    <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                      {skill.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Workflow Tabs ──────────────────────────────────────────────────── */}
        <div className="px-6 py-2.5 border-b-2 border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-gray-800 shrink-0">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border-2 border-gray-200 dark:border-gray-700">
            {(
              [
                { key: 'txt_paste', icon: FileText, label: 'Paste TXT' },
                { key: 'upload', icon: Upload, label: 'Upload TXT / JSON' },
                { key: 'guide', icon: HelpCircle, label: 'Syntax Guide' },
              ] as const
            ).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
                  activeTab === key
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleLoadSkillTemplateToEditor}
            className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border-2 border-blue-200 dark:border-blue-800 font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-2xs"
            title={`Load standard template for ${selectedSkill}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Load {selectedSkill.toUpperCase()} Template</span>
          </button>
        </div>

        {/* ── Scrollable Body ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-200">
          {/* Error banner */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-200 dark:border-rose-800 rounded-xl text-xs font-medium text-rose-800 dark:text-rose-200 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Warning banner */}
          {warningMsg && !errorMsg && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-200 dark:border-amber-800 rounded-xl text-xs font-medium text-amber-800 dark:text-amber-200 flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
              <span className="leading-relaxed">{warningMsg}</span>
            </div>
          )}

          {selectedSkill === 'speaking' && displayedSpeakingErrors.length > 0 && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-900 dark:text-rose-200 animate-in fade-in">
              <div className="flex items-start gap-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                <span>Speaking TXT needs correction before it can be saved.</span>
              </div>
              <ul className="mt-2 space-y-1 pl-6 list-disc">
                {displayedSpeakingErrors.map((error, index) => (
                  <li key={`${error.line}-${error.message}-${index}`}>
                    Line {error.line}: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Reading / Listening Preview + Quick Media Attach ──────────────── */}
          {successPreview && (
            <div className="p-5 bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-950 dark:text-emerald-100 space-y-4 animate-in fade-in shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-emerald-200/60 dark:border-emerald-800/60 pb-2.5">
                <span className="font-extrabold text-sm flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {selectedSkill === 'listening'
                    ? 'Listening Test Ready — Attach Audio / Images / Video'
                    : 'Reading Test Ready — Attach Images / Video (Optional)'}
                </span>
                <span className="text-[11px] bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-700 font-bold">
                  {successPreview.category}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white dark:bg-gray-900 rounded-xl border-2 border-emerald-200/60 dark:border-emerald-800/60 p-3 text-center">
                  <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                    {successPreview.parts.length}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-gray-400 font-bold">
                    {selectedSkill === 'listening' ? 'Sections' : 'Parts'}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl border-2 border-emerald-200/60 dark:border-emerald-800/60 p-3 text-center">
                  <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                    {totalQuestions}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-gray-400 font-bold">
                    Questions
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl border-2 border-emerald-200/60 dark:border-emerald-800/60 p-3 text-center">
                  <div
                    className={`text-lg font-extrabold ${
                      answeredQuestionsCount === totalQuestions
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {answeredQuestionsCount} / {totalQuestions}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-gray-400 font-bold">
                    Answers Set
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl border-2 border-emerald-200/60 dark:border-emerald-800/60 p-3 text-center">
                  <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                    {explainedQuestionsCount} / {totalQuestions}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-gray-400 font-bold">
                    Explanations
                  </div>
                </div>
              </div>

              {answeredQuestionsCount < totalQuestions && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    <strong>Heads up:</strong> {totalQuestions - answeredQuestionsCount} question(s) are missing an answer key. Click <strong>Save &amp; Open Editor</strong> to fill them in quickly.
                  </span>
                </div>
              )}

              {/* Quick Media Attach per Part/Section */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border-2 border-emerald-200/60 dark:border-emerald-800/60 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-extrabold text-xs text-slate-900 dark:text-gray-100">
                    Attach Images, Audio or Video per {selectedSkill === 'listening' ? 'Section' : 'Part'}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-gray-400">
                    Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 font-mono text-[10px]">Ctrl+V</kbd> to paste a screenshot into the selected part
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {successPreview.parts.map((p, idx) => {
                    const qCount = (p.questionGroups || []).reduce(
                      (s, g) => s + (g.questions || []).length,
                      0
                    );
                    const hasMedia = Boolean(p.audioUrl || p.imageUrl || p.videoUrl);
                    return (
                      <button
                        key={p.id || idx}
                        type="button"
                        onClick={() => setActiveMediaPartIdx(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
                          activeMediaPartIdx === idx
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 dark:bg-gray-800 text-slate-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400'
                        }`}
                      >
                        <span>
                          {selectedSkill === 'listening' ? `Sec ${p.partNumber}` : `Part ${p.partNumber}`} ({qCount} Qs)
                        </span>
                        {hasMedia && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400" title="Has media" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {successPreview.parts[activeMediaPartIdx] && (() => {
                  const p = successPreview.parts[activeMediaPartIdx]!;
                  return (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-2.5">
                      <div className="text-xs font-bold text-slate-800 dark:text-gray-200">
                        {p.title || `Part ${p.partNumber}`}
                      </div>

                      {selectedSkill === 'listening' && (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={p.audioUrl || ''}
                            onChange={(e) =>
                              handleUpdatePreviewPartMedia(activeMediaPartIdx, 'audioUrl', e.target.value)
                            }
                            placeholder="Audio URL (.mp3, .m4a, .mp4)..."
                            className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 font-mono"
                          />
                          <label className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer flex items-center justify-center gap-1.5 shrink-0">
                            {uploadingMediaKey === `audio-${activeMediaPartIdx}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Music className="w-3.5 h-3.5" />
                            )}
                            <span>Upload Audio</span>
                            <input
                              type="file"
                              accept="audio/*,video/mp4"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void handleAttachMediaFile(f, 'audio', activeMediaPartIdx);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={p.imageUrl || ''}
                          onChange={(e) =>
                            handleUpdatePreviewPartMedia(activeMediaPartIdx, 'imageUrl', e.target.value)
                          }
                          placeholder="Image / Map / Diagram URL (or press Ctrl+V)..."
                          className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 font-mono"
                        />
                        <label className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 hover:border-blue-500 text-slate-700 dark:text-gray-200 cursor-pointer flex items-center justify-center gap-1.5 shrink-0">
                          {uploadingMediaKey === `image-${activeMediaPartIdx}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5" />
                          )}
                          <span>Upload Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleAttachMediaFile(f, 'image', activeMediaPartIdx);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={p.videoUrl || ''}
                          onChange={(e) =>
                            handleUpdatePreviewPartMedia(activeMediaPartIdx, 'videoUrl', e.target.value)
                          }
                          placeholder="Video URL (YouTube, .mp4, .webm)..."
                          className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 font-mono"
                        />
                        <label className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 hover:border-blue-500 text-slate-700 dark:text-gray-200 cursor-pointer flex items-center justify-center gap-1.5 shrink-0">
                          {uploadingMediaKey === `video-${activeMediaPartIdx}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Video className="w-3.5 h-3.5" />
                          )}
                          <span>Upload Video</span>
                          <input
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleAttachMediaFile(f, 'video', activeMediaPartIdx);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>

                      {(p.imageUrl || p.videoUrl) && (
                        <MediaEmbed imageUrl={p.imageUrl} videoUrl={p.videoUrl} alt={p.title} />
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-slate-600 dark:text-gray-400 shrink-0">Title:</span>
                  <span className="font-extrabold text-slate-900 dark:text-gray-100 truncate">
                    {successPreview.title}
                  </span>
                </div>
                {renderCollectionSelector()}
              </div>

              <div className="pt-2 border-t-2 border-emerald-200/60 dark:border-emerald-800/60 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSuccessPreview(null);
                    setActiveTab('txt_paste');
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition mr-auto font-bold flex items-center gap-1"
                >
                  ← Back to Text
                </button>
                <button
                  type="button"
                  onClick={() => finalizePreview('save_only')}
                  className="px-3.5 py-2 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-700 dark:text-gray-200 border-2 border-slate-200 dark:border-gray-700 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save &amp; Finish</span>
                </button>
                <button
                  type="button"
                  onClick={() => finalizePreview('take_test')}
                  className="px-3.5 py-2 bg-slate-800 dark:bg-gray-700 hover:bg-slate-900 dark:hover:bg-gray-600 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Save &amp; Start Test</span>
                </button>
                <button
                  type="button"
                  onClick={() => finalizePreview('edit')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Save &amp; Open Editor</span>
                </button>
              </div>
            </div>
          )}

          {/* ── Writing Preview + Chart Image Attach ──────────────────────────── */}
          {writingPreview && (
            <div className="p-5 bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-950 dark:text-emerald-100 space-y-3.5 animate-in fade-in shadow-2xs">
              <div className="flex items-center justify-between border-b-2 border-emerald-200/60 dark:border-emerald-800/60 pb-2.5">
                <span className="font-extrabold text-sm flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Writing Test Ready — Attach Task 1 Chart Image
                </span>
                <span className="text-[11px] bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-700 font-bold">
                  Task 1 &amp; Task 2
                </span>
              </div>

              <div className="space-y-1.5 bg-white dark:bg-gray-900 p-3.5 rounded-xl border-2 border-emerald-200/60 dark:border-emerald-800/60 text-xs">
                <div><strong>Title:</strong> {writingPreview.title}</div>
                <div><strong>Task 1:</strong> {writingPreview.task1.title} ({writingPreview.task1.chartType || 'bar'})</div>
                <div><strong>Task 2:</strong> {writingPreview.task2.title}</div>
              </div>

              {/* Quick Chart Image Upload */}
              <div className="bg-white dark:bg-gray-900 p-3.5 rounded-xl border-2 border-emerald-200/60 dark:border-emerald-800/60 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-xs">Task 1 Chart / Diagram Image (or press Ctrl+V)</span>
                  {writingPreview.task1.imageUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setWritingPreview((prev) =>
                          prev ? { ...prev, task1: { ...prev.task1, imageUrl: undefined } } : prev
                        )
                      }
                      className="text-rose-600 hover:underline flex items-center gap-1 text-[11px] font-bold"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={writingPreview.task1.imageUrl || ''}
                    onChange={(e) =>
                      setWritingPreview((prev) =>
                        prev ? { ...prev, task1: { ...prev.task1, imageUrl: e.target.value } } : prev
                      )
                    }
                    placeholder="Paste image URL or upload chart file..."
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 font-mono"
                  />
                  <label className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer flex items-center justify-center gap-1.5 shrink-0">
                    {uploadingMediaKey === 'image-0' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5" />
                    )}
                    <span>Upload Chart</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleAttachMediaFile(f, 'image', 0);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                {writingPreview.task1.imageUrl && (
                  <MediaEmbed imageUrl={writingPreview.task1.imageUrl} alt="Task 1 chart" />
                )}
              </div>

              {renderCollectionSelector()}

              <div className="pt-2 border-t-2 border-emerald-200/60 dark:border-emerald-800/60 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWritingPreview(null);
                    setActiveTab('txt_paste');
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition mr-auto font-bold"
                >
                  ← Back to Text
                </button>
                <button
                  type="button"
                  onClick={() => finalizePreview('save_only')}
                  className="px-3.5 py-2 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-700 dark:text-gray-200 border-2 border-slate-200 dark:border-gray-700 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save &amp; Finish</span>
                </button>
                <button
                  type="button"
                  onClick={() => finalizePreview('edit')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Save &amp; Open Editor</span>
                </button>
              </div>
            </div>
          )}

          {/* ── Speaking Preview + Cue Card Media Attach ──────────────────────── */}
          {speakingPreview && (
            <div className="p-5 bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-950 dark:text-emerald-100 space-y-3.5 animate-in fade-in shadow-2xs">
              <div className="flex items-center justify-between border-b-2 border-emerald-200/60 dark:border-emerald-800/60 pb-2.5">
                <span className="font-extrabold text-sm flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Speaking Test Ready — Optional Cue Card Media
                </span>
                <span className="text-[11px] bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-700 font-bold">
                  Parts 1, 2 &amp; 3
                </span>
              </div>

              <div className="space-y-1.5 bg-white dark:bg-gray-900 p-3.5 rounded-xl border-2 border-emerald-200/60 dark:border-emerald-800/60 text-xs">
                <div><strong>Title:</strong> {speakingPreview.title}</div>
                <div>
                  <strong>Part 1:</strong> {speakingPreview.part1Questions.length} Qs ·{' '}
                  <strong>Part 3:</strong> {speakingPreview.part3Questions.length} Qs
                </div>
                <div><strong>Cue Card:</strong> &ldquo;{speakingPreview.part2Question.questionText}&rdquo;</div>
              </div>

              {/* Optional Cue Card Image / Video */}
              <div className="bg-white dark:bg-gray-900 p-3.5 rounded-xl border-2 border-emerald-200/60 dark:border-emerald-800/60 space-y-2.5">
                <span className="font-bold text-xs block">
                  Part 2 Visual / Video Prompt (Optional · Ctrl+V for image)
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={speakingPreview.part2Question.imageUrl || ''}
                    onChange={(e) =>
                      setSpeakingPreview((prev) =>
                        prev
                          ? {
                              ...prev,
                              part2Question: { ...prev.part2Question, imageUrl: e.target.value },
                            }
                          : prev
                      )
                    }
                    placeholder="Image URL..."
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 font-mono"
                  />
                  <label className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:border-blue-500 cursor-pointer flex items-center justify-center gap-1.5 shrink-0">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleAttachMediaFile(f, 'image', 0);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={speakingPreview.part2Question.videoUrl || ''}
                    onChange={(e) =>
                      setSpeakingPreview((prev) =>
                        prev
                          ? {
                              ...prev,
                              part2Question: { ...prev.part2Question, videoUrl: e.target.value },
                            }
                          : prev
                      )
                    }
                    placeholder="Video URL (YouTube, .mp4, .webm)..."
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 font-mono"
                  />
                  <label className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:border-blue-500 cursor-pointer flex items-center justify-center gap-1.5 shrink-0">
                    <Video className="w-3.5 h-3.5" />
                    <span>Upload Video</span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleAttachMediaFile(f, 'video', 0);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                {(speakingPreview.part2Question.imageUrl ||
                  speakingPreview.part2Question.videoUrl) && (
                  <MediaEmbed
                    imageUrl={speakingPreview.part2Question.imageUrl}
                    videoUrl={speakingPreview.part2Question.videoUrl}
                    alt="Speaking visual"
                  />
                )}
              </div>

              {renderCollectionSelector()}

              <div className="pt-2 border-t-2 border-emerald-200/60 dark:border-emerald-800/60 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSpeakingPreview(null);
                    setActiveTab('txt_paste');
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition mr-auto font-bold"
                >
                  ← Back to Text
                </button>
                <button
                  type="button"
                  onClick={() => finalizePreview('save_only')}
                  className="px-3.5 py-2 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-gray-800 text-slate-700 dark:text-gray-200 border-2 border-slate-200 dark:border-gray-700 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save &amp; Finish</span>
                </button>
                <button
                  type="button"
                  onClick={() => finalizePreview('edit')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Save &amp; Open Editor</span>
                </button>
              </div>
            </div>
          )}

          {/* ── TAB 1: UPLOAD FILE ────────────────────────────────────────────── */}
          {activeTab === 'upload' && !successPreview && !writingPreview && !speakingPreview && (
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 ${
                  isDragOver
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 bg-slate-50/50 dark:bg-gray-900/40 hover:bg-slate-50 dark:hover:bg-gray-900/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-xs">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4
                    className="text-sm font-extrabold text-gray-900 dark:text-gray-100"
                    style={{ fontFamily: outfit.style.fontFamily }}
                  >
                    Click to browse or drop your .txt / .json file here
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Skill &amp; media tags are detected automatically — then attach images, audio or video on the next screen
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: PASTE TXT CONTENT ──────────────────────────────────────── */}
          {activeTab === 'txt_paste' && !successPreview && !writingPreview && !speakingPreview && (
            <div className="space-y-3.5">
              {selectedSkill === 'listening' && (
                <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/40 border-2 border-blue-200 dark:border-blue-800 rounded-2xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Music className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <div>
                      <span className="font-extrabold text-slate-800 dark:text-gray-100 block">
                        Quick Listening Audio Upload:
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-gray-400 truncate block">
                        {audioNotice ||
                          'Upload an audio file (.mp3 / .m4a / .wav) now or attach per-section after clicking Check & Preview'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <input
                      ref={audioFileInputRef}
                      type="file"
                      accept="audio/*,video/mp4"
                      onChange={handleAudioUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => audioFileInputRef.current?.click()}
                      disabled={isUploadingAudio}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-1.5 transition shadow-xs text-xs shrink-0"
                    >
                      {isUploadingAudio ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Audio</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Paste {selectedSkill.toUpperCase()} text content (supports [COLLECTION], [IMAGE], [VIDEO], [AUDIO]):
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopySkillTemplate}
                    className="text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 font-bold transition"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copied ? 'Copied!' : 'Copy Template'}</span>
                  </button>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <button
                    type="button"
                    onClick={handleLoadSkillTemplateToEditor}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 font-bold transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Insert Sample</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <textarea
                  value={txtContent}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setTxtContent(nextVal);
                    if (Math.abs(nextVal.length - txtContent.length) > 20) {
                      maybeAutoDetectSkill(nextVal);
                    }
                  }}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && txtContent.trim()) {
                      e.preventDefault();
                      handleDirectAction('edit');
                    }
                  }}
                  rows={12}
                  spellCheck={false}
                  placeholder={`Paste ${selectedSkill} text here. Skill is auto-detected! Use Check & Preview to attach images, audio or video afterwards, or press Ctrl+Enter to Import & Edit right away.`}
                  className="w-full font-mono text-xs p-3.5 bg-slate-50 dark:bg-gray-900 text-slate-900 dark:text-gray-100 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-gray-950 focus:border-blue-600 leading-relaxed resize-y"
                />
                {charCount > 0 && (
                  <div className="absolute bottom-2.5 right-3 text-[10px] font-bold text-slate-500 dark:text-gray-400 bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded-lg pointer-events-none">
                    {charCount.toLocaleString()} chars
                  </div>
                )}
              </div>

              {/* Optional Attached Answer Key & Explanations Matcher */}
              {(selectedSkill === 'reading' || selectedSkill === 'listening') && (
                <div className="border-2 border-gray-200 dark:border-gray-700 rounded-2xl bg-slate-50/70 dark:bg-gray-900/50 p-3.5 space-y-2">
                  <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setShowKeyMatcher(!showKeyMatcher)}
                  >
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200">
                        Attach Separate Answer Key &amp; Explanations (Optional)
                      </span>
                      {answerKeyText.trim() && (
                        <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full font-bold">
                          {parseQuickKeyText(answerKeyText).length} answers loaded
                        </span>
                      )}
                    </div>
                    <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                      {showKeyMatcher ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {showKeyMatcher && (
                    <div className="space-y-2 pt-1 animate-in fade-in">
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                        Paste raw answers (e.g. <code className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700">1. TRUE | Paragraph 1...</code> or <code className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700">21-22. A, C</code>). They merge automatically on import.
                      </p>
                      <textarea
                        value={answerKeyText}
                        onChange={(e) => setAnswerKeyText(e.target.value)}
                        rows={4}
                        placeholder="1. TRUE | Paragraph 1 confirms...&#10;2. FALSE&#10;3. NOT GIVEN&#10;21-22. A, C"
                        className="w-full font-mono text-xs p-3 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Action row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {renderCollectionSelector()}

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleParseTxt}
                    disabled={isLoading || !txtContent.trim()}
                    className="px-3.5 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border-2 border-gray-200 dark:border-gray-600 text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Parse and attach images, audio or video before saving"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Check &amp; Attach Media</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDirectAction('save_only')}
                    disabled={isLoading || !txtContent.trim() || hasSpeakingValidationErrors}
                    className="px-3.5 py-2 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-2 border-gray-200 dark:border-gray-600 text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Parse and save directly to library"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Quick Save</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDirectAction('edit')}
                    disabled={isLoading || !txtContent.trim() || hasSpeakingValidationErrors}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Parse, save, and immediately open Visual Editor (Ctrl+Enter)"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Import &amp; Edit</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3: SYNTAX GUIDE ───────────────────────────────────────────── */}
          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs text-slate-700 dark:text-gray-300">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-gray-100 dark:border-gray-700 pb-2.5">
                <div>
                  <h4
                    className="text-sm font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-1.5"
                    style={{ fontFamily: outfit.style.fontFamily }}
                  >
                    <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Syntax Specification for {selectedSkill.toUpperCase()} Tests</span>
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Includes [COLLECTION], [AUDIO], [IMAGE], and [VIDEO] tags
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(getSkillSyntaxSpec());
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Guide'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadSkillTemplateToEditor}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Use Template</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[380px] shadow-inner">
                <pre>{getSkillSyntaxSpec()}</pre>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="px-6 py-3.5 border-t-2 border-gray-200 dark:border-gray-700 bg-slate-50/70 dark:bg-gray-900/60 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Prefer building from scratch with blank form fields?
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={requestClose}
              className="px-3.5 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-xl hover:bg-gray-200/60 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const col = ensureAndSyncCollection(selectedCollection);
                resetAllState();
                onClose();
                if (selectedSkill === 'writing') {
                  onOpenWritingEditor?.(null, col);
                } else if (selectedSkill === 'speaking') {
                  onOpenSpeakingEditor?.(null, col);
                } else {
                  onOpenManualEditor(selectedSkill, col);
                }
              }}
              className="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 border-2 border-gray-200 dark:border-gray-600 text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1.5 transition"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Open Blank {selectedSkill.toUpperCase()} Editor</span>
            </button>
          </div>
        </div>

        {/* Unsaved Draft Confirm Overlay */}
        {showCloseConfirm && (
          <div className="absolute inset-0 z-30 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="smart-discard-title"
              className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4"
            >
              <h4
                id="smart-discard-title"
                className="text-base font-extrabold text-gray-900 dark:text-gray-100"
              >
                Discard pasted draft?
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                You have unsaved text or preview changes in Smart Add Test. Closing now will discard them.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setShowCloseConfirm(false)}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetAllState();
                    onClose();
                  }}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartImportModal;
