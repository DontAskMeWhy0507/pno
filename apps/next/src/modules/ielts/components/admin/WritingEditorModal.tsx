import { useState, useRef, type FC } from 'react';
import { useToast } from '@chakra-ui/react';
import { outfit } from '@quenti/lib/chakra-theme';
import type { WritingExam, WritingTask } from '../../types/writing';
import { getAllCollections } from '../../utils/storage';
import {
  PenTool,
  Save,
  Upload,
  Image as ImageIcon,
  Clock,
  Trash2,
  Folder,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { uploadMediaFile } from '../../utils/mediaUploader';

interface WritingEditorModalProps {
  isOpen: boolean;
  initialExam?: WritingExam | null;
  onClose: () => void;
  onSave: (exam: WritingExam) => void;
}

export const WritingEditorModal: FC<WritingEditorModalProps> = ({
  isOpen,
  initialExam,
  onClose,
  onSave,
}) => {
  const toast = useToast();
  const collections = getAllCollections();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'task1' | 'task2'>('info');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [title, setTitle] = useState(initialExam?.title || 'NEW IELTS WRITING TEST');
  const [collection, setCollection] = useState(initialExam?.collection || 'My Tests');
  const [durationMinutes, setDurationMinutes] = useState(initialExam?.durationMinutes || 60);

  // Task 1 State
  const [task1Title, setTask1Title] = useState(initialExam?.task1?.title || 'Academic Task 1: Visual Data Report');
  const [task1Prompt, setTask1Prompt] = useState(
    initialExam?.task1?.prompt ||
      'The chart below shows the percentage of households with internet access in different countries between 2010 and 2020.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.'
  );
  const [task1ImageUrl, setTask1ImageUrl] = useState(initialExam?.task1?.imageUrl || '');
  const [task1ChartType, setTask1ChartType] = useState<
    'bar' | 'line' | 'pie' | 'table' | 'map' | 'process' | 'none'
  >(initialExam?.task1?.chartType || 'bar');
  const [task1SampleAnswer, setTask1SampleAnswer] = useState(initialExam?.task1?.sampleAnswer || '');

  // Task 2 State
  const [task2Title, setTask2Title] = useState(initialExam?.task2?.title || 'Academic Task 2: Discursive Essay');
  const [task2Prompt, setTask2Prompt] = useState(
    initialExam?.task2?.prompt ||
      'Some people believe that university education should be completely free for all citizens, while others argue that students should pay tuition fees.\n\nDiscuss both views and give your own opinion.\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.'
  );
  const [task2SampleAnswer, setTask2SampleAnswer] = useState(initialExam?.task2?.sampleAnswer || '');

  if (!isOpen) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const examId = initialExam?.id || `writing_${Date.now()}`;
      const res = await uploadMediaFile(file, 'writing', examId);
      setTask1ImageUrl(res.url);
      toast({
        title: 'Image uploaded successfully',
        status: 'success',
        duration: 2200,
        isClosable: true,
        position: 'bottom-right',
      });
    } catch (err: any) {
      toast({
        title: 'Failed to upload image',
        description: err.message || 'Please check the file and try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'bottom-right',
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
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
      recommendedMinutes: 20,
      minWords: 150,
      prompt: task1Prompt.trim(),
      imageUrl: task1ImageUrl.trim() || undefined,
      chartType: task1ChartType,
      sampleAnswer: task1SampleAnswer.trim() || undefined,
    };

    const task2: WritingTask = {
      id: initialExam?.task2?.id || `task2_${Date.now()}`,
      taskNumber: 2,
      title: task2Title.trim() || 'Academic Task 2',
      recommendedMinutes: 40,
      minWords: 250,
      prompt: task2Prompt.trim(),
      chartType: 'none',
      sampleAnswer: task2SampleAnswer.trim() || undefined,
    };

    const savedExam: WritingExam = {
      id: initialExam?.id || `writing_${Date.now()}`,
      title: title.trim(),
      collection: collection.trim() || 'My Tests',
      durationMinutes: durationMinutes || 60,
      task1,
      task2,
      createdAt: initialExam?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    onSave(savedExam);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-text font-sans">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border-2 border-gray-200 animate-in fade-in zoom-in-95">
        {/* Header — PNO Quiz Modal Header Style */}
        <div className="min-h-16 py-3 bg-white border-b-2 border-gray-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h2
                className="text-lg font-extrabold text-gray-900 leading-tight"
                style={{ fontFamily: outfit.style.fontFamily }}
              >
                {initialExam ? 'Edit Writing Test' : 'Create Writing Practice Test'}
              </h2>
              <span className="text-xs font-medium text-gray-500">
                Official 2-Task Academic Writing Room (60 Mins)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl border-2 border-gray-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Save Writing Test</span>
            </button>
          </div>
        </div>

        {/* Tabs — PNO Soft-Rounded Pill Tabs */}
        <div className="bg-slate-50/70 border-b-2 border-gray-200 px-6 py-2.5 flex items-center shrink-0 select-none">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border-2 border-gray-200">
            <button
              onClick={() => setActiveTab('info')}
              className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition ${
                activeTab === 'info'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              General Info
            </button>
            <button
              onClick={() => setActiveTab('task1')}
              className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'task1'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Task 1 (Report • 150 words)</span>
            </button>
            <button
              onClick={() => setActiveTab('task2')}
              className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'task2'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Task 2 (Essay • 250 words)</span>
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: General Info */}
          {activeTab === 'info' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 shadow-xs">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Test Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. CAMBRIDGE 18 ACADEMIC WRITING TEST 1"
                  className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                    <Folder className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Collection Folder</span>
                  </label>
                  <select
                    value={collection}
                    onChange={(e) => setCollection(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white font-medium"
                  >
                    {collections.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Total Duration (Minutes)</span>
                  </label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 60)}
                    className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Task 1 */}
          {activeTab === 'task1' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 shadow-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Task 1 Subtitle / Header
                  </label>
                  <input
                    type="text"
                    value={task1Title}
                    onChange={(e) => setTask1Title(e.target.value)}
                    placeholder="e.g. Academic Task 1: Bar Chart"
                    className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 focus:ring-2 focus:ring-emerald-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Visual Diagram Type
                  </label>
                  <select
                    value={task1ChartType}
                    onChange={(e) => setTask1ChartType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 focus:ring-2 focus:ring-emerald-600 bg-white font-medium"
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

              {/* Chart / Graph Image Uploader */}
              {task1ChartType !== 'none' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <span className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span>Task 1 Visual Image (Graph / Chart / Diagram)</span>
                  </span>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      value={task1ImageUrl}
                      onChange={(e) => setTask1ImageUrl(e.target.value)}
                      placeholder="Paste image URL or choose file from your device..."
                      className="flex-1 px-3 py-2 text-xs border rounded-lg border-gray-300 focus:ring-2 focus:ring-emerald-600 font-mono"
                    />

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-50 rounded-lg border border-slate-300 transition flex items-center justify-center gap-1.5 shrink-0 shadow-2xs"
                    >
                      {isUploadingImage ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                          <span>Saving Image...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 text-slate-600" />
                          <span>Choose Image File</span>
                        </>
                      )}
                    </button>
                  </div>

                  {task1ImageUrl && (
                    <div className="p-3 bg-white border border-gray-200 rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                        <span>Image Preview</span>
                        <button
                          type="button"
                          onClick={() => setTask1ImageUrl('')}
                          className="text-rose-600 hover:underline flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove image</span>
                        </button>
                      </div>
                      <div className="max-h-60 overflow-auto border rounded bg-slate-100 p-2 flex justify-center">
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
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Task 1 Prompt & Instructions *
                </label>
                <textarea
                  value={task1Prompt}
                  onChange={(e) => setTask1Prompt(e.target.value)}
                  rows={6}
                  placeholder="Enter the official Task 1 prompt and instructions..."
                  className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 focus:ring-2 focus:ring-emerald-600 font-normal leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Band 8.5–9.0 Model Sample Answer (Optional)</span>
                </label>
                <textarea
                  value={task1SampleAnswer}
                  onChange={(e) => setTask1SampleAnswer(e.target.value)}
                  rows={6}
                  placeholder="Optional: Provide a high-band sample report so test takers can learn and compare..."
                  className="w-full px-3 py-2 text-xs border rounded-lg border-gray-300 focus:ring-2 focus:ring-emerald-600 font-mono leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 3: Task 2 */}
          {activeTab === 'task2' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 shadow-xs">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Task 2 Subtitle / Topic
                </label>
                <input
                  type="text"
                  value={task2Title}
                  onChange={(e) => setTask2Title(e.target.value)}
                  placeholder="e.g. Academic Task 2: Higher Education Tuition"
                  className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 focus:ring-2 focus:ring-emerald-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Task 2 Prompt & Essay Question *
                </label>
                <textarea
                  value={task2Prompt}
                  onChange={(e) => setTask2Prompt(e.target.value)}
                  rows={8}
                  placeholder="Enter the full essay prompt and instructions..."
                  className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 focus:ring-2 focus:ring-emerald-600 font-normal leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Band 8.5–9.0 Model Essay (Optional)</span>
                </label>
                <textarea
                  value={task2SampleAnswer}
                  onChange={(e) => setTask2SampleAnswer(e.target.value)}
                  rows={8}
                  placeholder="Optional: Provide a high-scoring sample essay..."
                  className="w-full px-3 py-2 text-xs border rounded-lg border-gray-300 focus:ring-2 focus:ring-emerald-600 font-mono leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WritingEditorModal;
