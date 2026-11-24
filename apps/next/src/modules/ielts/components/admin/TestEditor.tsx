import { useState, useRef, useEffect, useMemo, useCallback, type FC } from 'react';
import { useToast } from '@chakra-ui/react';
import { outfit } from '@pno/lib/chakra-theme';
import type { Exam, Part, QuestionGroup, Question, QuestionType } from '../../types/exam';
import { parseQuickKeyText, AI_EXPLAIN_PROMPT_TEMPLATE } from '../../utils/keyMatcher';
import { getAllCollections, getExamCollection, isListeningExam } from '../../utils/storage';
import { uploadMediaFile } from '../../utils/mediaUploader';
import { useAudioBlob } from '../../hooks/useAudioBlob';
import { MediaEmbed } from '../exam/MediaEmbed';
import {
  Plus,
  Trash2,
  Save,
  BookOpen,
  Layers,
  Sparkles,
  Copy,
  Check,
  X,
  Folder,
  Headphones,
  Upload,
  Music,
  Volume2,
  FileText,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ArrowUp,
  ArrowDown,
  ListOrdered,
  LayoutList,
  Columns,
  Image as ImageIcon,
  Video,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface TestEditorProps {
  initialExam?: Exam | null;
  defaultCollection?: string;
  defaultSkill?: 'reading' | 'listening';
  defaultViewMode?: 'all' | 'tabs';
  onSave: (exam: Exam) => void;
  onCancel: () => void;
}

interface HealthIssue {
  id: string;
  label: string;
  partIndex: number;
  questionOrder?: number;
}

const AudioTrackPreview: FC<{ audioUrl: string; onClear: () => void }> = ({ audioUrl, onClear }) => {
  const { blobUrl, isLoading } = useAudioBlob(audioUrl);

  return (
    <div className="pt-2 p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg space-y-1.5">
      <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
        <span className="flex items-center gap-1">
          <Music className="w-3.5 h-3.5 text-blue-600" />
          <span>Audio Track Preview</span>
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] text-rose-600 hover:underline"
        >
          Clear audio
        </button>
      </div>
      {isLoading ? (
        <div className="text-xs text-slate-500 flex items-center gap-1.5 py-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
          <span>Loading audio into memory...</span>
        </div>
      ) : (
        <audio controls src={blobUrl || audioUrl} className="w-full h-8" preload="metadata" />
      )}
    </div>
  );
};

function createInitialExamState(
  initialExam: Exam | null | undefined,
  defaultCollection: string | undefined,
  defaultSkill: 'reading' | 'listening'
): Exam {
  if (initialExam) {
    const cloned: Exam = JSON.parse(JSON.stringify(initialExam));
    if (!Array.isArray(cloned.parts)) cloned.parts = [];
    if (cloned.parts.length === 0) {
      cloned.parts.push({
        id: 'part-1',
        partNumber: 1,
        title: 'Reading Passage 1',
        subtitle: '',
        passage: '',
        footnotes: '',
        audioUrl: '',
        questionGroups: [],
      });
    }
    cloned.parts.forEach((p, idx) => {
      p.partNumber = idx + 1;
      if (!Array.isArray(p.questionGroups)) p.questionGroups = [];
      p.questionGroups.forEach((g) => {
        if (!Array.isArray(g.questions)) g.questions = [];
      });
    });
    return cloned;
  }

  if (defaultSkill === 'listening') {
    return {
      id: 'exam_' + Date.now(),
      title: 'NEW IELTS LISTENING TEST',
      description: 'Custom listening practice test',
      category: 'IELTS Listening',
      collection: defaultCollection || 'My Tests',
      durationMinutes: 30,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isBuiltin: false,
      parts: [1, 2, 3, 4].map((num) => ({
        id: `part-${num}`,
        partNumber: num,
        title: `Section ${num}`,
        subtitle: '',
        passage: '',
        footnotes: '',
        audioUrl: '',
        questionGroups: [],
      })),
    };
  }

  return {
    id: 'exam_' + Date.now(),
    title: 'NEW IELTS PRACTICE TEST',
    description: 'Custom practice test',
    category: 'IELTS Academic Reading',
    collection: defaultCollection || 'My Tests',
    durationMinutes: 60,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isBuiltin: false,
    parts: [1, 2, 3].map((num) => ({
      id: `part-${num}`,
      partNumber: num,
      title: `Reading Passage ${num}`,
      subtitle: '',
      passage: num === 1 ? 'Enter passage 1 text here...' : '',
      footnotes: '',
      audioUrl: '',
      questionGroups:
        num === 1
          ? [
              {
                id: 'p1-g1',
                title: 'Questions 1–1',
                instructions:
                  'Do the following statements agree with the information given in the text? Choose TRUE, FALSE, or NOT GIVEN.',
                questions: [
                  {
                    id: 'q1',
                    orderNumber: 1,
                    type: 'TRUE_FALSE_NOT_GIVEN',
                    prompt: 'Question 1 prompt...',
                    correctAnswer: 'TRUE',
                    explanation: '',
                  },
                ],
              },
            ]
          : [],
    })),
  };
}

