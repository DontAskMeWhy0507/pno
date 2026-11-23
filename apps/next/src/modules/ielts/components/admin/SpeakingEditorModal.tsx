import { useState, type FC } from 'react';
import { useToast } from '@chakra-ui/react';
import { outfit } from '@quenti/lib/chakra-theme';
import type { SpeakingExam, SpeakingQuestion } from '../../types/speaking';
import { getAllCollections } from '../../utils/storage';
import {
  Mic,
  Save,
  Plus,
  Trash2,
  Clock,
  Folder,
  Sparkles,
} from 'lucide-react';

interface SpeakingEditorModalProps {
  isOpen: boolean;
  initialExam?: SpeakingExam | null;
  onClose: () => void;
  onSave: (exam: SpeakingExam) => void;
}

export const SpeakingEditorModal: FC<SpeakingEditorModalProps> = ({
  isOpen,
  initialExam,
  onClose,
  onSave,
}) => {
  const toast = useToast();
  const collections = getAllCollections();
  const [activeTab, setActiveTab] = useState<'info' | 'part1' | 'part2' | 'part3'>('info');

  const [title, setTitle] = useState(initialExam?.title || 'NEW IELTS SPEAKING TEST');
  const [collection, setCollection] = useState(initialExam?.collection || 'My Tests');
  const [description, setDescription] = useState(initialExam?.description || 'IELTS Speaking practice test with Parts 1, 2, and 3');

  // Part 1 Questions
  const [part1Questions, setPart1Questions] = useState<SpeakingQuestion[]>(() => {
    if (initialExam?.part1Questions && initialExam.part1Questions.length > 0) {
      return initialExam.part1Questions;
    }
    return [
      {
        id: 'p1_q1',
        part: 1,
        topic: 'Daily Routine',
        questionText: 'What is your typical daily routine like?',
        sampleAnswer: 'Well, on weekdays I typically wake up around 6:30 AM, enjoy a hot cup of coffee, and plan my primary priorities for the day before diving into work.',
      },
      {
        id: 'p1_q2',
        part: 1,
        topic: 'Daily Routine',
        questionText: 'Do you prefer mornings or evenings?',
        sampleAnswer: 'I definitely consider myself a morning person. My mind feels sharpest and most creative during the early hours of the day.',
      },
    ];
  });

  // Part 2 Question (Cue Card)
  const [part2Topic, setPart2Topic] = useState(initialExam?.part2Question?.topic || 'Technology & Innovation');
  const [part2QuestionText, setPart2QuestionText] = useState(
    initialExam?.part2Question?.questionText ||
      'Describe a useful electronic device or software application that you use regularly.'
  );
  const [part2Bullets, setPart2Bullets] = useState<string>(
    initialExam?.part2Question?.cueCardBullets?.join('\n') ||
      'What the device or application is\nHow often you use it\nWhat main features make it useful\nAnd explain how it benefits your daily life or studies'
  );
  const [part2PrepTime, setPart2PrepTime] = useState(initialExam?.part2Question?.prepTimeSeconds || 60);
  const [part2SpeakTime, setPart2SpeakTime] = useState(initialExam?.part2Question?.speakTimeSeconds || 120);
  const [part2SampleAnswer, setPart2SampleAnswer] = useState(initialExam?.part2Question?.sampleAnswer || '');

  // Part 3 Questions
  const [part3Questions, setPart3Questions] = useState<SpeakingQuestion[]>(() => {
    if (initialExam?.part3Questions && initialExam.part3Questions.length > 0) {
      return initialExam.part3Questions;
    }
    return [
      {
        id: 'p3_q1',
        part: 3,
        topic: 'Digital Technology in Society',
        questionText: 'In what ways has digital technology altered the way young people communicate?',
        sampleAnswer: 'Digital technology has undoubtedly expedited communication, enabling instantaneous connection regardless of geographical boundaries. However, it can sometimes reduce the depth of face-to-face conversations.',
      },
      {
        id: 'p3_q2',
        part: 3,
        topic: 'Digital Technology in Society',
        questionText: 'Do you believe people are becoming overly dependent on electronic devices?',
        sampleAnswer: 'To a large extent, yes. Many people rely on digital tools for memory, navigation, and entertainment. Balancing screen time with real-world physical activities is becoming a crucial skill.',
      },
    ];
  });

  if (!isOpen) return null;

  // Part 1 handlers
  const handleAddPart1Question = () => {
    const nextQ: SpeakingQuestion = {
      id: `p1_q_${Date.now()}`,
      part: 1,
      topic: 'General Topic',
      questionText: 'New Part 1 interview question...',
      sampleAnswer: '',
    };
    setPart1Questions((prev) => [...prev, nextQ]);
  };

  const handleUpdatePart1Question = (id: string, field: keyof SpeakingQuestion, val: any) => {
    setPart1Questions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: val } : q))
    );
  };

  const handleDeletePart1Question = (id: string) => {
    setPart1Questions((prev) => prev.filter((q) => q.id !== id));
  };

  // Part 3 handlers
  const handleAddPart3Question = () => {
    const nextQ: SpeakingQuestion = {
      id: `p3_q_${Date.now()}`,
      part: 3,
      topic: 'In-Depth Discussion',
      questionText: 'New Part 3 discussion question...',
      sampleAnswer: '',
    };
    setPart3Questions((prev) => [...prev, nextQ]);
  };

  const handleUpdatePart3Question = (id: string, field: keyof SpeakingQuestion, val: any) => {
    setPart3Questions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: val } : q))
    );
  };

  const handleDeletePart3Question = (id: string) => {
    setPart3Questions((prev) => prev.filter((q) => q.id !== id));
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
    if (part1Questions.length === 0) {
      toast({
        title: 'Please add at least one question for Part 1',
        status: 'warning',
        duration: 2500,
        isClosable: true,
        position: 'bottom-right',
      });
      return;
    }
    if (!part2QuestionText.trim()) {
      toast({
        title: 'Please enter a topic prompt for Part 2 Cue Card',
        status: 'warning',
        duration: 2500,
        isClosable: true,
        position: 'bottom-right',
      });
      return;
    }
    if (part3Questions.length === 0) {
      toast({
        title: 'Please add at least one question for Part 3',
        status: 'warning',
        duration: 2500,
        isClosable: true,
        position: 'bottom-right',
      });
      return;
    }

    const bullets = part2Bullets
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean);

    const part2Q: SpeakingQuestion = {
      id: initialExam?.part2Question?.id || `p2_q_${Date.now()}`,
      part: 2,
      topic: part2Topic.trim() || 'Cue Card Topic',
      questionText: part2QuestionText.trim(),
      cueCardBullets: bullets.length > 0 ? bullets : ['What it is', 'Why you like it'],
      prepTimeSeconds: part2PrepTime || 60,
      speakTimeSeconds: part2SpeakTime || 120,
      sampleAnswer: part2SampleAnswer.trim() || '',
    };

    const savedExam: SpeakingExam = {
      id: initialExam?.id || `speaking_${Date.now()}`,
      title: title.trim(),
      collection: collection.trim() || 'My Tests',
      description: description.trim() || undefined,
      part1Questions,
      part2Question: part2Q,
      part3Questions,
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
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2
                className="text-lg font-extrabold text-gray-900 leading-tight"
                style={{ fontFamily: outfit.style.fontFamily }}
              >
                {initialExam ? 'Edit Speaking Test' : 'Create Speaking Practice Test'}
              </h2>
              <span className="text-xs font-medium text-gray-500">
                Official 3-Part Speaking Room (Parts 1, 2, 3)
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
              <span>Save Speaking Test</span>
            </button>
          </div>
        </div>

        {/* Tabs — PNO Soft-Rounded Pill Tabs */}
        <div className="bg-slate-50/70 border-b-2 border-gray-200 px-6 py-2.5 flex items-center shrink-0 select-none overflow-x-auto">
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
              onClick={() => setActiveTab('part1')}
              className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'part1'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Part 1: Interview ({part1Questions.length} Qs)</span>
            </button>
            <button
              onClick={() => setActiveTab('part2')}
              className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'part2'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Part 2: Cue Card</span>
            </button>
            <button
              onClick={() => setActiveTab('part3')}
              className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'part3'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Part 3: Discussion ({part3Questions.length} Qs)</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
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
                  placeholder="e.g. IELTS SPEAKING PRACTICE: ENVIRONMENT & SOCIETY"
                  className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                    <Folder className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Collection Folder</span>
                  </label>
                  <select
                    value={collection}
                    onChange={(e) => setCollection(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white font-medium"
                  >
                    {collections.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Topic Theme / Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Technology, Daily Life, Global Issues"
                    className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Part 1 */}
          {activeTab === 'part1' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white px-5 py-3 rounded-xl border border-gray-200 shadow-2xs">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Part 1: Introduction & Interview</h3>
                  <p className="text-xs text-gray-500">Short conversational questions on familiar topics (4–5 minutes)</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddPart1Question}
                  className="px-3 py-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition flex items-center gap-1 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Question</span>
                </button>
              </div>

              {part1Questions.map((q, idx) => (
                <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      Question {idx + 1}
                    </span>
                    {part1Questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeletePart1Question(q.id)}
                        className="text-gray-400 hover:text-rose-600 p-1 transition"
                        title="Delete question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Question Text *
                    </label>
                    <input
                      type="text"
                      value={q.questionText}
                      onChange={(e) => handleUpdatePart1Question(q.id, 'questionText', e.target.value)}
                      placeholder="e.g. What do you usually do in your leisure time?"
                      className="w-full px-3 py-1.5 text-sm border rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-600 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Band 8.0+ Model Answer (Optional):</span>
                    </label>
                    <textarea
                      value={q.sampleAnswer}
                      onChange={(e) => handleUpdatePart1Question(q.id, 'sampleAnswer', e.target.value)}
                      rows={2}
                      placeholder="Optional: Provide high-scoring sample response..."
                      className="w-full px-3 py-1.5 text-xs border rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-600 font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: Part 2 */}
          {activeTab === 'part2' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 shadow-xs">
              <div className="border-b pb-2">
                <h3 className="text-sm font-bold text-gray-900">Part 2: Individual Long Turn (Cue Card)</h3>
                <p className="text-xs text-gray-500">Candidate receives a task card, has 1 minute to prepare notes, then speaks for up to 2 minutes</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Cue Card Topic Title
                </label>
                <input
                  type="text"
                  value={part2Topic}
                  onChange={(e) => setPart2Topic(e.target.value)}
                  placeholder="e.g. Technology & Innovation"
                  className="w-full px-3 py-1.5 text-sm border rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Cue Card Topic Prompt *
                </label>
                <textarea
                  value={part2QuestionText}
                  onChange={(e) => setPart2QuestionText(e.target.value)}
                  rows={2}
                  placeholder="e.g. Describe a person who has greatly inspired you in your life."
                  className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-600 font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase">
                    Bullet Points (You should say: ...)
                  </label>
                  <span className="text-[11px] text-gray-500">One bullet prompt per line</span>
                </div>
                <textarea
                  value={part2Bullets}
                  onChange={(e) => setPart2Bullets(e.target.value)}
                  rows={5}
                  placeholder="Who this person is&#10;How you first met them&#10;What remarkable qualities they have&#10;And explain why they inspire you so deeply"
                  className="w-full px-3 py-2 text-xs border rounded-lg border-gray-300 font-mono leading-relaxed focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Preparation Timer (Seconds)</span>
                  </label>
                  <input
                    type="number"
                    value={part2PrepTime}
                    onChange={(e) => setPart2PrepTime(parseInt(e.target.value) || 60)}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Speaking Timer (Seconds)</span>
                  </label>
                  <input
                    type="number"
                    value={part2SpeakTime}
                    onChange={(e) => setPart2SpeakTime(parseInt(e.target.value) || 120)}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-600 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Band 8.0+ Model Cue Card Speech (Optional)</span>
                </label>
                <textarea
                  value={part2SampleAnswer}
                  onChange={(e) => setPart2SampleAnswer(e.target.value)}
                  rows={6}
                  placeholder="Optional: Provide full model monologue demonstrating cohesive devices and varied vocabulary..."
                  className="w-full px-3 py-2 text-xs border rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-600 font-mono leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 4: Part 3 */}
          {activeTab === 'part3' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white px-5 py-3 rounded-xl border border-gray-200 shadow-2xs">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Part 3: Two-Way Discussion</h3>
                  <p className="text-xs text-gray-500">Abstract, in-depth questions expanding on the Part 2 theme (4–5 minutes)</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddPart3Question}
                  className="px-3 py-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition flex items-center gap-1 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Question</span>
                </button>
              </div>

              {part3Questions.map((q, idx) => (
                <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      Discussion Question {idx + 1}
                    </span>
                    {part3Questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeletePart3Question(q.id)}
                        className="text-gray-400 hover:text-rose-600 p-1 transition"
                        title="Delete question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Question Text *
                    </label>
                    <input
                      type="text"
                      value={q.questionText}
                      onChange={(e) => handleUpdatePart3Question(q.id, 'questionText', e.target.value)}
                      placeholder="e.g. To what extent should role models be held responsible for their actions?"
                      className="w-full px-3 py-1.5 text-sm border rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-600 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Band 8.5 Model Answer (Optional):</span>
                    </label>
                    <textarea
                      value={q.sampleAnswer}
                      onChange={(e) => handleUpdatePart3Question(q.id, 'sampleAnswer', e.target.value)}
                      rows={3}
                      placeholder="Optional: High-level analytical response demonstrating nuance..."
                      className="w-full px-3 py-1.5 text-xs border rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-600 font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpeakingEditorModal;
