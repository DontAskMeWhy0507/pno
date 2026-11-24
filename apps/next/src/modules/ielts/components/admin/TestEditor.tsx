import { useState, useRef, type FC } from 'react';
import { useToast } from '@chakra-ui/react';
import { outfit } from '@pno/lib/chakra-theme';
import type { Exam, Part, QuestionGroup, Question, QuestionType } from '../../types/exam';
import { parseQuickKeyText, AI_EXPLAIN_PROMPT_TEMPLATE } from '../../utils/keyMatcher';
import { getAllCollections, getExamCollection } from '../../utils/storage';
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
  Loader2,
} from 'lucide-react';
import { uploadMediaFile } from '../../utils/mediaUploader';
import { useAudioBlob } from '../../hooks/useAudioBlob';

interface TestEditorProps {
  initialExam?: Exam | null;
  onSave: (exam: Exam) => void;
  onCancel: () => void;
}

const AudioTrackPreview: FC<{ audioUrl: string; onClear: () => void }> = ({ audioUrl, onClear }) => {
  const { blobUrl, isLoading } = useAudioBlob(audioUrl);

  return (
    <div className="pt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
      <div className="flex items-center justify-between text-xs font-bold text-gray-700">
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
          <span>Loading audio into memory (anti-IDM)...</span>
        </div>
      ) : (
        <audio controls src={blobUrl || audioUrl} className="w-full h-8" preload="metadata" />
      )}
    </div>
  );
};