export const TestEditor: FC<TestEditorProps> = ({
  initialExam,
  defaultCollection,
  defaultSkill = 'reading',
  defaultViewMode = 'all',
  onSave,
  onCancel,
}) => {
  const toast = useToast();
  const [showQuickKeyModal, setShowQuickKeyModal] = useState(false);
  const [quickKeyText, setQuickKeyText] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [quickKeyTab, setQuickKeyTab] = useState<'paste' | 'prompt'>('paste');
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [audioUploadNotice, setAudioUploadNotice] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'tabs'>(defaultViewMode);
  const [activeTab, setActiveTab] = useState<'info' | number>('info');
  const [collapsedParts, setCollapsedParts] = useState<Record<number, boolean>>({});
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const [exam, setExam] = useState<Exam>(() =>
    createInitialExamState(initialExam, defaultCollection, defaultSkill)
  );
  const initialSnapshotRef = useRef<string>(JSON.stringify(exam));
  const isDirty = useMemo(
    () => JSON.stringify(exam) !== initialSnapshotRef.current,
    [exam]
  );

  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const audioUploadTargetPartRef = useRef<number>(0);

  const isListening = isListeningExam(exam);

  const collections = useMemo(() => getAllCollections(), []);
  const canonicalCollection = useMemo(() => {
    const raw = exam.collection || getExamCollection(exam);
    const match = collections.find((c) => c.name.toLowerCase() === raw.toLowerCase());
    return match ? match.name : raw;
  }, [exam, collections]);
  const hasCanonicalCollection = collections.some(
    (c) => c.name.toLowerCase() === canonicalCollection.toLowerCase()
  );

  // Health diagnostics across all parts
  const healthIssues = useMemo<HealthIssue[]>(() => {
    const issues: HealthIssue[] = [];
    const seenNumbers = new Map<number, number>();
    let totalQs = 0;

    exam.parts.forEach((part, pIdx) => {
      if (isListening && !part.audioUrl?.trim()) {
        issues.push({
          id: `missing-audio-${pIdx}`,
          label: `Section ${part.partNumber} missing audio`,
          partIndex: pIdx,
        });
      }

      (part.questionGroups || []).forEach((group) => {
        (group.questions || []).forEach((q) => {
          totalQs++;
          seenNumbers.set(q.orderNumber, (seenNumbers.get(q.orderNumber) || 0) + 1);
          const hasAnswer = Array.isArray(q.correctAnswer)
            ? q.correctAnswer.length > 0
            : Boolean(q.correctAnswer && String(q.correctAnswer).trim());
          if (!hasAnswer) {
            issues.push({
              id: `missing-ans-${part.partNumber}-${q.id}`,
              label: `Q${q.orderNumber} missing answer`,
              partIndex: pIdx,
              questionOrder: q.orderNumber,
            });
          }
          if (!q.prompt?.trim()) {
            issues.push({
              id: `empty-prompt-${part.partNumber}-${q.id}`,
              label: `Q${q.orderNumber} empty prompt`,
              partIndex: pIdx,
              questionOrder: q.orderNumber,
            });
          }
        });
      });
    });

    if (totalQs === 0) {
      issues.unshift({
        id: 'zero-qs',
        label: 'No questions added yet',
        partIndex: 0,
      });
    }

    const duplicates = Array.from(seenNumbers.entries())
      .filter(([, cnt]) => cnt > 1)
      .map(([num]) => num);
    if (duplicates.length > 0) {
      issues.unshift({
        id: 'dup-nums',
        label: `Duplicate Q numbers: ${duplicates.join(', ')} (click Auto-Renumber)`,
        partIndex: 0,
      });
    }

    return issues;
  }, [exam, isListening]);

  const handleSave = useCallback(() => {
    if (!exam.title.trim()) {
      setActiveTab('info');
      toast({
        title: 'Please enter a test title',
        status: 'warning',
        duration: 2500,
        isClosable: true,
        position: 'bottom-right',
      });
      return;
    }

    const sanitized: Exam = {
      ...exam,
      title: exam.title.trim(),
      collection: canonicalCollection || 'My Tests',
      updatedAt: Date.now(),
    };
    delete sanitized.dataFile;
    initialSnapshotRef.current = JSON.stringify(sanitized);
    onSave(sanitized);
  }, [exam, canonicalCollection, onSave, toast]);

  const requestCancel = useCallback(() => {
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    onCancel();
  }, [isDirty, onCancel]);

  // Ctrl+S / Cmd+S to save, Esc to request cancel
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        if (showQuickKeyModal) {
          setShowQuickKeyModal(false);
        } else if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else {
          e.preventDefault();
          requestCancel();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave, requestCancel, showQuickKeyModal, showDiscardConfirm]);

  const handleUpdateExamField = <K extends keyof Exam>(field: K, value: Exam[K]) => {
    setExam((prev) => ({ ...prev, [field]: value }));
  };

  const getPartQuestionCount = (partIndex: number): number => {
    const part = exam.parts?.[partIndex];
    if (!part || !Array.isArray(part.questionGroups)) return 0;
    return part.questionGroups.reduce(
      (acc, g) => acc + (Array.isArray(g.questions) ? g.questions.length : 0),
      0
    );
  };

  const handleUpdatePart = <K extends keyof Part>(partIdx: number, field: K, value: Part[K]) => {
    setExam((prev) => ({
      ...prev,
      parts: prev.parts.map((p, idx) => (idx === partIdx ? { ...p, [field]: value } : p)),
    }));
  };

  const handleUpdateGroup = <K extends keyof QuestionGroup>(
    partIdx: number,
    groupId: string,
    field: K,
    value: QuestionGroup[K]
  ) => {
    setExam((prev) => ({
      ...prev,
      parts: prev.parts.map((p, idx) =>
        idx !== partIdx
          ? p
          : {
              ...p,
              questionGroups: (p.questionGroups || []).map((g) =>
                g.id === groupId ? { ...g, [field]: value } : g
              ),
            }
      ),
    }));
  };

  const handleConvertToListening = () => {
    if (initialExam) return;
    const updatedParts: Part[] = [1, 2, 3, 4].map((i) => {
      const existing = exam.parts[i - 1];
      return {
        id: existing?.id || `part-${Date.now()}-${i}`,
        partNumber: i,
        title:
          existing?.title && !existing.title.toLowerCase().startsWith('reading')
            ? existing.title
            : `Section ${i}`,
        subtitle: existing?.subtitle || '',
        passage: existing?.passage || '',
        footnotes: existing?.footnotes || '',
        audioUrl: existing?.audioUrl || (i > 1 ? exam.parts[0]?.audioUrl : '') || '',
        imageUrl: existing?.imageUrl,
        videoUrl: existing?.videoUrl,
        questionGroups: existing?.questionGroups || [],
      };
    });
    setExam((prev) => ({
      ...prev,
      category: 'IELTS Listening',
      durationMinutes: 30,
      parts: updatedParts,
    }));
    toast({
      title: 'Switched to Listening format (4 Sections • 30 mins)',
      status: 'info',
      duration: 2000,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  const handleConvertToReading = () => {
    if (initialExam) return;
    const updatedParts: Part[] = [1, 2, 3].map((i) => {
      const existing = exam.parts[i - 1];
      return {
        id: existing?.id || `part-${Date.now()}-${i}`,
        partNumber: i,
        title:
          existing?.title && !existing.title.toLowerCase().startsWith('section')
            ? existing.title
            : `Reading Passage ${i}`,
        subtitle: existing?.subtitle || '',
        passage: existing?.passage || '',
        footnotes: existing?.footnotes || '',
        audioUrl: '',
        imageUrl: existing?.imageUrl,
        videoUrl: existing?.videoUrl,
        questionGroups: existing?.questionGroups || [],
      };
    });
    setExam((prev) => ({
      ...prev,
      category: 'IELTS Academic Reading',
      durationMinutes: 60,
      parts: updatedParts,
    }));
    toast({
      title: 'Switched to Reading format (3 Passages • 60 mins)',
      status: 'info',
      duration: 2000,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  const handleAddPart = () => {
    const nextPartNum = exam.parts.length + 1;
    const newPart: Part = {
      id: `part-${Date.now()}-${nextPartNum}`,
      partNumber: nextPartNum,
      title: isListening ? `Section ${nextPartNum}` : `Reading Passage ${nextPartNum}`,
      subtitle: '',
      passage: '',
      footnotes: '',
      audioUrl: isListening ? exam.parts[0]?.audioUrl || '' : '',
      questionGroups: [],
    };
    const nextIdx = exam.parts.length;
    setExam((prev) => ({ ...prev, parts: [...prev.parts, newPart] }));
    if (viewMode === 'tabs') {
      setActiveTab(nextIdx);
    } else {
      setTimeout(() => {
        document.getElementById(`editor-part-${nextIdx}`)?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    }
  };

  const handleDeletePart = (partIdx: number) => {
    if (exam.parts.length <= 1) {
      toast({
        title: 'A practice test must contain at least one part or section',
        status: 'warning',
        duration: 2400,
        isClosable: true,
        position: 'bottom-right',
      });
      return;
    }
    const part = exam.parts[partIdx];
    if (!part) return;
    setExam((prev) => ({
      ...prev,
      parts: prev.parts
        .filter((_, idx) => idx !== partIdx)
        .map((p, idx) => ({ ...p, partNumber: idx + 1 })),
    }));
    if (viewMode === 'tabs') {
      setActiveTab(Math.max(0, partIdx - 1));
    }
    toast({
      title: `Removed ${part.title}`,
      status: 'info',
      duration: 2000,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  const handleCopyAudioToAllSections = (partIdx: number) => {
    const sourceAudio = exam.parts[partIdx]?.audioUrl;
    if (!sourceAudio) {
      toast({
        title: 'No audio URL set on this section to copy',
        status: 'warning',
        duration: 2400,
        isClosable: true,
        position: 'bottom-right',
      });
      return;
    }
    setExam((prev) => ({
      ...prev,
      parts: prev.parts.map((p) => ({ ...p, audioUrl: sourceAudio })),
    }));
    toast({
      title: `Applied audio track to all ${exam.parts.length} sections`,
      status: 'success',
      duration: 2000,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const targetIdx = audioUploadTargetPartRef.current;

    setUploadingKey(`audio-${targetIdx}`);
    setAudioUploadNotice(null);

    try {
      const result = await uploadMediaFile(file, 'listening', exam.id || 'custom-test');
      handleUpdatePart(targetIdx, 'audioUrl', result.url);
      setAudioUploadNotice(`Audio saved: ${result.url}`);
      setTimeout(() => setAudioUploadNotice(null), 5000);
    } catch (err) {
      toast({
        title: 'Audio upload failed',
        description: err instanceof Error ? err.message : 'Unable to upload file.',
        status: 'error',
        duration: 2800,
        isClosable: true,
        position: 'bottom-right',
      });
    } finally {
      setUploadingKey(null);
      if (audioFileInputRef.current) audioFileInputRef.current.value = '';
    }
  };

  const handleUploadPartOrGroupMedia = async (
    file: File,
    kind: 'image' | 'video',
    partIdx: number,
    groupId?: string
  ) => {
    const key = `${kind}-${partIdx}-${groupId || 'part'}`;
    setUploadingKey(key);
    try {
      const res = await uploadMediaFile(
        file,
        isListening ? 'listening' : 'reading',
        exam.id || 'custom-test'
      );
      const field = kind === 'image' ? 'imageUrl' : 'videoUrl';
      if (groupId) {
        handleUpdateGroup(partIdx, groupId, field, res.url);
      } else {
        handleUpdatePart(partIdx, field, res.url);
      }
      toast({
        title: `${kind === 'image' ? 'Image' : 'Video'} uploaded`,
        status: 'success',
        duration: 1800,
        isClosable: true,
        position: 'bottom-right',
      });
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Unable to upload media.',
        status: 'error',
        duration: 2800,
        isClosable: true,
        position: 'bottom-right',
      });
    } finally {
      setUploadingKey(null);
    }
  };

  const calculateNextQuestionNumber = () => {
    let maxNum = 0;
    (exam.parts || []).forEach((p) => {
      (p.questionGroups || []).forEach((g) => {
        (g.questions || []).forEach((q) => {
          if (q.orderNumber > maxNum) maxNum = q.orderNumber;
        });
      });
    });
    return maxNum + 1;
  };

  const handleAddQuestionGroup = (partIdx: number) => {
    const startQ = calculateNextQuestionNumber();
    const newGroup: QuestionGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      title: `Questions ${startQ}–${startQ + 4}`,
      instructions: isListening
        ? 'Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.'
        : 'Do the following statements agree with the information given in the text? Choose TRUE, FALSE, or NOT GIVEN.',
      questions: [],
    };
    setExam((prev) => ({
      ...prev,
      parts: prev.parts.map((p, idx) =>
        idx === partIdx ? { ...p, questionGroups: [...(p.questionGroups || []), newGroup] } : p
      ),
    }));
  };

  const handleDeleteGroup = (partIdx: number, groupId: string) => {
    setExam((prev) => ({
      ...prev,
      parts: prev.parts.map((p, idx) =>
        idx === partIdx
          ? { ...p, questionGroups: (p.questionGroups || []).filter((g) => g.id !== groupId) }
          : p
      ),
    }));
  };

  const handleMoveGroup = (partIdx: number, gIdx: number, dir: -1 | 1) => {
    setExam((prev) => ({
      ...prev,
      parts: prev.parts.map((p, idx) => {
        if (idx !== partIdx) return p;
        const groups = [...(p.questionGroups || [])];
        const targetIdx = gIdx + dir;
        if (targetIdx < 0 || targetIdx >= groups.length) return p;
        const [moved] = groups.splice(gIdx, 1);
        groups.splice(targetIdx, 0, moved!);
        return { ...p, questionGroups: groups };
      }),
    }));
  };

  const handleAddQuestionToGroup = (partIdx: number, groupId: string) => {
    const nextNum = calculateNextQuestionNumber();
    const newQuestion: Question = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      orderNumber: nextNum,
      type: isListening ? 'FILL_IN_BLANK' : 'TRUE_FALSE_NOT_GIVEN',
      prompt: isListening ? `Question ${nextNum}` : `Question prompt ${nextNum}...`,
      correctAnswer: isListening ? '' : 'TRUE',
      explanation: '',
    };

    setExam((prev) => ({
      ...prev,
      parts: prev.parts.map((p, idx) =>
        idx !== partIdx
          ? p
          : {
              ...p,
              questionGroups: (p.questionGroups || []).map((g) =>
                g.id === groupId ? { ...g, questions: [...g.questions, newQuestion] } : g
              ),
            }
      ),
    }));
  };

  const handleUpdateQuestion = <K extends keyof Question>(
    partIdx: number,
    groupId: string,
    questionId: string,
    field: K,
    val: Question[K]
  ) => {
    setExam((prev) => ({
      ...prev,
      parts: prev.parts.map((p, idx) =>
        idx !== partIdx
          ? p
          : {
              ...p,
              questionGroups: (p.questionGroups || []).map((g) =>
                g.id !== groupId
                  ? g
                  : {
                      ...g,
                      questions: g.questions.map((q) =>
                        q.id === questionId ? { ...q, [field]: val } : q
                      ),
                    }
              ),
            }
      ),
    }));
  };

  const handleDeleteQuestion = (partIdx: number, groupId: string, questionId: string) => {
    setExam((prev) => ({
      ...prev,
      parts: prev.parts.map((p, idx) =>
        idx !== partIdx
          ? p
          : {
              ...p,
              questionGroups: (p.questionGroups || []).map((g) =>
                g.id === groupId
                  ? { ...g, questions: g.questions.filter((q) => q.id !== questionId) }
                  : g
              ),
            }
      ),
    }));
  };

  const handleMoveQuestion = (partIdx: number, groupId: string, qIdx: number, dir: -1 | 1) => {
    setExam((prev) => ({
      ...prev,
      parts: prev.parts.map((p, idx) =>
        idx !== partIdx
          ? p
          : {
              ...p,
              questionGroups: (p.questionGroups || []).map((g) => {
                if (g.id !== groupId) return g;
                const qs = [...g.questions];
                const target = qIdx + dir;
                if (target < 0 || target >= qs.length) return g;
                const [moved] = qs.splice(qIdx, 1);
                qs.splice(target, 0, moved!);
                return { ...g, questions: qs };
              }),
            }
      ),
    }));
  };

  const handleDuplicateQuestion = (partIdx: number, groupId: string, qIdx: number) => {
    const nextNum = calculateNextQuestionNumber();
    setExam((prev) => ({
      ...prev,
      parts: prev.parts.map((p, idx) =>
        idx !== partIdx
          ? p
          : {
              ...p,
              questionGroups: (p.questionGroups || []).map((g) => {
                if (g.id !== groupId) return g;
                const source = g.questions[qIdx];
                if (!source) return g;
                const cloned: Question = {
                  ...JSON.parse(JSON.stringify(source)),
                  id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                  orderNumber: nextNum,
                };
                const nextQs = [...g.questions];
                nextQs.splice(qIdx + 1, 0, cloned);
                return { ...g, questions: nextQs };
              }),
            }
      ),
    }));
  };

  const handleAutoRenumberAll = () => {
    let counter = 1;
    setExam((prev) => ({
      ...prev,
      parts: prev.parts.map((part) => ({
        ...part,
        questionGroups: (part.questionGroups || []).map((group) => {
          const start = counter;
          const nextQuestions = (group.questions || []).map((q) => ({
            ...q,
            orderNumber: counter++,
          }));
          const end = counter - 1;
          const nextTitle =
            nextQuestions.length > 0 && /^Questions?\s*\d+/i.test(group.title)
              ? start === end
                ? `Question ${start}`
                : `Questions ${start}–${end}`
              : group.title;
          return { ...group, title: nextTitle, questions: nextQuestions };
        }),
      })),
    }));
    toast({
      title: `Renumbered all questions (1–${Math.max(1, counter - 1)})`,
      status: 'success',
      duration: 2000,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  const jumpToIssue = (issue: HealthIssue) => {
    if (viewMode === 'tabs') {
      setActiveTab(issue.partIndex);
    } else {
      setCollapsedParts((prev) => ({ ...prev, [issue.partIndex]: false }));
    }
    setTimeout(() => {
      const targetEl = issue.questionOrder
        ? document.getElementById(`editor-q-${issue.questionOrder}`)
        : document.getElementById(`editor-part-${issue.partIndex}`);
      targetEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  const handleCopyAIPrompt = () => {
    void navigator.clipboard.writeText(AI_EXPLAIN_PROMPT_TEMPLATE);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleApplyQuickKeys = () => {
    const parsedItems = parseQuickKeyText(quickKeyText);
    if (parsedItems.length === 0) {
      toast({
        title: 'No questions detected',
        description: 'Please check your pasted answer key text.',
        status: 'warning',
        duration: 2800,
        isClosable: true,
        position: 'bottom-right',
      });
      return;
    }
    const keyMap = new Map(parsedItems.map((item) => [item.orderNumber, item]));
    setExam((prev) => ({
      ...prev,
      parts: prev.parts.map((part) => ({
        ...part,
        questionGroups: (part.questionGroups || []).map((group) => ({
          ...group,
          questions: (group.questions || []).map((q) => {
            const matched = keyMap.get(q.orderNumber);
            if (!matched) return q;
            const nextAns =
              q.type === 'MULTIPLE_CHOICE_MULTI'
                ? matched.answer.split(/[,;\s]+/).filter(Boolean)
                : matched.answer || q.correctAnswer;
            return {
              ...q,
              correctAnswer: nextAns,
              explanation: matched.explanation || q.explanation,
            };
          }),
        })),
      })),
    }));
    setShowQuickKeyModal(false);
    setQuickKeyText('');
    toast({
      title: `Applied answers & explanations to ${parsedItems.length} questions`,
      status: 'success',
      duration: 2500,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  const renderGeneralInfoCard = () => (
    <div
      id="editor-section-info"
      className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-6 space-y-5 shadow-xs"
    >
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
        <h3
          className="text-sm font-extrabold text-gray-900 dark:text-gray-100 uppercase tracking-wider"
          style={{ fontFamily: outfit.style.fontFamily }}
        >
          General Test Information
        </h3>
        {initialExam && (
          <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 bg-slate-100 dark:bg-gray-900 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-gray-700">
            {isListening ? 'Listening Format' : 'Reading Format'}
          </span>
        )}
      </div>

      {!initialExam && (
        <div className="p-4 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl space-y-3">
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide block">
            Select Test Format
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleConvertToReading}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition ${
                !isListening
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Reading Test (3 Passages • 60 Mins)</span>
            </button>

            <button
              type="button"
              onClick={handleConvertToListening}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition ${
                isListening
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Headphones className="w-4 h-4" />
              <span>Listening Test (Audio + 4 Sections • 30 Mins)</span>
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
          Test Title *
        </label>
        <input
          type="text"
          value={exam.title}
          onChange={(e) => handleUpdateExamField('title', e.target.value)}
          placeholder={
            isListening ? 'e.g. CAMBRIDGE 21 TEST 1 LISTENING' : 'e.g. CAMBRIDGE 21 TEST 1 READING'
          }
          className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
            Category
          </label>
          <select
            value={exam.category || (isListening ? 'IELTS Listening' : 'IELTS Academic Reading')}
            onChange={(e) => {
              const cat = e.target.value;
              handleUpdateExamField('category', cat);
              if (!initialExam) {
                if (cat.toLowerCase().includes('listening') && !isListening) {
                  handleConvertToListening();
                } else if (!cat.toLowerCase().includes('listening') && isListening) {
                  handleConvertToReading();
                }
              }
            }}
            className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            {isListening ? (
              <option value="IELTS Listening">IELTS Listening</option>
            ) : (
              <>
                <option value="IELTS Academic Reading">IELTS Academic Reading</option>
                <option value="IELTS General Training Reading">IELTS General Training Reading</option>
              </>
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1 flex items-center gap-1">
            <Folder className="w-3.5 h-3.5 text-blue-600" />
            <span>Collection</span>
          </label>
          <select
            value={canonicalCollection}
            onChange={(e) => handleUpdateExamField('collection', e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-medium"
          >
            {!hasCanonicalCollection && canonicalCollection && (
              <option value={canonicalCollection}>{canonicalCollection}</option>
            )}
            {collections.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
            Duration (Minutes)
          </label>
          <input
            type="number"
            min={1}
            value={exam.durationMinutes}
            onChange={(e) =>
              handleUpdateExamField('durationMinutes', Math.max(1, parseInt(e.target.value, 10) || 60))
            }
            className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
          Description / Notes
        </label>
        <textarea
          value={exam.description || ''}
          onChange={(e) => handleUpdateExamField('description', e.target.value)}
          rows={2}
          placeholder="Source notes, difficulty level, test tips..."
          className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 font-normal"
        />
      </div>
    </div>
  );

  const renderPartSection = (part: Part, partIdx: number) => {
    const isCollapsed = viewMode === 'all' && Boolean(collapsedParts[partIdx]);
    const partQCount = getPartQuestionCount(partIdx);

    return (
      <div
        key={part.id || partIdx}
        id={`editor-part-${partIdx}`}
        className="space-y-5 bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 p-5 shadow-xs"
      >
        {/* Part Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700 pb-3">
          <button
            type="button"
            onClick={() => {
              if (viewMode === 'all') {
                setCollapsedParts((prev) => ({ ...prev, [partIdx]: !prev[partIdx] }));
              }
            }}
            className="flex items-center gap-2 text-left"
          >
            {viewMode === 'all' &&
              (isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ))}
            {isListening ? (
              <Headphones className="w-4 h-4 text-blue-600" />
            ) : (
              <BookOpen className="w-4 h-4 text-blue-600" />
            )}
            <span className="font-extrabold text-sm text-gray-900 dark:text-gray-100">
              {isListening
                ? `Section ${part.partNumber}: ${part.title || 'Untitled'}`
                : `Part ${part.partNumber}: ${part.title || 'Untitled'}`}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold">
              {partQCount} Qs
            </span>
          </button>

          {exam.parts.length > 1 && (
            <button
              type="button"
              onClick={() => handleDeletePart(partIdx)}
              className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-800 transition flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete {isListening ? 'Section' : 'Part'}</span>
            </button>
          )}
        </div>

        {!isCollapsed && (
          <div className="space-y-5">
            {/* Audio Card */}
            {(isListening || part.audioUrl) && (
              <div className="bg-slate-50 dark:bg-gray-900 rounded-xl border-2 border-blue-200 dark:border-blue-800 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 dark:border-blue-900 pb-2">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase">
                      Audio Track (Section {part.partNumber})
                    </h4>
                  </div>
                  {part.audioUrl && exam.parts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleCopyAudioToAllSections(partIdx)}
                      className="px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 rounded border border-blue-200 dark:border-blue-800 transition flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Use this audio for all sections</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={part.audioUrl || ''}
                    onChange={(e) => handleUpdatePart(partIdx, 'audioUrl', e.target.value)}
                    placeholder="e.g. https://... or /audio/..."
                    className="flex-1 px-3 py-2 text-xs border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      audioUploadTargetPartRef.current = partIdx;
                      audioFileInputRef.current?.click();
                    }}
                    disabled={uploadingKey === `audio-${partIdx}`}
                    className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg border border-slate-300 dark:border-gray-600 transition flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    {uploadingKey === `audio-${partIdx}` ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
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

                {audioUploadNotice && (
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold">{audioUploadNotice}</span>
                  </div>
                )}

                {part.audioUrl && (
                  <AudioTrackPreview
                    audioUrl={part.audioUrl}
                    onClear={() => handleUpdatePart(partIdx, 'audioUrl', '')}
                  />
                )}
              </div>
            )}

            {/* Part Title, Subtitle & Passage / Script */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {isListening ? 'Section Title' : 'Passage Title'}
                  </label>
                  <input
                    type="text"
                    value={part.title}
                    onChange={(e) => handleUpdatePart(partIdx, 'title', e.target.value)}
                    placeholder={isListening ? 'e.g. Hotel Reservation' : 'e.g. The Baobabs of Madagascar'}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {isListening ? 'Section Subtitle' : 'Passage Subtitle'}
                  </label>
                  <input
                    type="text"
                    value={part.subtitle || ''}
                    onChange={(e) => handleUpdatePart(partIdx, 'subtitle', e.target.value)}
                    placeholder="Brief summary or context..."
                    className="w-full px-3 py-1.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Part Image & Video Media Row */}
              <div className="p-3.5 bg-slate-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 block">
                  Part Visual Media (Image / Map / Video — Optional)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={part.imageUrl || ''}
                      onChange={(e) => handleUpdatePart(partIdx, 'imageUrl', e.target.value)}
                      placeholder="Image / Diagram URL..."
                      className="flex-1 px-2.5 py-1.5 text-xs border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                    />
                    <label className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:border-blue-500 cursor-pointer flex items-center gap-1 shrink-0">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleUploadPartOrGroupMedia(f, 'image', partIdx);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={part.videoUrl || ''}
                      onChange={(e) => handleUpdatePart(partIdx, 'videoUrl', e.target.value)}
                      placeholder="Video URL (YouTube / .mp4)..."
                      className="flex-1 px-2.5 py-1.5 text-xs border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                    />
                    <label className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:border-blue-500 cursor-pointer flex items-center gap-1 shrink-0">
                      <Video className="w-3.5 h-3.5" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleUploadPartOrGroupMedia(f, 'video', partIdx);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
                {(part.imageUrl || part.videoUrl) && (
                  <MediaEmbed imageUrl={part.imageUrl} videoUrl={part.videoUrl} alt={part.title} />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  {isListening
                    ? 'Audio Transcript / Script (Optional):'
                    : 'Passage Text (Separate paragraphs with an empty line):'}
                </label>
                <textarea
                  value={part.passage}
                  onChange={(e) => handleUpdatePart(partIdx, 'passage', e.target.value)}
                  rows={isListening ? 4 : 8}
                  placeholder={
                    isListening
                      ? 'Optional: Paste the audio recording transcript here...'
                      : 'Enter reading passage content...'
                  }
                  className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 font-sans leading-relaxed"
                />
              </div>

              {!isListening && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Footnotes (Optional)
                  </label>
                  <input
                    type="text"
                    value={part.footnotes || ''}
                    onChange={(e) => handleUpdatePart(partIdx, 'footnotes', e.target.value)}
                    placeholder="Vocabulary glossaries..."
                    className="w-full px-3 py-1.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}
            </div>

            {/* Question Groups */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Question Groups ({part.questionGroups.length})</span>
                </h4>
                <button
                  type="button"
                  onClick={() => handleAddQuestionGroup(partIdx)}
                  className="px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 rounded-lg border border-blue-200 dark:border-blue-800 transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Question Group</span>
                </button>
              </div>

              {part.questionGroups.length === 0 && (
                <div className="text-center py-6 bg-slate-50 dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-xs">
                  No question groups in this section yet.
                </div>
              )}

              {part.questionGroups.map((group, gIdx) => (
                <div
                  key={group.id}
                  className="bg-slate-50/70 dark:bg-gray-900/60 rounded-xl border border-gray-300 dark:border-gray-700 p-4 space-y-3.5"
                >
                  {/* Group Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700 pb-2.5">
                    <input
                      type="text"
                      value={group.title}
                      onChange={(e) => handleUpdateGroup(partIdx, group.id, 'title', e.target.value)}
                      placeholder="Group Title: Questions 1–10"
                      className="px-2.5 py-1 text-xs font-bold text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg w-56"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={gIdx === 0}
                        onClick={() => handleMoveGroup(partIdx, gIdx, -1)}
                        className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-30"
                        title="Move group up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={gIdx === part.questionGroups.length - 1}
                        onClick={() => handleMoveGroup(partIdx, gIdx, 1)}
                        className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-30"
                        title="Move group down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(partIdx, group.id)}
                        className="text-gray-400 hover:text-rose-600 p-1 rounded transition"
                        title="Delete question group"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Instructions & Shared Content */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Instructions
                      </label>
                      <textarea
                        value={group.instructions}
                        onChange={(e) =>
                          handleUpdateGroup(partIdx, group.id, 'instructions', e.target.value)
                        }
                        rows={2}
                        className="w-full px-2.5 py-1.5 text-xs border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Shared Notes / Summary Blanks (Optional, use {'{{1}}'})
                      </label>
                      <textarea
                        value={group.sharedContent || ''}
                        onChange={(e) =>
                          handleUpdateGroup(partIdx, group.id, 'sharedContent', e.target.value)
                        }
                        rows={2}
                        placeholder="e.g. Weekly rent: $ {{1}}"
                        className="w-full px-2.5 py-1.5 text-xs border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                      />
                    </div>
                  </div>

                  {/* Group Diagram / Map / Video */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={group.imageUrl || ''}
                        onChange={(e) =>
                          handleUpdateGroup(partIdx, group.id, 'imageUrl', e.target.value)
                        }
                        placeholder="Group diagram / map image URL..."
                        className="flex-1 px-2.5 py-1 text-xs border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 font-mono"
                      />
                      <label className="px-2 py-1 text-[11px] font-bold rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 cursor-pointer flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" />
                        <span>Img</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleUploadPartOrGroupMedia(f, 'image', partIdx, group.id);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={group.videoUrl || ''}
                        onChange={(e) =>
                          handleUpdateGroup(partIdx, group.id, 'videoUrl', e.target.value)
                        }
                        placeholder="Group video URL (YouTube / .mp4)..."
                        className="flex-1 px-2.5 py-1 text-xs border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 font-mono"
                      />
                      <label className="px-2 py-1 text-[11px] font-bold rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 cursor-pointer flex items-center gap-1">
                        <Video className="w-3 h-3" />
                        <span>Vid</span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleUploadPartOrGroupMedia(f, 'video', partIdx, group.id);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  {(group.imageUrl || group.videoUrl) && (
                    <MediaEmbed
                      imageUrl={group.imageUrl}
                      videoUrl={group.videoUrl}
                      alt={group.title}
                    />
                  )}

                  {/* Questions */}
                  <div className="space-y-2.5 pt-1">
                    {group.questions.map((q, qIdx) => {
                      const opts =
                        Array.isArray(q.options) && q.options.length > 0
                          ? q.options
                          : [
                              { id: 'A', text: '' },
                              { id: 'B', text: '' },
                              { id: 'C', text: '' },
                              { id: 'D', text: '' },
                            ];
                      const hasOptions =
                        q.type === 'MULTIPLE_CHOICE_SINGLE' ||
                        q.type === 'MULTIPLE_CHOICE_MULTI' ||
                        q.type === 'MATCHING';

                      return (
                        <div
                          key={q.id}
                          id={`editor-q-${q.orderNumber}`}
                          className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold bg-neutral-800 text-white px-2 py-0.5 rounded">
                                Q{q.orderNumber}
                              </span>
                              <select
                                value={q.type}
                                onChange={(e) =>
                                  handleUpdateQuestion(
                                    partIdx,
                                    group.id,
                                    q.id,
                                    'type',
                                    e.target.value as QuestionType
                                  )
                                }
                                className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-medium"
                              >
                                <option value="FILL_IN_BLANK">Fill in Blank</option>
                                <option value="MULTIPLE_CHOICE_SINGLE">Multiple Choice (Single)</option>
                                <option value="MULTIPLE_CHOICE_MULTI">Multiple Choice (Multi)</option>
                                <option value="TRUE_FALSE_NOT_GIVEN">True / False / Not Given</option>
                                <option value="YES_NO_NOT_GIVEN">Yes / No / Not Given</option>
                                <option value="MATCHING">Matching</option>
                              </select>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={qIdx === 0}
                                onClick={() => handleMoveQuestion(partIdx, group.id, qIdx, -1)}
                                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30"
                                title="Move up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={qIdx === group.questions.length - 1}
                                onClick={() => handleMoveQuestion(partIdx, group.id, qIdx, 1)}
                                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30"
                                title="Move down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateQuestion(partIdx, group.id, qIdx)}
                                className="p-1 text-gray-400 hover:text-blue-600"
                                title="Duplicate question"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteQuestion(partIdx, group.id, q.id)}
                                className="p-1 text-gray-400 hover:text-rose-600"
                                title="Delete question"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <input
                            type="text"
                            value={q.prompt}
                            onChange={(e) =>
                              handleUpdateQuestion(partIdx, group.id, q.id, 'prompt', e.target.value)
                            }
                            placeholder="Question prompt or statement..."
                            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-medium"
                          />

                          {hasOptions && (
                            <div className="space-y-1.5 pl-2 border-l-2 border-blue-300 dark:border-blue-700">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">
                                  Options:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextId = String.fromCharCode(65 + opts.length);
                                    handleUpdateQuestion(partIdx, group.id, q.id, 'options', [
                                      ...opts,
                                      { id: nextId, text: '' },
                                    ]);
                                  }}
                                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Add Option</span>
                                </button>
                              </div>
                              {opts.map((opt, optIdx) => {
                                const optId =
                                  typeof opt === 'object' && opt?.id
                                    ? opt.id
                                    : String.fromCharCode(65 + optIdx);
                                const optText =
                                  typeof opt === 'object' && opt?.text !== undefined
                                    ? opt.text
                                    : String(opt || '');
                                return (
                                  <div key={`${optId}-${optIdx}`} className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 w-5">
                                      {optId}.
                                    </span>
                                    <input
                                      type="text"
                                      value={optText}
                                      onChange={(e) => {
                                        const nextOpts = [...opts];
                                        nextOpts[optIdx] = { id: optId, text: e.target.value };
                                        handleUpdateQuestion(
                                          partIdx,
                                          group.id,
                                          q.id,
                                          'options',
                                          nextOpts
                                        );
                                      }}
                                      placeholder={`Option ${optId} text...`}
                                      className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                                    />
                                    {opts.length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nextOpts = opts.filter((_, i) => i !== optIdx);
                                          handleUpdateQuestion(
                                            partIdx,
                                            group.id,
                                            q.id,
                                            'options',
                                            nextOpts
                                          );
                                        }}
                                        className="p-1 text-gray-400 hover:text-rose-600"
                                        title="Remove option"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                            <div>
                              <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-300 mb-0.5">
                                Correct Answer{q.type === 'MULTIPLE_CHOICE_MULTI' ? 's (comma-separated)' : ''}:
                              </label>
                              <input
                                type="text"
                                value={
                                  Array.isArray(q.correctAnswer)
                                    ? q.correctAnswer.join(', ')
                                    : q.correctAnswer || ''
                                }
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const val: string | string[] =
                                    q.type === 'MULTIPLE_CHOICE_MULTI'
                                      ? raw
                                          .split(',')
                                          .map((s) => s.trim())
                                          .filter(Boolean)
                                      : raw;
                                  handleUpdateQuestion(
                                    partIdx,
                                    group.id,
                                    q.id,
                                    'correctAnswer',
                                    val
                                  );
                                }}
                                placeholder={
                                  q.type === 'MULTIPLE_CHOICE_MULTI'
                                    ? 'e.g. A, C'
                                    : 'e.g. TRUE, B, or garage'
                                }
                                className="w-full px-2.5 py-1 text-xs border rounded-lg border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/40 font-bold text-emerald-900 dark:text-emerald-200"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-blue-800 dark:text-blue-300 mb-0.5">
                                Explanation &amp; Notes:
                              </label>
                              <input
                                type="text"
                                value={q.explanation || ''}
                                onChange={(e) =>
                                  handleUpdateQuestion(
                                    partIdx,
                                    group.id,
                                    q.id,
                                    'explanation',
                                    e.target.value
                                  )
                                }
                                placeholder="Passage quote or transcript note..."
                                className="w-full px-2.5 py-1 text-xs border rounded-lg border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => handleAddQuestionToGroup(partIdx, group.id)}
                      className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-blue-700 dark:hover:text-blue-300 transition flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Question to Group</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-gray-900 flex flex-col overflow-hidden select-text font-sans">
      <input
        ref={audioFileInputRef}
        type="file"
        accept="audio/*,video/mp4"
        onChange={handleAudioFileUpload}
        className="hidden"
      />

      {/* Top Header */}
      <div className="min-h-16 py-2.5 bg-white dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-700 px-5 flex flex-wrap items-center justify-between gap-3 shadow-2xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            {isListening ? <Headphones className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
          </div>
          <div>
            <h2
              className="text-base font-extrabold text-gray-900 dark:text-gray-100 leading-tight"
              style={{ fontFamily: outfit.style.fontFamily }}
            >
              {initialExam ? 'Edit Practice Test' : 'Create Practice Test'}
            </h2>
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {isListening ? 'Listening Editor' : 'Reading Editor'} · Press Ctrl+S to save
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle: All-in-One Scroll <-> By Tab */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition ${
                viewMode === 'all'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>All-in-One</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tabs')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition ${
                viewMode === 'tabs'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>By Tab</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleAutoRenumberAll}
            className="px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl transition flex items-center gap-1.5"
            title="Sequentially renumber all questions 1..N"
          >
            <ListOrdered className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Auto-Renumber 1..N</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQuickKeyModal(true)}
            className="px-3 py-2 text-xs font-bold text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl transition flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Quick Key</span>
          </button>

          <button
            type="button"
            onClick={requestCancel}
            className="px-3.5 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl border border-gray-200 dark:border-gray-600 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>Save Test</span>
          </button>
        </div>
      </div>

      {/* Navigation / Quick-Jump Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-5 py-2 flex items-center justify-between gap-2 overflow-x-auto select-none shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (viewMode === 'tabs') setActiveTab('info');
              else document.getElementById('editor-section-info')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`py-1 px-3 text-xs font-bold rounded-lg transition shrink-0 ${
              viewMode === 'tabs' && activeTab === 'info'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            General Info
          </button>

          {exam.parts.map((part, idx) => (
            <button
              key={part.id || idx}
              type="button"
              onClick={() => {
                if (viewMode === 'tabs') {
                  setActiveTab(idx);
                } else {
                  setCollapsedParts((prev) => ({ ...prev, [idx]: false }));
                  setTimeout(() => {
                    document
                      .getElementById(`editor-part-${idx}`)
                      ?.scrollIntoView({ behavior: 'smooth' });
                  }, 30);
                }
              }}
              className={`py-1 px-3 text-xs font-bold rounded-lg transition flex items-center gap-1.5 shrink-0 ${
                viewMode === 'tabs' && activeTab === idx
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <span>
                {isListening ? `Sec ${part.partNumber}` : `Part ${part.partNumber}`} (
                {getPartQuestionCount(idx)} Qs)
              </span>
            </button>
          ))}

          <button
            type="button"
            onClick={handleAddPart}
            className="px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 rounded-lg border border-blue-200 dark:border-blue-800 transition flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isListening ? 'Add Section' : 'Add Part'}</span>
          </button>
        </div>

        {/* Pre-Save Health Pill Strip */}
        {healthIssues.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{healthIssues.length} notice(s):</span>
            </span>
            {healthIssues.slice(0, 3).map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => jumpToIssue(issue)}
                className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 transition"
              >
                {issue.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-5 max-w-5xl mx-auto w-full space-y-6">
        {viewMode === 'all' ? (
          <>
            {renderGeneralInfoCard()}
            {exam.parts.map((part, idx) => renderPartSection(part, idx))}
          </>
        ) : (
          <>
            {activeTab === 'info' && renderGeneralInfoCard()}
            {typeof activeTab === 'number' &&
              exam.parts[activeTab] &&
              renderPartSection(exam.parts[activeTab]!, activeTab)}
          </>
        )}
      </div>

      {/* Quick Answer Key Modal */}
      {showQuickKeyModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-slate-50 dark:bg-gray-900">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    Quick Answer Key &amp; AI Explanations Matcher
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Paste answers to auto-fill matching question numbers across all parts
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickKeyModal(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 px-4 pt-2 border-b border-gray-200 dark:border-gray-700 flex gap-2">
              <button
                type="button"
                onClick={() => setQuickKeyTab('paste')}
                className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition border-t border-x ${
                  quickKeyTab === 'paste'
                    ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-blue-600'
                    : 'border-transparent text-gray-500 dark:text-gray-400'
                }`}
              >
                Paste Answer Key
              </button>
              <button
                type="button"
                onClick={() => setQuickKeyTab('prompt')}
                className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition border-t border-x ${
                  quickKeyTab === 'prompt'
                    ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-blue-600'
                    : 'border-transparent text-gray-500 dark:text-gray-400'
                }`}
              >
                AI Prompt Template
              </button>
            </div>

            {quickKeyTab === 'paste' && (
              <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                <textarea
                  value={quickKeyText}
                  onChange={(e) => setQuickKeyText(e.target.value)}
                  rows={12}
                  placeholder={`1. FALSE | Paragraph 2 states...\n2. NOT GIVEN\n3. TRUE\n21-22. A, C`}
                  className="w-full px-3 py-2 text-xs border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono leading-relaxed focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            )}

            {quickKeyTab === 'prompt' && (
              <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Copy this prompt into ChatGPT / Gemini / Claude:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyAIPrompt}
                    className="px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center gap-1"
                  >
                    {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPrompt ? 'Copied!' : 'Copy Prompt'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  value={AI_EXPLAIN_PROMPT_TEMPLATE}
                  rows={12}
                  className="w-full px-3 py-2 text-xs border rounded-lg border-gray-300 dark:border-gray-600 font-mono leading-relaxed bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 select-all"
                />
              </div>
            )}

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2 bg-slate-50 dark:bg-gray-900">
              <button
                type="button"
                onClick={() => setShowQuickKeyModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600"
              >
                Close
              </button>
              {quickKeyTab === 'paste' && (
                <button
                  type="button"
                  onClick={handleApplyQuickKeys}
                  disabled={!quickKeyText.trim()}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Apply to Questions</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Confirmation */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-60 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="test-editor-discard-title"
            className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-5 h-5" />
              <h4 id="test-editor-discard-title" className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                Discard unsaved changes?
              </h4>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              You have unsaved edits in this test. Closing now will lose those changes.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setShowDiscardConfirm(false)}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onCancel();
                }}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestEditor;
