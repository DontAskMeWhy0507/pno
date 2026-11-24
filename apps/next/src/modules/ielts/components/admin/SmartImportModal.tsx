import { useState, useEffect, useRef, type FC, type ChangeEvent } from 'react';
import { outfit } from '@pno/lib/chakra-theme';
import type { Exam } from '../../types/exam';
import type { WritingExam } from '../../types/writing';
import type { SpeakingExam } from '../../types/speaking';
import { saveExam, getAllCollections, getExamCollection } from '../../utils/storage';
import { saveWritingExam } from '../../data/writingExams';
import { saveSpeakingExam } from '../../data/speakingExams';
import {
  parseIELTSText,
  parseWritingText,
  parseSpeakingText,
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
  Folder,
  FolderOpen,
  Music,
  KeyRound,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface SmartImportModalProps {
  isOpen: boolean;
  initialCollection?: string;
  defaultSkill?: 'reading' | 'listening' | 'writing' | 'speaking';
  onClose: () => void;
  onImportSuccess: (exam: Exam, action: 'save_only' | 'take_test' | 'edit') => void;
  onOpenManualEditor: () => void;
  onWritingImportSuccess?: (exam: WritingExam) => void;
  onSpeakingImportSuccess?: (exam: SpeakingExam) => void;
  onOpenWritingEditor?: (exam?: WritingExam | null) => void;
  onOpenSpeakingEditor?: (exam?: SpeakingExam | null) => void;
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
}) => {
  const [selectedSkill, setSelectedSkill] = useState<'reading' | 'listening' | 'writing' | 'speaking'>(defaultSkill);
  const [activeTab, setActiveTab] = useState<'upload' | 'txt_paste' | 'guide'>('txt_paste');
  const [txtContent, setTxtContent] = useState('');
  const [answerKeyText, setAnswerKeyText] = useState('');
  const [showKeyMatcher, setShowKeyMatcher] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [speakingValidationErrors, setSpeakingValidationErrors] = useState<SpeakingParseError[]>([]);

  // Previews
  const [successPreview, setSuccessPreview] = useState<Exam | null>(null);
  const [writingPreview, setWritingPreview] = useState<WritingExam | null>(null);
  const [speakingPreview, setSpeakingPreview] = useState<SpeakingExam | null>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string>(initialCollection || 'My Tests');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    if (isOpen) {
      if (initialCollection) {
        setSelectedCollection(initialCollection);
      }
      if (defaultSkill) {
        setSelectedSkill(defaultSkill);
      }
    }
  }, [isOpen, initialCollection, defaultSkill]);

  if (!isOpen) return null;

  const collections = getAllCollections();
  const speakingValidation = selectedSkill === 'speaking' && txtContent.trim()
    ? parseSpeakingText(txtContent)
    : null;
  const hasSpeakingValidationErrors = Boolean(speakingValidation && speakingValidation.errors.length > 0);
  const displayedSpeakingErrors = speakingValidation?.errors ?? speakingValidationErrors;

  const applySpeakingParseResult = (text: string, collectionOverride?: string) => {
    const result = parseSpeakingText(text);
    setSpeakingValidationErrors(result.errors);
    if (!result.exam) {
      setSpeakingPreview(null);
      setActiveTab('txt_paste');
      return null;
    }
    const exam = { ...result.exam, collection: collectionOverride ?? result.exam.collection ?? 'My Tests' };
    setSpeakingPreview(exam);
    return exam;
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
          setWritingPreview(parsed);
          setSelectedCollection(parsed.collection || 'My Tests');
        } else if (parsed.part1Questions && parsed.part2Question) {
          setSelectedSkill('speaking');
          setSpeakingPreview(parsed);
          setSelectedCollection(parsed.collection || 'My Tests');
        } else if (parsed.title && Array.isArray(parsed.parts)) {
          const isListening = parsed.parts.some((p: any) => p.audioUrl || p.title?.toLowerCase().includes('section'));
          setSelectedSkill(isListening ? 'listening' : 'reading');
          setSuccessPreview(parsed);
          setSelectedCollection(getExamCollection(parsed));
        } else {
          throw new Error('JSON file is missing valid exam structure.');
        }
      } else if (fileName.endsWith('.txt')) {
        const text = await testFile.text();
        setTxtContent(text);

        if (selectedSkill === 'writing') {
          const res = parseWritingText(text);
          setWritingPreview(res.exam);
          setSelectedCollection(res.exam.collection || 'My Tests');
          if (res.warning) setWarningMsg(res.warning);
        } else if (selectedSkill === 'speaking') {
          const exam = applySpeakingParseResult(text);
          if (exam) setSelectedCollection(exam.collection || 'My Tests');
        } else {
          const result = parseIELTSText(text);
          setSuccessPreview(result.exam);
          setSelectedCollection(getExamCollection(result.exam));
          if (result.warning) setWarningMsg(result.warning);
        }
      } else {
        throw new Error(
          `Only clean standardized .txt and .json backup files are supported for import. If you have test content from Word or web, simply copy and paste the text into the "Paste TXT Content" tab.`
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
      processFiles(e.target.files);
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
      processFiles(e.dataTransfer.files);
    }
  };

  // ── Audio Upload for Listening ───────────────────────────────────────────────
  const handleAudioUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAudio(true);
    setAudioNotice(null);
    setErrorMsg(null);

    try {
      const examId = `listening_${Date.now()}`;
      const res = await uploadMediaFile(file, 'listening', examId);
      setAudioNotice(`Audio uploaded successfully: ${res.filename}`);

      // Auto insert or update [AUDIO] in txtContent
      setTxtContent((prev) => {
        if (/^\[AUDIO\]/im.test(prev)) {
          return prev.replace(/^\[AUDIO\].*$/im, `[AUDIO] ${res.url}`);
        } else if (prev.includes('=== SECTION 1 ===')) {
          return prev.replace('=== SECTION 1 ===', `=== SECTION 1 ===\n[AUDIO] ${res.url}`);
        } else {
          return `[AUDIO] ${res.url}\n\n` + prev;
        }
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload audio file.');
    } finally {
      setIsUploadingAudio(false);
    }
  };

  // ── TXT Parse ────────────────────────────────────────────────────────────────
  const handleParseTxt = () => {
    const trimmed = txtContent.trim();
    if (!trimmed) {
      setErrorMsg('Please paste or type exam content before parsing.');
      return;
    }
    setErrorMsg(null);
    setWarningMsg(null);
    setSpeakingValidationErrors([]);
    setSuccessPreview(null);
    setWritingPreview(null);
    setSpeakingPreview(null);
    setIsLoading(true);

    try {
      if (selectedSkill === 'writing') {
        const res = parseWritingText(trimmed);
        const ex = { ...res.exam, collection: selectedCollection };
        setWritingPreview(ex);
        if (res.warning) setWarningMsg(res.warning);
      } else if (selectedSkill === 'speaking') {
        applySpeakingParseResult(trimmed, selectedCollection);
      } else {
        const result = parseIELTSText(trimmed);
        let finalExam = result.exam;

        // Auto-merge separate answer keys & explanations if provided
        if (answerKeyText.trim()) {
          const parsedKeys = parseQuickKeyText(answerKeyText.trim());
          if (parsedKeys.length > 0) {
            const merged = mergeKeysIntoExam(finalExam, parsedKeys);
            finalExam = merged.exam;
            setWarningMsg(`Attached ${merged.updatedCount} answers & explanations to the test questions!`);
          }
        }

        setSuccessPreview(finalExam);
        setSelectedCollection(getExamCollection(finalExam));
        if (result.warning && !answerKeyText.trim()) setWarningMsg(result.warning);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid TXT format.');
    } finally {
      setIsLoading(false);
    }
  };

  /** Parse inline, save, and immediately trigger an action */
  const handleDirectAction = (action: 'save_only' | 'take_test' | 'edit') => {
    const trimmed = txtContent.trim();
    if (!trimmed) {
      setErrorMsg('Please paste or type exam content first.');
      return;
    }
    setErrorMsg(null);
    try {
      if (selectedSkill === 'writing') {
        const res = parseWritingText(trimmed);
        const exToSave = { ...res.exam, collection: selectedCollection };
        saveWritingExam(exToSave);
        resetState();
        onWritingImportSuccess?.(exToSave);
        if (action === 'edit' && onOpenWritingEditor) {
          onOpenWritingEditor(exToSave);
        }
        onClose();
      } else if (selectedSkill === 'speaking') {
        const res = parseSpeakingText(trimmed);
        setSpeakingValidationErrors(res.errors);
        if (!res.exam) return;
        const exToSave = { ...res.exam, collection: selectedCollection };
        saveSpeakingExam(exToSave);
        resetState();
        onSpeakingImportSuccess?.(exToSave);
        if (action === 'edit' && onOpenSpeakingEditor) {
          onOpenSpeakingEditor(exToSave);
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

        const examToSave = { ...finalExam, collection: selectedCollection };
        saveExam(examToSave);
        resetState();
        onImportSuccess(examToSave, action);
        onClose();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid TXT format — check the syntax guide.');
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
[COLLECTION] <Collection Name - Example: Cambridge 19>

II. SECTION STRUCTURE:
--------------------------------------------------------------------------------
=== SECTION 1 ===
[SECTION_TITLE] Accommodation Booking Form
[AUDIO] /audio/vol9/test1.mp4  <-- (Or web MP3 URL, or local file in public/audio/)

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
    navigator.clipboard.writeText(getSkillTemplate());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLoadSkillTemplateToEditor = () => {
    setTxtContent(getSkillTemplate());
    setActiveTab('txt_paste');
  };


  // ── State management ─────────────────────────────────────────────────────────
  const resetState = () => {
    setSuccessPreview(null);
    setWritingPreview(null);
    setSpeakingPreview(null);
    setErrorMsg(null);
    setWarningMsg(null);
    setSpeakingValidationErrors([]);
    setTxtContent('');
    setAnswerKeyText('');
    setShowKeyMatcher(false);
    setAudioNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (audioFileInputRef.current) audioFileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // ── Save actions (from preview card) ─────────────────────────────────────────
  const handleSaveAndReturn = () => {
    if (successPreview) {
      const examToSave = { ...successPreview, collection: selectedCollection };
      saveExam(examToSave);
      resetState();
      onImportSuccess(examToSave, 'save_only');
      onClose();
    } else if (writingPreview) {
      const examToSave = { ...writingPreview, collection: selectedCollection };
      saveWritingExam(examToSave);
      resetState();
      onWritingImportSuccess?.(examToSave);
      onClose();
    } else if (speakingPreview) {
      const examToSave = { ...speakingPreview, collection: selectedCollection };
      saveSpeakingExam(examToSave);
      resetState();
      onSpeakingImportSuccess?.(examToSave);
      onClose();
    }
  };

  const handleSaveAndTakeTest = () => {
    if (successPreview) {
      const examToSave = { ...successPreview, collection: selectedCollection };
      saveExam(examToSave);
      resetState();
      onImportSuccess(examToSave, 'take_test');
      onClose();
    } else if (writingPreview) {
      const examToSave = { ...writingPreview, collection: selectedCollection };
      saveWritingExam(examToSave);
      resetState();
      onWritingImportSuccess?.(examToSave);
      onClose();
    } else if (speakingPreview) {
      const examToSave = { ...speakingPreview, collection: selectedCollection };
      saveSpeakingExam(examToSave);
      resetState();
      onSpeakingImportSuccess?.(examToSave);
      onClose();
    }
  };

  const handleSaveAndEdit = () => {
    if (successPreview) {
      const examToSave = { ...successPreview, collection: selectedCollection };
      saveExam(examToSave);
      resetState();
      onImportSuccess(examToSave, 'edit');
      onClose();
    } else if (writingPreview) {
      const examToSave = { ...writingPreview, collection: selectedCollection };
      saveWritingExam(examToSave);
      resetState();
      onWritingImportSuccess?.(examToSave);
      if (onOpenWritingEditor) onOpenWritingEditor(examToSave);
      onClose();
    } else if (speakingPreview) {
      const examToSave = { ...speakingPreview, collection: selectedCollection };
      saveSpeakingExam(examToSave);
      resetState();
      onSpeakingImportSuccess?.(examToSave);
      if (onOpenSpeakingEditor) onOpenSpeakingEditor(examToSave);
      onClose();
    }
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
              gAcc + (g.questions || []).filter((q) => q.explanation && q.explanation.trim().length > 0).length,
            0
          ),
        0
      )
    : 0;

  const charCount = txtContent.length;

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 font-sans"
    >
      <div className="bg-white border-2 border-gray-200 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 text-slate-900">

        {/* ── Header — PNO Quiz Modal Header Style ─────────────────────────────── */}
        <div className="px-6 py-4 border-b-2 border-gray-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3
                className="text-lg font-extrabold text-gray-900 leading-tight"
                style={{ fontFamily: outfit.style.fontFamily }}
              >
                Add New IELTS Practice Test
              </h3>
              <p className="text-xs font-medium text-gray-500 mt-0.5 leading-tight">
                Select your skill below · Paste TXT or upload JSON · Live validation &amp; instant preview
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-700 p-2 rounded-xl hover:bg-gray-100 transition shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── 4 SKILL OPTIONS SELECTOR — PNO Quiz Card Style ───────────────────── */}
        <div className="px-6 pt-3.5 pb-3.5 bg-slate-50/70 border-b-2 border-gray-200 shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-extrabold text-gray-700 uppercase tracking-wider">
              Step 1: Choose Test Type (4 Skills)
            </span>
            <span className="text-[11px] text-gray-500 font-semibold">
              Click any skill card to load its format &amp; template
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              {
                id: 'reading' as const,
                title: 'Reading Test',
                subtitle: '3 Passages · 40 Qs · 60m',
                icon: BookOpen,
                activeCls: 'border-blue-600 bg-blue-50/70 text-blue-950 shadow-xs',
                badge: '8 Question Types',
              },
              {
                id: 'listening' as const,
                title: 'Listening Test',
                subtitle: '4 Sections · 40 Qs · 30m',
                icon: Headphones,
                activeCls: 'border-blue-600 bg-blue-50/70 text-blue-950 shadow-xs',
                badge: 'Audio MP3 Links',
              },
              {
                id: 'writing' as const,
                title: 'Writing Test',
                subtitle: 'Task 1 (150w) & Task 2 (250w)',
                icon: PenTool,
                activeCls: 'border-blue-600 bg-blue-50/70 text-blue-950 shadow-xs',
                badge: 'Band 8.5+ Essays',
              },
              {
                id: 'speaking' as const,
                title: 'Speaking Test',
                subtitle: 'Parts 1, 2, 3 · Mic Studio',
                icon: Mic,
                activeCls: 'border-blue-600 bg-blue-50/70 text-blue-950 shadow-xs',
                badge: 'Cue Card Timers',
              },
            ].map((skill) => {
              const Icon = skill.icon;
              const isSelected = selectedSkill === skill.id;
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => {
                    setSelectedSkill(skill.id);
                    resetState();
                  }}
                  className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col justify-between gap-2 relative ${
                    isSelected
                      ? skill.activeCls
                      : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-white shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div
                      className={`p-1.5 rounded-xl shrink-0 ${
                        isSelected ? 'bg-blue-600 text-white shadow-2xs' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-white border border-gray-200 text-gray-600">
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
                    <div className="text-[10px] font-medium text-gray-500 mt-0.5">{skill.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Workflow Tabs — PNO Quiz Soft-Rounded Pill Tabs ──────────────────── */}
        <div className="px-6 py-2.5 border-b-2 border-gray-200 flex flex-wrap items-center justify-between gap-2 bg-white shrink-0">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border-2 border-gray-200">
            {(
              [
                { key: 'txt_paste', icon: FileText, label: 'Paste Export Text' },
                { key: 'upload', icon: Upload, label: 'Upload TXT / JSON' },
                { key: 'guide', icon: HelpCircle, label: 'Syntax Guide' },
              ] as const
            ).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
                  activeTab === key
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Quick Load Template Button */}
          <button
            type="button"
            onClick={handleLoadSkillTemplateToEditor}
            className="text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-2xs"
            title={`Load standard template for ${selectedSkill}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Load {selectedSkill.toUpperCase()} Sample Template</span>
          </button>
        </div>

        {/* ── Scrollable Body ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white text-slate-800">

          {/* Error banner */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border-2 border-rose-200 rounded-xl text-xs font-medium text-rose-800 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Warning banner */}
          {warningMsg && !errorMsg && (
            <div className="p-3.5 bg-amber-50 border-2 border-amber-200 rounded-xl text-xs font-medium text-amber-800 flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
              <span className="leading-relaxed">{warningMsg}</span>
            </div>
          )}

          {selectedSkill === 'speaking' && displayedSpeakingErrors.length > 0 && (
            <div className="p-3.5 bg-rose-50 border-2 border-rose-200 rounded-xl text-xs text-rose-900 animate-in fade-in">
              <div className="flex items-start gap-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                <span>Speaking TXT needs correction before it can be saved.</span>
              </div>
              <ul className="mt-2 space-y-1 pl-6 list-disc text-rose-800">
                {displayedSpeakingErrors.map((error, index) => (
                  <li key={`${error.line}-${error.message}-${index}`}>
                    Line {error.line}: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Reading / Listening Success Preview Card ──────────────────────── */}
          {successPreview && (
            <div className="p-5 bg-emerald-50/70 border-2 border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-3.5 animate-in fade-in shadow-2xs">
              <div className="flex items-center justify-between border-b-2 border-emerald-200/60 pb-2.5">
                <span className="font-extrabold text-sm text-emerald-900 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  {selectedSkill === 'listening' ? 'Listening Test Parsed Successfully!' : 'Reading Test Parsed Successfully!'}
                </span>
                <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-lg border border-emerald-200 font-bold">
                  {successPreview.category}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white rounded-xl border-2 border-emerald-200/60 p-3 text-center">
                  <div className="text-lg font-extrabold text-emerald-700">{successPreview.parts.length}</div>
                  <div className="text-[10px] text-slate-500 font-bold">{selectedSkill === 'listening' ? 'Sections' : 'Parts'}</div>
                </div>
                <div className="bg-white rounded-xl border-2 border-emerald-200/60 p-3 text-center">
                  <div className="text-lg font-extrabold text-emerald-700">{totalQuestions}</div>
                  <div className="text-[10px] text-slate-500 font-bold">Questions</div>
                </div>
                <div className="bg-white rounded-xl border-2 border-emerald-200/60 p-3 text-center">
                  <div className={`text-lg font-extrabold ${answeredQuestionsCount === totalQuestions ? 'text-emerald-700' : 'text-amber-600'}`}>
                    {answeredQuestionsCount} / {totalQuestions}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold">Answers Set</div>
                </div>
                <div className="bg-white rounded-xl border-2 border-emerald-200/60 p-3 text-center">
                  <div className="text-lg font-extrabold text-emerald-700">
                    {explainedQuestionsCount} / {totalQuestions}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold">Explanations</div>
                </div>
              </div>

              {answeredQuestionsCount < totalQuestions && (
                <div className="p-3 bg-amber-50 border-2 border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Heads up:</strong> {totalQuestions - answeredQuestionsCount} question(s) are missing an answer key. You can attach an answer key below or set them in the editor.
                  </span>
                </div>
              )}

              <div className="space-y-2 text-xs">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-slate-600 shrink-0">Title:</span>
                  <span className="font-extrabold text-slate-900 truncate">{successPreview.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-600 shrink-0">Save to Collection:</span>
                  <select
                    value={selectedCollection}
                    onChange={(e) => setSelectedCollection(e.target.value)}
                    className="flex-1 bg-white border-2 border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold outline-none focus:border-blue-600"
                  >
                    {collections.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t-2 border-emerald-200/60 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetState}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 transition mr-auto font-bold flex items-center gap-1"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndEdit}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-200 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit in Visual Editor</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndReturn}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save &amp; Finish</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndTakeTest}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Save &amp; Start Test</span>
                </button>
              </div>
            </div>
          )}

          {/* ── Writing Success Preview Card ──────────────────────────────────── */}
          {writingPreview && (
            <div className="p-5 bg-emerald-50/70 border-2 border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-3.5 animate-in fade-in shadow-2xs">
              <div className="flex items-center justify-between border-b-2 border-emerald-200/60 pb-2.5">
                <span className="font-extrabold text-sm text-emerald-900 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Writing Test Parsed Successfully!
                </span>
                <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-lg border border-emerald-200 font-bold">
                  Task 1 &amp; Task 2 Ready
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border-2 border-emerald-200/60 p-3 text-center">
                  <div className="text-lg font-extrabold text-emerald-700">2 Tasks</div>
                  <div className="text-[10px] text-slate-500 font-bold">Task 1 + Task 2</div>
                </div>
                <div className="bg-white rounded-xl border-2 border-emerald-200/60 p-3 text-center">
                  <div className="text-lg font-extrabold text-emerald-700">400+</div>
                  <div className="text-[10px] text-slate-500 font-bold">Target Words (150+250)</div>
                </div>
                <div className="bg-white rounded-xl border-2 border-emerald-200/60 p-3 text-center">
                  <div className="text-lg font-extrabold text-emerald-700">{writingPreview.durationMinutes || 60}</div>
                  <div className="text-[10px] text-slate-500 font-bold">Minutes</div>
                </div>
              </div>

              <div className="space-y-1.5 bg-white p-3.5 rounded-xl border-2 border-emerald-200/60 text-xs">
                <div><strong className="text-slate-900">Title:</strong> {writingPreview.title}</div>
                <div><strong className="text-slate-900">Task 1:</strong> {writingPreview.task1.title} ({writingPreview.task1.chartType || 'bar'} chart)</div>
                <div><strong className="text-slate-900">Task 2:</strong> {writingPreview.task2.title}</div>
                <div><strong className="text-slate-900">Collection:</strong> {selectedCollection}</div>
              </div>

              <div className="pt-2 border-t-2 border-emerald-200/60 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetState}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 transition mr-auto font-bold"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndEdit}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-200 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Open in Visual Writing Editor</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndReturn}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Writing Test</span>
                </button>
              </div>
            </div>
          )}

          {/* ── Speaking Success Preview Card ─────────────────────────────────── */}
          {speakingPreview && (
            <div className="p-5 bg-emerald-50/70 border-2 border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-3.5 animate-in fade-in shadow-2xs">
              <div className="flex items-center justify-between border-b-2 border-emerald-200/60 pb-2.5">
                <span className="font-extrabold text-sm text-emerald-900 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Speaking Test Parsed Successfully!
                </span>
                <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-lg border border-emerald-200 font-bold">
                  Parts 1, 2 &amp; 3 Ready
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border-2 border-emerald-200/60 p-3 text-center">
                  <div className="text-lg font-extrabold text-emerald-700">{speakingPreview.part1Questions.length}</div>
                  <div className="text-[10px] text-slate-500 font-bold">Part 1 Questions</div>
                </div>
                <div className="bg-white rounded-xl border-2 border-emerald-200/60 p-3 text-center">
                  <div className="text-lg font-extrabold text-emerald-700">1 Cue Card</div>
                  <div className="text-[10px] text-slate-500 font-bold">Part 2 with Bullets</div>
                </div>
                <div className="bg-white rounded-xl border-2 border-emerald-200/60 p-3 text-center">
                  <div className="text-lg font-extrabold text-emerald-700">{speakingPreview.part3Questions.length}</div>
                  <div className="text-[10px] text-slate-500 font-bold">Part 3 Questions</div>
                </div>
              </div>

              <div className="space-y-1.5 bg-white p-3.5 rounded-xl border-2 border-emerald-200/60 text-xs">
                <div><strong className="text-slate-900">Title:</strong> {speakingPreview.title}</div>
                <div><strong className="text-slate-900">Part 2 Cue Card:</strong> &ldquo;{speakingPreview.part2Question.questionText}&rdquo;</div>
                <div><strong className="text-slate-900">Collection:</strong> {selectedCollection}</div>
              </div>

              <div className="pt-2 border-t-2 border-emerald-200/60 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetState}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 transition mr-auto font-bold"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndEdit}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-200 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Open in Visual Speaking Editor</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndReturn}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Speaking Test</span>
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
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-gray-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4
                    className="text-sm font-extrabold text-gray-900"
                    style={{ fontFamily: outfit.style.fontFamily }}
                  >
                    Click to browse or drop your {selectedSkill.toUpperCase()} file here
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Accepts standard <code className="bg-gray-100 px-1.5 py-0.5 rounded-md text-gray-700 font-mono">.txt</code> or JSON backup files
                  </p>
                </div>
              </div>

              {/* Supported formats guidance */}
              <div className="p-4 bg-slate-50 border-2 border-gray-200 rounded-2xl text-xs space-y-1 text-gray-600">
                <span className="font-extrabold text-gray-800 block">Accepted File Types:</span>
                <div>• <strong>.txt:</strong> Clean text formatted according to the {selectedSkill.toUpperCase()} syntax guide.</div>
                <div>• <strong>.json:</strong> Exported JSON backup files.</div>
              </div>
            </div>
          )}

          {/* ── TAB 2: PASTE TXT CONTENT ──────────────────────────────────────── */}
          {activeTab === 'txt_paste' && !successPreview && !writingPreview && !speakingPreview && (
            <div className="space-y-3.5">
              {/* Audio Upload Bar for Listening */}
              {selectedSkill === 'listening' && (
                <div className="p-3.5 bg-blue-50/70 border-2 border-blue-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Music className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <span className="font-extrabold text-slate-800 block">Audio Recording Track:</span>
                      <span className="text-[11px] text-slate-500 truncate block">
                        {audioNotice || 'Upload an audio recording file (.mp3 / .m4a / .wav) to save directly to web folder'}
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
                <label className="text-xs font-bold text-gray-700">
                  Copy &amp; paste {selectedSkill.toUpperCase()} text content:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopySkillTemplate}
                    className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1 font-bold transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied Template!' : 'Copy Template'}</span>
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={handleLoadSkillTemplateToEditor}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-bold transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Insert Sample Content</span>
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  value={txtContent}
                  onChange={(e) => setTxtContent(e.target.value)}
                  rows={12}
                  spellCheck={false}
                  placeholder={`Paste ${selectedSkill} text formatted with tags. Click "Insert Sample Content" above to see the official structure.`}
                  className="w-full font-mono text-xs p-3.5 bg-slate-50 text-slate-900 border-2 border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-blue-600 leading-relaxed resize-y"
                />
                {charCount > 0 && (
                  <div className="absolute bottom-2.5 right-3 text-[10px] font-bold text-slate-500 bg-white/90 border border-gray-200 px-2 py-0.5 rounded-lg pointer-events-none">
                    {charCount.toLocaleString()} chars
                  </div>
                )}
              </div>

              {/* Optional Attached Answer Key & Explanations Matcher */}
              {(selectedSkill === 'reading' || selectedSkill === 'listening') && (
                <div className="border-2 border-gray-200 rounded-2xl bg-slate-50/70 p-3.5 space-y-2">
                  <div
                    className="flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setShowKeyMatcher(!showKeyMatcher)}
                  >
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-extrabold text-gray-800">
                        Attach Separate Answer Key &amp; Explanations (Optional)
                      </span>
                      {answerKeyText.trim() && (
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                          {parseQuickKeyText(answerKeyText).length} answers loaded
                        </span>
                      )}
                    </div>
                    <button type="button" className="text-gray-400 hover:text-gray-600">
                      {showKeyMatcher ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {showKeyMatcher && (
                    <div className="space-y-2 pt-1 animate-in fade-in">
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        Have an answer sheet or AI explanation output? Paste it here (e.g. <code className="bg-white px-1 py-0.5 rounded border">1. TRUE | Paragraph 1 states...</code>, <code className="bg-white px-1 py-0.5 rounded border">2. FALSE</code>, <code className="bg-white px-1 py-0.5 rounded border">21-22. A, C</code>). The system will automatically match each answer and explanation to its question number.
                      </p>
                      <textarea
                        value={answerKeyText}
                        onChange={(e) => setAnswerKeyText(e.target.value)}
                        rows={5}
                        placeholder="1. TRUE | Paragraph 1 confirms...&#10;2. FALSE - line 24 contradicts...&#10;3. NOT GIVEN&#10;4. B&#10;21-22. A, C"
                        className="w-full font-mono text-xs p-3 bg-white border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Action row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {/* Collection selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700 shrink-0">Collection:</span>
                  <select
                    value={selectedCollection}
                    onChange={(e) => setSelectedCollection(e.target.value)}
                    className="bg-white border-2 border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-900 font-bold outline-none focus:border-blue-600 cursor-pointer"
                  >
                    {collections.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Parse & Preview */}
                  <button
                    type="button"
                    onClick={handleParseTxt}
                    disabled={isLoading || !txtContent.trim()}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border-2 border-gray-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Parse and show a preview of the test structure"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Check &amp; Preview</span>
                  </button>

                  {/* Direct Save */}
                  <button
                    type="button"
                    onClick={() => handleDirectAction('save_only')}
                    disabled={isLoading || !txtContent.trim() || hasSpeakingValidationErrors}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Parse, save to bank and return"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Import {selectedSkill.toUpperCase()} Test</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3: SYNTAX GUIDE & INSTRUCTIONS ────────────────────────────── */}
          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs text-slate-700">
              {/* Header Info */}
              <div className="flex items-center justify-between border-b-2 border-gray-100 pb-2.5">
                <div>
                  <h4
                    className="text-sm font-extrabold text-gray-900 flex items-center gap-1.5"
                    style={{ fontFamily: outfit.style.fontFamily }}
                  >
                    <HelpCircle className="w-4 h-4 text-blue-600" />
                    <span>Syntax Specification for {selectedSkill.toUpperCase()} Tests</span>
                  </h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Copy complete syntax tags or load them directly into the paste editor
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(getSkillSyntaxSpec());
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border-2 border-gray-200 rounded-xl text-xs font-bold text-gray-700 flex items-center gap-1.5 transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied Guide!' : 'Copy Guide'}</span>
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

              {/* Skill-Specific Syntax Code Block */}
              <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[380px] shadow-inner">
                <pre>{getSkillSyntaxSpec()}</pre>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="px-6 py-3.5 border-t-2 border-gray-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <span className="text-xs font-medium text-gray-500">
            Prefer building {selectedSkill} tests with interactive form fields?
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="px-3.5 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-200/60 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onClose();
                if (selectedSkill === 'writing') {
                  if (onOpenWritingEditor) onOpenWritingEditor(null);
                } else if (selectedSkill === 'speaking') {
                  if (onOpenSpeakingEditor) onOpenSpeakingEditor(null);
                } else {
                  onOpenManualEditor();
                }
              }}
              className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-800 border-2 border-gray-200 text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1.5 transition"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-600" />
              <span>Open Visual {selectedSkill.toUpperCase()} Editor</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SmartImportModal;
