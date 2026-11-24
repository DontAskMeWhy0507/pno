import { useState, useRef, useEffect, useMemo, useCallback, type FC } from 'react';
import { useToast } from '@chakra-ui/react';
import { outfit } from '@pno/lib/chakra-theme';
import type { WritingExam, WritingTask } from '../../types/writing';
import { getAllCollections } from '../../utils/storage';
import { uploadMediaFile } from '../../utils/mediaUploader';
import {
  PenTool,
  Save,
  Upload,
  Image as ImageIcon,
  Clock,
  Folder,
  Sparkles,
  Loader2,
  Trash2,
  LayoutList,
  Columns,
  AlertCircle,
} from 'lucide-react';

interface WritingEditorModalProps {
  isOpen: boolean;
  initialExam?: WritingExam | null;
  defaultCollection?: string;
  defaultViewMode?: 'all' | 'tabs';
  onClose: () => void;
  onSave: (exam: WritingExam) => void;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export const WritingEditorModal: FC<WritingEditorModalProps> = ({
  isOpen,
  initialExam,
  defaultCollection,
  defaultViewMode = 'all',
  onClose,
  onSave,
}) => {
  const toast = useToast();
  const collections = useMemo(() => getAllCollections(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<'all' | 'tabs'>(defaultViewMode);
  const [activeTab, setActiveTab] = useState<'info' | 'task1' | 'task2'>('info');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const [title, setTitle] = useState(initialExam?.title || 'NEW IELTS WRITING TEST');
  const [collection, setCollection] = useState(
    initialExam?.collection || defaultCollection || 'My Tests'
  );
  const [durationMinutes, setDurationMinutes] = useState(initialExam?.durationMinutes || 60);

  // Task 1 State
  const [task1Title, setTask1Title] = useState(
    initialExam?.task1?.title || 'Academic Task 1: Visual Data Report'
  );
  const [task1Prompt, setTask1Prompt] = useState(
    initialExam?.task1?.prompt ||
      'The chart below shows the percentage of households with internet access in different countries between 2010 and 2020.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.'
  );
  const [task1ImageUrl, setTask1ImageUrl] = useState(initialExam?.task1?.imageUrl || '');
  const [task1ChartType, setTask1ChartType] = useState<
    'bar' | 'line' | 'pie' | 'table' | 'map' | 'process' | 'none'
  >(initialExam?.task1?.chartType || 'bar');
  const [task1SampleAnswer, setTask1SampleAnswer] = useState(
    initialExam?.task1?.sampleAnswer || ''
  );

  // Task 2 State
  const [task2Title, setTask2Title] = useState(
    initialExam?.task2?.title || 'Academic Task 2: Discursive Essay'
  );
  const [task2Prompt, setTask2Prompt] = useState(
    initialExam?.task2?.prompt ||
      'Some people believe that university education should be completely free for all citizens, while others argue that students should pay tuition fees.\n\nDiscuss both views and give your own opinion.\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.'
  );
  const [task2SampleAnswer, setTask2SampleAnswer] = useState(
    initialExam?.task2?.sampleAnswer || ''
  );

  const initialSnapshotRef = useRef<string>(
    JSON.stringify({
      title: initialExam?.title || 'NEW IELTS WRITING TEST',
      collection: initialExam?.collection || defaultCollection || 'My Tests',
      durationMinutes: initialExam?.durationMinutes || 60,
      task1Title: initialExam?.task1?.title || 'Academic Task 1: Visual Data Report',
      task1Prompt:
        initialExam?.task1?.prompt ||
        'The chart below shows the percentage of households with internet access in different countries between 2010 and 2020.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.',
      task1ImageUrl: initialExam?.task1?.imageUrl || '',
      task1ChartType: initialExam?.task1?.chartType || 'bar',
      task1SampleAnswer: initialExam?.task1?.sampleAnswer || '',
      task2Title: initialExam?.task2?.title || 'Academic Task 2: Discursive Essay',
      task2Prompt:
        initialExam?.task2?.prompt ||
        'Some people believe that university education should be completely free for all citizens, while others argue that students should pay tuition fees.\n\nDiscuss both views and give your own opinion.\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.',
      task2SampleAnswer: initialExam?.task2?.sampleAnswer || '',
    })
  );

  const isDirty = useMemo(
    () =>
      JSON.stringify({
        title,
        collection,
        durationMinutes,
        task1Title,
        task1Prompt,
        task1ImageUrl,
        task1ChartType,
        task1SampleAnswer,
        task2Title,
        task2Prompt,
        task2SampleAnswer,
      }) !== initialSnapshotRef.current,
    [
      title,
      collection,
      durationMinutes,
      task1Title,
      task1Prompt,
      task1ImageUrl,
      task1ChartType,
      task1SampleAnswer,
      task2Title,
      task2Prompt,
      task2SampleAnswer,
    ]
  );

  const canonicalCollection = useMemo(() => {
    const match = collections.find((c) => c.name.toLowerCase() === collection.trim().toLowerCase());
    return match ? match.name : collection;
  }, [collections, collection]);

  const hasCanonicalCollection = collections.some(
    (c) => c.name.toLowerCase() === canonicalCollection.trim().toLowerCase()
  );

  const uploadChartFile = useCallback(
    async (file: File) => {
      setIsUploadingImage(true);
      try {
        const examId = initialExam?.id || `writing_${Date.now()}`;
        const res = await uploadMediaFile(file, 'writing', examId);
        setTask1ImageUrl(res.url);
        toast({
          title: 'Image uploaded successfully',
          status: 'success',
          duration: 2000,
          isClosable: true,
          position: 'bottom-right',
        });
      } catch (err) {
        toast({
          title: 'Failed to upload image',
          description: err instanceof Error ? err.message : 'Please check the file and try again.',
          status: 'error',
          duration: 2800,
          isClosable: true,
          position: 'bottom-right',
        });
      } finally {
        setIsUploadingImage(false);
      }
    },
    [initialExam?.id, toast]
  );

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadChartFile(file);
    e.target.value = '';
  };

  const handleSave = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!title.trim()) {
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
      if (!task1Prompt.trim()) {
        setActiveTab('task1');
        toast({
          title: 'Please enter instructions/prompt for Task 1',
          status: 'warning',
          duration: 2500,
          isClosable: true,
          position: 'bottom-right',
        });
        return;
      }
      if (!task2Prompt.trim()) {
        setActiveTab('task2');
        toast({
          title: 'Please enter instructions/prompt for Task 2',
          status: 'warning',
          duration: 2500,
          isClosable: true,
          position: 'bottom-right',
        });
        return;
      }

      const task1: WritingTask = {
        id: initialExam?.task1?.id || `task1_${Date.now()}`,
        taskNumber: 1,
        title: task1Title.trim() || 'Academic Task 1',
        recommendedMinutes: initialExam?.task1?.recommendedMinutes || 20,
        minWords: initialExam?.task1?.minWords || 150,
        prompt: task1Prompt.trim(),
        imageUrl: task1ImageUrl.trim() || undefined,
        chartType: task1ChartType,
        sampleAnswer: task1SampleAnswer.trim() || undefined,
        keyVocabulary: initialExam?.task1?.keyVocabulary,
        analysisTips: initialExam?.task1?.analysisTips,
      };

      const task2: WritingTask = {
        id: initialExam?.task2?.id || `task2_${Date.now()}`,
        taskNumber: 2,
        title: task2Title.trim() || 'Academic Task 2',
        recommendedMinutes: initialExam?.task2?.recommendedMinutes || 40,
        minWords: initialExam?.task2?.minWords || 250,
        prompt: task2Prompt.trim(),
        chartType: 'none',
        sampleAnswer: task2SampleAnswer.trim() || undefined,
        keyVocabulary: initialExam?.task2?.keyVocabulary,
        analysisTips: initialExam?.task2?.analysisTips,
      };

      const savedExam: WritingExam = {
        id: initialExam?.id || `writing_${Date.now()}`,
        title: title.trim(),
        collection: canonicalCollection.trim() || 'My Tests',
        durationMinutes: durationMinutes || 60,
        task1,
        task2,
        createdAt: initialExam?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      onSave(savedExam);
    },
    [
      title,
      task1Prompt,
      task2Prompt,
      initialExam,
      task1Title,
      task1ImageUrl,
      task1ChartType,
      task1SampleAnswer,
      task2Title,
      task2SampleAnswer,
      canonicalCollection,
      durationMinutes,
      onSave,
      toast,
    ]
  );

  const requestClose = useCallback(() => {
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  }, [isDirty, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (showDiscardConfirm) setShowDiscardConfirm(false);
        else requestClose();
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (task1ChartType === 'none') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void uploadChartFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('paste', onPaste);
    };
  }, [isOpen, handleSave, requestClose, showDiscardConfirm, task1ChartType, uploadChartFile]);