export const TestEditor: FC<TestEditorProps> = ({
  initialExam,
  onSave,
  onCancel,
}) => {
  const toast = useToast();
  const [showQuickKeyModal, setShowQuickKeyModal] = useState(false);
  const [quickKeyText, setQuickKeyText] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [quickKeyTab, setQuickKeyTab] = useState<'paste' | 'prompt'>('paste');
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [audioUploadNotice, setAudioUploadNotice] = useState<string | null>(null);

  const [exam, setExam] = useState<Exam>(() => {
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

    // Default new exam (Reading 3 passages)
    return {
      id: 'exam_' + Date.now(),
      title: 'NEW IELTS PRACTICE TEST',
      description: 'Custom practice test',
      category: 'IELTS Academic Reading',
      durationMinutes: 60,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isBuiltin: false,
      parts: [
        {
          id: 'part-1',
          partNumber: 1,
          title: 'Reading Passage 1',
          subtitle: '',
          passage: 'Enter passage 1 text here...',
          footnotes: '',
          audioUrl: '',
          questionGroups: [
            {
              id: 'p1-g1',
              title: 'Questions 1–6',
              instructions: 'Do the following statements agree with the information given in the text? Choose TRUE if..., FALSE if..., NOT GIVEN if...',
              questions: [
                {
                  id: 'q1',
                  orderNumber: 1,
                  type: 'TRUE_FALSE_NOT_GIVEN',
                  prompt: 'Question 1 prompt...',
                  correctAnswer: 'TRUE',
                  explanation: 'Explanation for question 1...',
                },
              ],
            },
          ],
        },
        {
          id: 'part-2',
          partNumber: 2,
          title: 'Reading Passage 2',
          subtitle: '',
          passage: 'Enter passage 2 text here...',
          footnotes: '',
          audioUrl: '',
          questionGroups: [],
        },
        {
          id: 'part-3',
          partNumber: 3,
          title: 'Reading Passage 3',
          subtitle: '',
          passage: 'Enter passage 3 text here...',
          footnotes: '',
          audioUrl: '',
          questionGroups: [],
        },
      ],
    };
  });

  // activeTab: 'info' or part index (0, 1, 2, 3...)
  const [activeTab, setActiveTab] = useState<'info' | number>('info');
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  const isListening =
    exam.category?.toLowerCase().includes('listening') ||
    (exam.title && /listening/i.test(exam.title)) ||
    exam.parts.some((p) => Boolean(p.audioUrl));

  const handleUpdateExamField = <K extends keyof Exam>(field: K, value: Exam[K]) => {
    setExam((prev) => ({ ...prev, [field]: value }));
  };

  const getActivePartIndex = (): number => {
    if (typeof activeTab === 'number') {
      return Math.min(Math.max(0, activeTab), Math.max(0, exam.parts.length - 1));
    }
    return 0;
  };

  const getPartQuestionCount = (partIndex: number): number => {
    const part = exam.parts?.[partIndex];
    if (!part || !Array.isArray(part.questionGroups)) return 0;
    return part.questionGroups.reduce(
      (acc, g) => acc + (Array.isArray(g.questions) ? g.questions.length : 0),
      0
    );
  };

  const handleUpdatePart = <K extends keyof Part>(field: K, value: Part[K]) => {
    const idx = getActivePartIndex();
    const updatedParts = [...exam.parts];
    const existingPart = updatedParts[idx];
    if (existingPart) {
      updatedParts[idx] = { ...existingPart, [field]: value };
      setExam((prev) => ({ ...prev, parts: updatedParts }));
    }
  };

  // Convert to 4-section listening setup
  const handleConvertToListening = () => {
    if (initialExam) return;
    const updatedParts: Part[] = [];
    for (let i = 1; i <= 4; i++) {
      const existing = exam.parts[i - 1];
      updatedParts.push({
        id: existing?.id || `part-${Date.now()}-${i}`,
        partNumber: i,
        title: existing?.title && !existing.title.toLowerCase().startsWith('reading') ? existing.title : `Section ${i}`,
        subtitle: existing?.subtitle || '',
        passage: existing?.passage || '',
        footnotes: existing?.footnotes || '',
        audioUrl: existing?.audioUrl || (i > 1 ? exam.parts[0]?.audioUrl : '') || '',
        questionGroups: existing?.questionGroups || [],
      });
    }
    setExam((prev) => ({
      ...prev,
      category: 'IELTS Listening',
      durationMinutes: 30,
      parts: updatedParts,
    }));
    toast({
      title: 'Switched to Listening format (4 Sections • 30 mins)',
      status: 'info',
      duration: 2200,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  // Convert to 3-passage reading setup
  const handleConvertToReading = () => {
    if (initialExam) return;
    const updatedParts: Part[] = [];
    for (let i = 1; i <= 3; i++) {
      const existing = exam.parts[i - 1];
      updatedParts.push({
        id: existing?.id || `part-${Date.now()}-${i}`,
        partNumber: i,
        title: existing?.title && !existing.title.toLowerCase().startsWith('section') ? existing.title : `Reading Passage ${i}`,
        subtitle: existing?.subtitle || '',
        passage: existing?.passage || '',
        footnotes: existing?.footnotes || '',
        audioUrl: '',
        questionGroups: existing?.questionGroups || [],
      });
    }
    setExam((prev) => ({
      ...prev,
      category: 'IELTS Academic Reading',
      durationMinutes: 60,
      parts: updatedParts,
    }));
    toast({
      title: 'Switched to Reading format (3 Passages • 60 mins)',
      status: 'info',
      duration: 2200,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  // Add Part / Section
  const handleAddPart = () => {
    const nextPartNum = exam.parts.length + 1;
    const newPart: Part = {
      id: `part-${Date.now()}-${nextPartNum}`,
      partNumber: nextPartNum,
      title: isListening ? `Section ${nextPartNum}` : `Reading Passage ${nextPartNum}`,
      subtitle: '',
      passage: '',
      footnotes: '',
      audioUrl: isListening ? (exam.parts[0]?.audioUrl || '') : '',
      questionGroups: [],
    };
    const updated = [...exam.parts, newPart];
    setExam((prev) => ({ ...prev, parts: updated }));
    setActiveTab(updated.length - 1);
  };

  // Delete Part / Section
  const handleDeletePart = (partIdx: number) => {
    if (exam.parts.length <= 1) {
      toast({
        title: 'A practice test must contain at least one part or section',
        status: 'warning',
        duration: 2500,
        isClosable: true,
        position: 'bottom-right',
      });
      return;
    }
    const part = exam.parts[partIdx];
    if (!part) return;
    const updated = exam.parts.filter((_, idx) => idx !== partIdx).map((p, idx) => ({
      ...p,
      partNumber: idx + 1,
    }));
    setExam((prev) => ({ ...prev, parts: updated }));
    setActiveTab(Math.max(0, partIdx - 1));
    toast({
      title: `Removed ${part.title}`,
      status: 'info',
      duration: 2200,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  // Copy active part's audio to all sections
  const handleCopyAudioToAllSections = () => {
    const idx = getActivePartIndex();
    const sourceAudio = exam.parts[idx]?.audioUrl;
    if (!sourceAudio) {
      toast({
        title: 'No audio URL or track set on this section to copy',
        status: 'warning',
        duration: 2500,
        isClosable: true,
        position: 'bottom-right',
      });
      return;
    }
    const updated = exam.parts.map((p) => ({ ...p, audioUrl: sourceAudio }));
    setExam((prev) => ({ ...prev, parts: updated }));
    toast({
      title: `Applied audio track to all ${updated.length} sections`,
      status: 'success',
      duration: 2200,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  // Audio file upload - saves directly into project web folder
  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAudio(true);
    setAudioUploadNotice(null);

    try {
      const result = await uploadMediaFile(file, 'listening', exam.id || 'custom-test');
      handleUpdatePart('audioUrl', result.url);
      setAudioUploadNotice(`Audio saved to website folder: ${result.url}`);
      setTimeout(() => setAudioUploadNotice(null), 6000);
    } catch (err) {
      console.error('Failed to upload audio:', err);
      // Local fallback
      const objUrl = URL.createObjectURL(file);
      handleUpdatePart('audioUrl', objUrl);
    } finally {
      setIsUploadingAudio(false);
      if (audioFileInputRef.current) audioFileInputRef.current.value = '';
    }
  };

  // Add question group
  const handleAddQuestionGroup = () => {
    const idx = getActivePartIndex();
    const currentPart = exam.parts[idx] || exam.parts[0];
    if (!currentPart) return;
    const startQ = calculateNextQuestionNumber();
    const newGroup: QuestionGroup = {
      id: `group_${Date.now()}`,
      title: `Questions ${startQ}–${startQ + 4}`,
      instructions: isListening
        ? 'Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.'
        : 'Do the following statements agree with the information given in the text? Choose TRUE if..., FALSE if..., NOT GIVEN if...',
      questions: [],
    };
    const updatedParts = [...exam.parts];
    updatedParts[idx] = {
      ...currentPart,
      questionGroups: [...(currentPart.questionGroups || []), newGroup],
    };
    setExam((prev) => ({ ...prev, parts: updatedParts }));
  };

  // Delete question group
  const handleDeleteGroup = (groupId: string) => {
    const idx = getActivePartIndex();
    const currentPart = exam.parts[idx];
    if (!currentPart) return;
    const updatedParts = [...exam.parts];
    updatedParts[idx] = {
      ...currentPart,
      questionGroups: (currentPart.questionGroups || []).filter((g) => g.id !== groupId),
    };
    setExam((prev) => ({ ...prev, parts: updatedParts }));
  };

  // Calculate next question number
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

  // Add question to a group
  const handleAddQuestionToGroup = (groupId: string) => {
    const idx = getActivePartIndex();
    const currentPart = exam.parts[idx];
    if (!currentPart) return;
    const nextNum = calculateNextQuestionNumber();

    const newQuestion: Question = {
      id: `q_${Date.now()}`,
      orderNumber: nextNum,
      type: isListening ? 'FILL_IN_BLANK' : 'TRUE_FALSE_NOT_GIVEN',
      prompt: isListening ? `Question ${nextNum}` : `Question prompt ${nextNum}...`,
      correctAnswer: isListening ? 'answer' : 'TRUE',
      explanation: `Explanation for question ${nextNum}...`,
    };

    const updatedGroups = currentPart.questionGroups.map((g) => {
      if (g.id === groupId) {
        return { ...g, questions: [...g.questions, newQuestion] };
      }
      return g;
    });

    const updatedParts = [...exam.parts];
    updatedParts[idx] = { ...currentPart, questionGroups: updatedGroups };
    setExam((prev) => ({ ...prev, parts: updatedParts }));
  };

  // Update question in group
  const handleUpdateQuestion = (
    groupId: string,
    questionId: string,
    field: keyof Question,
    val: any
  ) => {
    const idx = getActivePartIndex();
    const currentPart = exam.parts[idx];
    if (!currentPart) return;

    const updatedGroups = currentPart.questionGroups.map((g) => {
      if (g.id === groupId) {
        const updatedQs = g.questions.map((q) => {
          if (q.id === questionId) {
            return { ...q, [field]: val };
          }
          return q;
        });
        return { ...g, questions: updatedQs };
      }
      return g;
    });

    const updatedParts = [...exam.parts];
    updatedParts[idx] = { ...currentPart, questionGroups: updatedGroups };
    setExam((prev) => ({ ...prev, parts: updatedParts }));
  };

  // Delete question
  const handleDeleteQuestion = (groupId: string, questionId: string) => {
    const idx = getActivePartIndex();
    const currentPart = exam.parts[idx];
    if (!currentPart) return;

    const updatedGroups = currentPart.questionGroups.map((g) => {
      if (g.id === groupId) {
        return { ...g, questions: g.questions.filter((q) => q.id !== questionId) };
      }
      return g;
    });

    const updatedParts = [...exam.parts];
    updatedParts[idx] = { ...currentPart, questionGroups: updatedGroups };
    setExam((prev) => ({ ...prev, parts: updatedParts }));
  };

  const handleCopyAIPrompt = () => {
    navigator.clipboard.writeText(AI_EXPLAIN_PROMPT_TEMPLATE);
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
    const updatedParts = exam.parts.map((part) => ({
      ...part,
      questionGroups: (part.questionGroups || []).map((group) => ({
        ...group,
        questions: (group.questions || []).map((q) => {
          const matched = keyMap.get(q.orderNumber);
          if (matched) {
            return {
              ...q,
              correctAnswer: matched.answer || q.correctAnswer,
              explanation: matched.explanation || q.explanation,
            };
          }
          return q;
        }),
      })),
    }));
    setExam((prev) => ({ ...prev, parts: updatedParts }));
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

  const handleSave = () => {
    if (!exam.title.trim()) {
      toast({
        title: 'Please enter a test title',
        status: 'warning',
        duration: 2500,
        isClosable: true,
        position: 'bottom-right',
      });
      return;
    }
    onSave(exam);
  };

  const activePart = typeof activeTab === 'number' ? exam.parts[getActivePartIndex()] : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-hidden select-text font-sans">
      {/* Header — PNO Quiz Editor Header Style */}
      <div className="min-h-16 py-3 bg-white border-b-2 border-gray-200 px-6 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          {isListening ? (
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Headphones className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
          )}
          <div>
            <h2
              className="text-lg font-extrabold text-gray-900 leading-tight"
              style={{ fontFamily: outfit.style.fontFamily }}
            >
              {initialExam ? 'Edit Practice Test' : 'Create Practice Test'}
            </h2>
            <span className="text-xs font-medium text-gray-500">
              {isListening ? 'IELTS Listening Test (Audio + 4 Sections)' : 'IELTS Reading Test (Passages + Questions)'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowQuickKeyModal(true)}
            className="px-3.5 py-2 text-xs font-bold text-gray-800 bg-gray-100 hover:bg-gray-200 border-2 border-gray-200 rounded-xl transition flex items-center gap-1.5"
            title="Paste answer key and explanations from AI or answer sheet"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Quick Key &amp; AI Explanations</span>
          </button>

          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl border-2 border-gray-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>Save Test</span>
          </button>
        </div>
      </div>

      {/* Tabs — PNO Soft-Rounded Pill Tabs */}
      <div className="bg-white border-b-2 border-gray-200 px-6 py-2.5 flex items-center gap-2 overflow-x-auto select-none">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border-2 border-gray-200">
          <button
            onClick={() => setActiveTab('info')}
            className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition shrink-0 ${
              activeTab === 'info'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            General Info
          </button>

          {exam.parts.map((part, idx) => (
            <button
              key={part.id || idx}
              onClick={() => setActiveTab(idx)}
              className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 shrink-0 ${
                activeTab === idx
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {isListening ? (
                <Headphones className="w-3.5 h-3.5" />
              ) : (
                <BookOpen className="w-3.5 h-3.5" />
              )}
              <span>
                {isListening ? `Section ${part.partNumber}` : `Part ${part.partNumber}`} ({getPartQuestionCount(idx)} Qs)
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={handleAddPart}
          className="px-3 py-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-xl border-2 border-blue-200 transition flex items-center gap-1 shrink-0"
          title={isListening ? 'Add another Section' : 'Add another Part'}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isListening ? 'Add Section' : 'Add Part'}</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full">
        {/* Tab 1: General Info */}
        {activeTab === 'info' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 shadow-xs">
            {/* Skill Format Display / Switcher */}
            {initialExam ? (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isListening ? (
                    <Headphones className="w-4 h-4 text-blue-600" />
                  ) : (
                    <BookOpen className="w-4 h-4 text-blue-600" />
                  )}
                  <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    {isListening
                      ? 'IELTS Listening Test (Audio + 4 Sections)'
                      : 'IELTS Reading Test (3 Passages)'}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  Skill Format Locked
                </span>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide block">
                  Select Test Format
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleConvertToReading}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition ${
                      !isListening
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
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
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <Headphones className="w-4 h-4" />
                    <span>Listening Test (Audio + 4 Sections • 30 Mins)</span>
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Test Title *
              </label>
              <input
                type="text"
                value={exam.title}
                onChange={(e) => handleUpdateExamField('title', e.target.value)}
                placeholder={isListening ? 'e.g. CAMBRIDGE 18 TEST 1 LISTENING' : 'e.g. CAMBRIDGE 18 TEST 1 READING'}
                className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
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
                  className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
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
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  value={exam.durationMinutes}
                  onChange={(e) => handleUpdateExamField('durationMinutes', parseInt(e.target.value) || 60)}
                  className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                <Folder className="w-3.5 h-3.5 text-blue-600" />
                <span>Collection</span>
              </label>
              <select
                value={exam.collection || getExamCollection(exam)}
                onChange={(e) => handleUpdateExamField('collection', e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white font-medium"
              >
                {getAllCollections().map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Description / Notes
              </label>
              <textarea
                value={exam.description || ''}
                onChange={(e) => handleUpdateExamField('description', e.target.value)}
                rows={3}
                placeholder="Source notes, difficulty level, test tips..."
                className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 font-normal"
              />
            </div>
          </div>
        )}

        {/* Tab 2: Part / Section Details */}
        {typeof activeTab === 'number' && activePart && (
          <div className="space-y-6">
            {/* Section Header & Part Delete Action */}
            <div className="flex items-center justify-between bg-white px-5 py-3 rounded-xl border border-gray-200 shadow-2xs">
              <div className="flex items-center gap-2">
                {isListening ? (
                  <Headphones className="w-4 h-4 text-blue-600" />
                ) : (
                  <BookOpen className="w-4 h-4 text-blue-600" />
                )}
                <span className="font-bold text-sm text-gray-900">
                  {isListening ? `Section ${activePart.partNumber} Details` : `Part ${activePart.partNumber} Passage & Content`}
                </span>
                <span className="text-xs text-gray-500">({getPartQuestionCount(getActivePartIndex())} questions)</span>
              </div>

              {exam.parts.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeletePart(getActivePartIndex())}
                  className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded border border-rose-200 transition flex items-center gap-1"
                  title="Delete this section"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete {isListening ? 'Section' : 'Part'}</span>
                </button>
              )}
            </div>

            {/* AUDIO CONFIGURATION CARD (for Listening or any part with audio) */}
            {(isListening || activePart.audioUrl) && (
              <div className="bg-white rounded-xl border-2 border-blue-200 p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b pb-2.5">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-gray-900">
                      Audio Track (Section {activePart.partNumber})
                    </h3>
                  </div>
                  {activePart.audioUrl && exam.parts.length > 1 && (
                    <button
                      type="button"
                      onClick={handleCopyAudioToAllSections}
                      className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition flex items-center gap-1"
                      title="Apply this audio URL to all 4 sections"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Use this audio for all sections</span>
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-700">
                    Audio Source (Local path or Web URL):
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      value={activePart.audioUrl || ''}
                      onChange={(e) => handleUpdatePart('audioUrl', e.target.value)}
                      placeholder="e.g. /audio/vol9/test1.mp4 or https://example.com/audio.mp3"
                      className="flex-1 px-3 py-2 text-xs border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                    />

                    {/* Choose Audio File from Computer */}
                    <input
                      ref={audioFileInputRef}
                      type="file"
                      accept="audio/*,video/mp4"
                      onChange={handleAudioFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => audioFileInputRef.current?.click()}
                      disabled={isUploadingAudio}
                      className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                      title="Upload and save audio file directly into website folder"
                    >
                      {isUploadingAudio ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          <span>Saving to Web Folder...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 text-slate-600" />
                          <span>Upload to Web Folder</span>
                        </>
                      )}
                    </button>
                  </div>

                  {audioUploadNotice && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold">{audioUploadNotice}</span>
                    </div>
                  )}

                  <p className="text-[11px] text-gray-500">
                    💡 Tip: Audio files are saved directly into your project's website folder (<code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">public/tests/listening/{exam.id || 'custom-test'}/audio/</code> or <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">public/audio/</code>).
                  </p>

                  {/* Audio Player Live Preview (Anti-IDM protected) */}
                  {activePart.audioUrl && (
                    <AudioTrackPreview
                      audioUrl={activePart.audioUrl}
                      onClear={() => handleUpdatePart('audioUrl', '')}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Passage / Script Editor */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-xs">
              <h3 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-1.5">
                {isListening ? (
                  <>
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Section Title & Audio Script / Transcript (Optional)</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span>Reading Passage (Part {activePart.partNumber})</span>
                  </>
                )}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {isListening ? 'Section Title' : 'Passage Title'}
                  </label>
                  <input
                    type="text"
                    value={activePart.title}
                    onChange={(e) => handleUpdatePart('title', e.target.value)}
                    placeholder={isListening ? 'e.g. Hotel Reservation' : 'e.g. The Baobabs of Madagascar'}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {isListening ? 'Section Subtitle / Topic' : 'Passage Subtitle (Italic description)'}
                  </label>
                  <input
                    type="text"
                    value={activePart.subtitle || ''}
                    onChange={(e) => handleUpdatePart('subtitle', e.target.value)}
                    placeholder="Brief summary or context..."
                    className="w-full px-3 py-1.5 text-sm border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {isListening
                    ? 'Audio Transcript / Script (Optional - used for review & explanations):'
                    : 'Passage Text (Separate paragraphs with an empty line):'}
                </label>
                <textarea
                  value={activePart.passage}
                  onChange={(e) => handleUpdatePart('passage', e.target.value)}
                  rows={isListening ? 6 : 10}
                  placeholder={
                    isListening
                      ? 'Optional: Paste the audio recording transcript here so test takers can review the script after completing the exam.'
                      : 'Enter reading passage content...'
                  }
                  className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-600 font-sans leading-relaxed"
                />
              </div>

              {!isListening && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Footnotes (e.g. * Malagasy: of Madagascar)
                  </label>
                  <input
                    type="text"
                    value={activePart.footnotes || ''}
                    onChange={(e) => handleUpdatePart('footnotes', e.target.value)}
                    placeholder="Vocabulary glossaries..."
                    className="w-full px-3 py-1.5 text-sm border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}
            </div>

            {/* Question Groups Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Question Groups</span>
                </h3>
                <button
                  type="button"
                  onClick={handleAddQuestionGroup}
                  className="px-3.5 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition flex items-center gap-1 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Question Group</span>
                </button>
              </div>

              {activePart.questionGroups.length === 0 && (
                <div className="text-center py-8 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500 text-xs">
                  No question groups in this section yet. Click "+ Add Question Group" above.
                </div>
              )}

              {activePart.questionGroups.map((group, gIdx) => (
                <div key={group.id} className="bg-white rounded-xl border border-gray-300 p-5 space-y-4 shadow-xs">
                  {/* Group Header & Controls */}
                  <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-3 flex-1 mr-4">
                      <input
                        type="text"
                        value={group.title}
                        onChange={(e) => {
                          const idx = getActivePartIndex();
                          const updated = [...exam.parts];
                          const targetGroup = updated[idx]?.questionGroups[gIdx];
                          if (targetGroup) {
                            targetGroup.title = e.target.value;
                            setExam({ ...exam, parts: updated });
                          }
                        }}
                        placeholder="Group Title: Questions 1–10"
                        className="px-2.5 py-1 text-xs font-bold text-gray-800 border rounded-lg w-52"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(group.id)}
                      className="text-gray-400 hover:text-rose-600 p-1.5 rounded transition hover:bg-rose-50"
                      title="Delete question group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Group Instructions */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Instructions:
                    </label>
                    <textarea
                      value={group.instructions}
                      onChange={(e) => {
                        const idx = getActivePartIndex();
                        const updated = [...exam.parts];
                        const targetGroup = updated[idx]?.questionGroups[gIdx];
                        if (targetGroup) {
                          targetGroup.instructions = e.target.value;
                          setExam({ ...exam, parts: updated });
                        }
                      }}
                      rows={2}
                      placeholder="e.g. Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer."
                      className="w-full px-3 py-1.5 text-xs border rounded-lg border-gray-300"
                    />
                  </div>

                  {/* Shared Content (Inline Blanks for Notes/Summary/Table) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-700">
                        Notes / Sentence Completion Text with Blanks (Optional):
                      </label>
                      <span className="text-[11px] text-gray-500 font-mono">
                        Use &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125; for blank inputs
                      </span>
                    </div>
                    <textarea
                      value={group.sharedContent || ''}
                      onChange={(e) => {
                        const idx = getActivePartIndex();
                        const updated = [...exam.parts];
                        const targetGroup = updated[idx]?.questionGroups[gIdx];
                        if (targetGroup) {
                          targetGroup.sharedContent = e.target.value;
                          setExam({ ...exam, parts: updated });
                        }
                      }}
                      rows={4}
                      placeholder="e.g. Jim's weekly rent will be $ {{1}}&#10;Jim can park his car in the {{2}}"
                      className="w-full px-3 py-2 text-xs border rounded-lg border-gray-300 font-mono text-gray-800 leading-relaxed"
                    />
                  </div>

                  {/* Questions in group */}
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-bold text-gray-600 uppercase">
                      Questions ({group.questions.length} questions):
                    </div>

                    {group.questions.map((q) => (
                      <div key={q.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold bg-neutral-800 text-white px-2 py-0.5 rounded">
                              Q{q.orderNumber}
                            </span>
                            <select
                              value={q.type}
                              onChange={(e) =>
                                handleUpdateQuestion(group.id, q.id, 'type', e.target.value as QuestionType)
                              }
                              className="text-xs border rounded-lg px-2 py-1 bg-white font-medium"
                            >
                              <option value="FILL_IN_BLANK">Fill in Blank (Notes / Sentence Completion)</option>
                              <option value="MULTIPLE_CHOICE_SINGLE">Multiple Choice (Single: A, B, C, D)</option>
                              <option value="MULTIPLE_CHOICE_MULTI">Multiple Choice (Choose Two or More)</option>
                              <option value="TRUE_FALSE_NOT_GIVEN">True / False / Not Given</option>
                              <option value="YES_NO_NOT_GIVEN">Yes / No / Not Given</option>
                              <option value="MATCHING">Matching Information / Headings</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(group.id, q.id)}
                            className="text-gray-400 hover:text-rose-600 p-1"
                            title="Delete question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Question Prompt */}
                        <div>
                          <input
                            type="text"
                            value={q.prompt}
                            onChange={(e) => handleUpdateQuestion(group.id, q.id, 'prompt', e.target.value)}
                            placeholder="Question prompt or statement..."
                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white font-medium"
                          />
                        </div>

                        {/* Options if Multiple Choice */}
                        {(q.type === 'MULTIPLE_CHOICE_SINGLE' ||
                          q.type === 'MULTIPLE_CHOICE_MULTI' ||
                          q.type === 'MATCHING') && (
                          <div className="space-y-1.5 pl-2 border-l-2 border-blue-300">
                            <span className="text-[11px] font-bold text-gray-600 block">Options:</span>
                            {(Array.isArray(q.options) && q.options.length > 0
                              ? q.options
                              : [
                                  { id: 'A', text: '' },
                                  { id: 'B', text: '' },
                                  { id: 'C', text: '' },
                                  { id: 'D', text: '' },
                                ]
                            ).map((opt, optIdx) => {
                              const optId =
                                typeof opt === 'object' && opt?.id ? opt.id : String.fromCharCode(65 + optIdx);
                              const optText =
                                typeof opt === 'object' && opt?.text !== undefined ? opt.text : String(opt || '');
                              return (
                                <div key={optId || optIdx} className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-gray-700 w-4">{optId}.</span>
                                  <input
                                    type="text"
                                    value={optText}
                                    onChange={(e) => {
                                      const currentOpts = Array.isArray(q.options)
                                        ? [...q.options]
                                        : [
                                            { id: 'A', text: '' },
                                            { id: 'B', text: '' },
                                            { id: 'C', text: '' },
                                            { id: 'D', text: '' },
                                          ];
                                      currentOpts[optIdx] = { id: optId, text: e.target.value };
                                      handleUpdateQuestion(group.id, q.id, 'options', currentOpts);
                                    }}
                                    placeholder={`Option ${optId} text...`}
                                    className="flex-1 px-2 py-1 text-xs border rounded-lg bg-white"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Correct Answer & Explanation */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-bold text-emerald-800 mb-0.5">
                              Correct Answer:
                            </label>
                            <input
                              type="text"
                              value={
                                Array.isArray(q.correctAnswer)
                                  ? q.correctAnswer.join(', ')
                                  : q.correctAnswer || ''
                              }
                              onChange={(e) => handleUpdateQuestion(group.id, q.id, 'correctAnswer', e.target.value)}
                              placeholder="e.g. TRUE or FALSE or A or garage"
                              className="w-full px-2.5 py-1 text-xs border rounded-lg border-emerald-300 bg-emerald-50/50 font-bold text-emerald-900"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-blue-800 mb-0.5">
                              Explanation & Notes:
                            </label>
                            <input
                              type="text"
                              value={q.explanation || ''}
                              onChange={(e) => handleUpdateQuestion(group.id, q.id, 'explanation', e.target.value)}
                              placeholder="Passage quote or audio transcript quote..."
                              className="w-full px-2.5 py-1 text-xs border rounded-lg border-blue-300 bg-blue-50/50 text-blue-900"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => handleAddQuestionToGroup(group.id)}
                      className="w-full py-2 border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 rounded-lg text-xs font-bold text-gray-600 hover:text-blue-700 transition flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Question to Group</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Answer & Explanation Modal */}
      {showQuickKeyModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Quick Answer Key & AI Explanations Matcher
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Paste raw answers from ChatGPT, Claude, Gemini, or an answer sheet to automatically populate all 40 questions
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickKeyModal(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="bg-gray-50 px-4 pt-2 border-b border-gray-200 flex gap-2">
              <button
                type="button"
                onClick={() => setQuickKeyTab('paste')}
                className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition border-t border-x ${
                  quickKeyTab === 'paste'
                    ? 'bg-white border-gray-200 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                Paste Answer Key
              </button>
              <button
                type="button"
                onClick={() => setQuickKeyTab('prompt')}
                className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition border-t border-x ${
                  quickKeyTab === 'prompt'
                    ? 'bg-white border-gray-200 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                AI Prompt Template
              </button>
            </div>

            {/* Tab 1: Paste Input */}
            {quickKeyTab === 'paste' && (
              <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Paste Answer Keys & Explanations:
                  </label>
                  <textarea
                    value={quickKeyText}
                    onChange={(e) => setQuickKeyText(e.target.value)}
                    rows={12}
                    placeholder={`Example formats accepted:&#10;1. FALSE | Paragraph 2 states that...&#10;2. NOT GIVEN&#10;3. TRUE&#10;4. A&#10;5. C | According to the author...&#10;&#10;Or:&#10;Question 1: FALSE&#10;Question 2: TRUE`}
                    className="w-full px-3 py-2 text-xs border rounded-lg border-gray-300 font-mono leading-relaxed focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>How it works:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    The smart parser detects question numbers (1 to 40), isolates the answer (TRUE, FALSE, NOT GIVEN, A–D, or words), and extracts any explanations following vertical bars (<code className="bg-amber-100 px-1 py-0.5 rounded">|</code>) or dashes.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: AI Prompt */}
            {quickKeyTab === 'prompt' && (
              <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">
                    Copy this prompt into ChatGPT / Gemini / Claude:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyAIPrompt}
                    className="px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center gap-1 shadow-xs"
                  >
                    {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPrompt ? 'Copied!' : 'Copy Prompt'}</span>
                  </button>
                </div>

                <textarea
                  readOnly
                  value={AI_EXPLAIN_PROMPT_TEMPLATE}
                  rows={12}
                  className="w-full px-3 py-2 text-xs border rounded-lg border-gray-300 font-mono leading-relaxed bg-gray-50 text-gray-800 select-all"
                />
              </div>
            )}

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 flex items-center justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowQuickKeyModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 rounded-lg border border-gray-300 transition"
              >
                Close
              </button>
              {quickKeyTab === 'paste' && (
                <button
                  type="button"
                  onClick={handleApplyQuickKeys}
                  disabled={!quickKeyText.trim()}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg shadow-xs transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Apply to Questions</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestEditor;