  if (!isOpen) return null;

  const renderInfoSection = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4 shadow-xs">
      <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        General Information
      </h3>
      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
          Test Title *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. CAMBRIDGE 21 ACADEMIC WRITING TEST 1"
          className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1 flex items-center gap-1">
            <Folder className="w-3.5 h-3.5 text-blue-600" />
            <span>Collection Folder</span>
          </label>
          <select
            value={canonicalCollection}
            onChange={(e) => setCollection(e.target.value)}
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
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Total Duration (Minutes)</span>
          </label>
          <input
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Math.max(1, parseInt(e.target.value, 10) || 60))}
            className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
          />
        </div>
      </div>
    </div>
  );

  const renderTask1Section = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4 shadow-xs">
      <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
        Task 1: Report / Letter (Min 150 words)
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
            Task 1 Subtitle / Header
          </label>
          <input
            type="text"
            value={task1Title}
            onChange={(e) => setTask1Title(e.target.value)}
            placeholder="e.g. Academic Task 1: Bar Chart"
            className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
            Visual Diagram Type
          </label>
          <select
            value={task1ChartType}
            onChange={(e) =>
              setTask1ChartType(
                e.target.value as 'bar' | 'line' | 'pie' | 'table' | 'map' | 'process' | 'none'
              )
            }
            className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-medium"
          >
            <option value="bar">Bar Chart</option>
            <option value="line">Line Graph</option>
            <option value="pie">Pie Chart</option>
            <option value="table">Table Data</option>
            <option value="map">Map / Location Plans</option>
            <option value="process">Process / Diagram</option>
            <option value="none">No Image (General Training Letter)</option>
          </select>
        </div>
      </div>

      {task1ChartType !== 'none' && (
        <div className="p-4 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-blue-600" />
              <span>Task 1 Chart / Diagram Image (Supports Ctrl+V paste)</span>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={task1ImageUrl}
              onChange={(e) => setTask1ImageUrl(e.target.value)}
              placeholder="Paste image URL or upload file..."
              className="flex-1 px-3 py-2 text-xs border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 font-mono"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => void handleImageUpload(e)}
              className="hidden"
            />
            <button
              type="button"
              disabled={isUploadingImage}
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-50 rounded-lg border border-slate-300 dark:border-gray-600 transition flex items-center justify-center gap-1.5 shrink-0"
            >
              {isUploadingImage ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Image</span>
                </>
              )}
            </button>
          </div>

          {task1ImageUrl && (
            <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
                <span>Image Preview</span>
                <button
                  type="button"
                  onClick={() => setTask1ImageUrl('')}
                  className="text-rose-600 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove</span>
                </button>
              </div>
              <div className="max-h-60 overflow-auto border border-gray-200 dark:border-gray-700 rounded bg-slate-100 dark:bg-gray-900 p-2 flex justify-center">
                <img
                  src={task1ImageUrl}
                  alt="Task 1 preview"
                  className="max-h-56 object-contain rounded"
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
            Task 1 Prompt &amp; Instructions *
          </label>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {countWords(task1Prompt)} words
          </span>
        </div>
        <textarea
          value={task1Prompt}
          onChange={(e) => setTask1Prompt(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 leading-relaxed"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Model Sample Answer (Optional)</span>
          </label>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {countWords(task1SampleAnswer)} words
          </span>
        </div>
        <textarea
          value={task1SampleAnswer}
          onChange={(e) => setTask1SampleAnswer(e.target.value)}
          rows={5}
          placeholder="Optional: Band 8.5–9.0 sample report..."
          className="w-full px-3 py-2 text-xs border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 font-mono leading-relaxed"
        />
      </div>
    </div>
  );

  const renderTask2Section = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4 shadow-xs">
      <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
        Task 2: Discursive Essay (Min 250 words)
      </h3>
      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
          Task 2 Subtitle / Topic
        </label>
        <input
          type="text"
          value={task2Title}
          onChange={(e) => setTask2Title(e.target.value)}
          placeholder="e.g. Academic Task 2: Higher Education Tuition"
          className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 font-medium"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
            Task 2 Prompt &amp; Essay Question *
          </label>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {countWords(task2Prompt)} words
          </span>
        </div>
        <textarea
          value={task2Prompt}
          onChange={(e) => setTask2Prompt(e.target.value)}
          rows={6}
          className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 leading-relaxed"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Model Essay (Optional)</span>
          </label>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {countWords(task2SampleAnswer)} words
          </span>
        </div>
        <textarea
          value={task2SampleAnswer}
          onChange={(e) => setTask2SampleAnswer(e.target.value)}
          rows={6}
          placeholder="Optional: Band 8.5–9.0 sample essay..."
          className="w-full px-3 py-2 text-xs border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 font-mono leading-relaxed"
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-text font-sans">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="writing-editor-title"
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border-2 border-gray-200 dark:border-gray-700 relative"
      >
        {/* Header */}
        <div className="min-h-16 py-3 bg-white dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-700 px-6 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="writing-editor-title"
                className="text-lg font-extrabold text-gray-900 dark:text-gray-100 leading-tight"
                style={{ fontFamily: outfit.style.fontFamily }}
              >
                {initialExam ? 'Edit Writing Test' : 'Create Writing Practice Test'}
              </h2>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                2-Task Academic Writing · Press Ctrl+S to save
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition ${
                  viewMode === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400'
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
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>By Tab</span>
              </button>
            </div>

            <button
              type="button"
              onClick={requestClose}
              className="px-3.5 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl border border-gray-200 dark:border-gray-600 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Save Writing Test</span>
            </button>
          </div>
        </div>

        {/* Tab Strip (only when in By Tab mode) */}
        {viewMode === 'tabs' && (
          <div className="bg-slate-50/70 dark:bg-gray-900/70 border-b-2 border-gray-200 dark:border-gray-700 px-6 py-2.5 flex items-center shrink-0 select-none">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setActiveTab('info')}
                className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition ${
                  activeTab === 'info'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                General Info
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('task1')}
                className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition ${
                  activeTab === 'task1'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                Task 1 (150w)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('task2')}
                className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition ${
                  activeTab === 'task2'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                Task 2 (250w)
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50 dark:bg-gray-900/40">
          {viewMode === 'all' ? (
            <>
              {renderInfoSection()}
              {renderTask1Section()}
              {renderTask2Section()}
            </>
          ) : (
            <>
              {activeTab === 'info' && renderInfoSection()}
              {activeTab === 'task1' && renderTask1Section()}
              {activeTab === 'task2' && renderTask2Section()}
            </>
          )}
        </div>

        {/* Unsaved Confirmation */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-30 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="writing-discard-title"
              className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-5 h-5" />
                <h4 id="writing-discard-title" className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                  Discard unsaved changes?
                </h4>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                You have unsaved edits in this Writing test.
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

export default WritingEditorModal;
