import { useState, useEffect, useMemo, useCallback, type FC } from 'react';
import { useToast } from '@chakra-ui/react';
import { outfit } from '@pno/lib/chakra-theme';
import type { SpeakingExam, SpeakingQuestion } from '../../types/speaking';
import { getAllCollections } from '../../utils/storage';
import { uploadMediaFile } from '../../utils/mediaUploader';
import { MediaEmbed } from '../exam/MediaEmbed';
import {
  Mic,
  Save,
  Plus,
  Trash2,
  Clock,
  Folder,
  Sparkles,
  ArrowUp,
  ArrowDown,
  LayoutList,
  Columns,
  Image as ImageIcon,
  Video,
  AlertCircle,
} from 'lucide-react';

interface SpeakingEditorModalProps {
  isOpen: boolean;
  initialExam?: SpeakingExam | null;
  defaultCollection?: string;
  defaultViewMode?: 'all' | 'tabs';
  onClose: () => void;
  onSave: (exam: SpeakingExam) => void;
}

export const SpeakingEditorModal: FC<SpeakingEditorModalProps> = ({
  isOpen,
  initialExam,
  defaultCollection,
  defaultViewMode = 'all',
  onClose,
  onSave,
}) => {
  const toast = useToast();
  const collections = useMemo(() => getAllCollections(), []);
  const [viewMode, setViewMode] = useState<'all' | 'tabs'>(defaultViewMode);
  const [activeTab, setActiveTab] = useState<'info' | 'part1' | 'part2' | 'part3'>('info');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const [title, setTitle] = useState(initialExam?.title || 'NEW IELTS SPEAKING TEST');
  const [collection, setCollection] = useState(
    initialExam?.collection || defaultCollection || 'My Tests'
  );
  const [description, setDescription] = useState(
    initialExam?.description || 'IELTS Speaking practice test with Parts 1, 2, and 3'
  );

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
        sampleAnswer:
          'Well, on weekdays I typically wake up around 6:30 AM, enjoy a hot cup of coffee, and plan my primary priorities for the day.',
      },
      {
        id: 'p1_q2',
        part: 1,
        topic: 'Daily Routine',
        questionText: 'Do you prefer mornings or evenings?',
        sampleAnswer:
          'I definitely consider myself a morning person. My mind feels sharpest and most creative during the early hours of the day.',
      },
    ];
  });

  // Part 2 Question (Cue Card)
  const [part2Topic, setPart2Topic] = useState(
    initialExam?.part2Question?.topic || 'Technology & Innovation'
  );
  const [part2QuestionText, setPart2QuestionText] = useState(
    initialExam?.part2Question?.questionText ||
      'Describe a useful electronic device or software application that you use regularly.'
  );
  const [part2Bullets, setPart2Bullets] = useState<string>(
    initialExam?.part2Question?.cueCardBullets?.join('\n') ||
      'What the device or application is\nHow often you use it\nWhat main features make it useful\nAnd explain how it benefits your daily life or studies'
  );
  const [part2PrepTime, setPart2PrepTime] = useState(
    initialExam?.part2Question?.prepTimeSeconds || 60
  );
  const [part2SpeakTime, setPart2SpeakTime] = useState(
    initialExam?.part2Question?.speakTimeSeconds || 120
  );
  const [part2SampleAnswer, setPart2SampleAnswer] = useState(
    initialExam?.part2Question?.sampleAnswer || ''
  );
  const [part2ImageUrl, setPart2ImageUrl] = useState(initialExam?.part2Question?.imageUrl || '');
  const [part2VideoUrl, setPart2VideoUrl] = useState(initialExam?.part2Question?.videoUrl || '');

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
        sampleAnswer:
          'Digital technology has expedited communication, enabling instantaneous connection regardless of geographical boundaries.',
      },
      {
        id: 'p3_q2',
        part: 3,
        topic: 'Digital Technology in Society',
        questionText: 'Do you believe people are becoming overly dependent on electronic devices?',
        sampleAnswer:
          'To a large extent, yes. Balancing screen time with real-world physical activities is becoming a crucial skill.',
      },
    ];
  });

  const initialSnapshotRef = useRefState(
    JSON.stringify({
      title,
      collection,
      description,
      part1Questions,
      part2Topic,
      part2QuestionText,
      part2Bullets,
      part2PrepTime,
      part2SpeakTime,
      part2SampleAnswer,
      part2ImageUrl,
      part2VideoUrl,
      part3Questions,
    })
  );

  const isDirty = useMemo(
    () =>
      JSON.stringify({
        title,
        collection,
        description,
        part1Questions,
        part2Topic,
        part2QuestionText,
        part2Bullets,
        part2PrepTime,
        part2SpeakTime,
        part2SampleAnswer,
        part2ImageUrl,
        part2VideoUrl,
        part3Questions,
      }) !== initialSnapshotRef,
    [
      title,
      collection,
      description,
      part1Questions,
      part2Topic,
      part2QuestionText,
      part2Bullets,
      part2PrepTime,
      part2SpeakTime,
      part2SampleAnswer,
      part2ImageUrl,
      part2VideoUrl,
      part3Questions,
      initialSnapshotRef,
    ]
  );

  const canonicalCollection = useMemo(() => {
    const match = collections.find((c) => c.name.toLowerCase() === collection.trim().toLowerCase());
    return match ? match.name : collection;
  }, [collections, collection]);

  const hasCanonicalCollection = collections.some(
    (c) => c.name.toLowerCase() === canonicalCollection.trim().toLowerCase()
  );

  const handleUploadPart2Media = useCallback(
    async (file: File, kind: 'image' | 'video') => {
      try {
        const examId = initialExam?.id || `speaking_${Date.now()}`;
        const res = await uploadMediaFile(file, 'speaking', examId);
        if (kind === 'image') setPart2ImageUrl(res.url);
        else setPart2VideoUrl(res.url);
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
          description: err instanceof Error ? err.message : 'Unable to upload file.',
          status: 'error',
          duration: 2800,
          isClosable: true,
          position: 'bottom-right',
        });
      }
    },
    [initialExam?.id, toast]
  );

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
      if (part1Questions.length === 0 || part1Questions.some((q) => !q.questionText.trim())) {
        setActiveTab('part1');
        toast({
          title: 'All Part 1 questions must have non-empty question text',
          status: 'warning',
          duration: 2600,
          isClosable: true,
          position: 'bottom-right',
        });
        return;
      }
      if (!part2QuestionText.trim()) {
        setActiveTab('part2');
        toast({
          title: 'Please enter a topic prompt for Part 2 Cue Card',
          status: 'warning',
          duration: 2500,
          isClosable: true,
          position: 'bottom-right',
        });
        return;
      }
      if (part3Questions.length === 0 || part3Questions.some((q) => !q.questionText.trim())) {
        setActiveTab('part3');
        toast({
          title: 'All Part 3 questions must have non-empty question text',
          status: 'warning',
          duration: 2600,
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
        imageUrl: part2ImageUrl.trim() || undefined,
        videoUrl: part2VideoUrl.trim() || undefined,
      };

      const savedExam: SpeakingExam = {
        id: initialExam?.id || `speaking_${Date.now()}`,
        title: title.trim(),
        collection: canonicalCollection.trim() || 'My Tests',
        description: description.trim() || undefined,
        part1Questions: part1Questions.map((q) => ({
          ...q,
          topic: q.topic.trim() || 'General',
          questionText: q.questionText.trim(),
        })),
        part2Question: part2Q,
        part3Questions: part3Questions.map((q) => ({
          ...q,
          topic: q.topic.trim() || 'Discussion',
          questionText: q.questionText.trim(),
        })),
        createdAt: initialExam?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      onSave(savedExam);
    },
    [
      title,
      part1Questions,
      part2QuestionText,
      part3Questions,
      part2Bullets,
      initialExam,
      part2Topic,
      part2PrepTime,
      part2SpeakTime,
      part2SampleAnswer,
      part2ImageUrl,
      part2VideoUrl,
      canonicalCollection,
      description,
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
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void handleUploadPart2Media(file, 'image');
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
  }, [isOpen, handleSave, requestClose, showDiscardConfirm, handleUploadPart2Media]);

  if (!isOpen) return null;

  const moveQuestion = (
    setter: React.Dispatch<React.SetStateAction<SpeakingQuestion[]>>,
    idx: number,
    dir: -1 | 1
  ) => {
    setter((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved!);
      return next;
    });
  };

  const renderQuestionListSection = (
    partNum: 1 | 3,
    heading: string,
    sub: string,
    list: SpeakingQuestion[],
    setter: React.Dispatch<React.SetStateAction<SpeakingQuestion[]>>
  ) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{heading}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{sub}</p>
        </div>
        <button
          type="button"
          onClick={() =>
            setter((prev) => [
              ...prev,
              {
                id: `p${partNum}_q_${Date.now()}`,
                part: partNum,
                topic: partNum === 1 ? 'General Topic' : 'In-Depth Discussion',
                questionText: '',
                sampleAnswer: '',
              },
            ])
          }
          className="px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 rounded-lg border border-blue-200 dark:border-blue-800 transition flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Question</span>
        </button>
      </div>

      {list.map((q, idx) => (
        <div
          key={q.id}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
              Part {partNum} · Q{idx + 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => moveQuestion(setter, idx, -1)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30"
                title="Move up"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={idx === list.length - 1}
                onClick={() => moveQuestion(setter, idx, 1)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30"
                title="Move down"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              {list.length > 1 && (
                <button
                  type="button"
                  onClick={() => setter((prev) => prev.filter((item) => item.id !== q.id))}
                  className="text-gray-400 hover:text-rose-600 p-1 transition"
                  title="Delete question"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Topic
              </label>
              <input
                type="text"
                value={q.topic}
                onChange={(e) =>
                  setter((prev) =>
                    prev.map((item) =>
                      item.id === q.id ? { ...item, topic: e.target.value } : item
                    )
                  )
                }
                placeholder="e.g. Daily Routine"
                className="w-full px-3 py-1.5 text-xs border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Question Text *
              </label>
              <input
                type="text"
                value={q.questionText}
                onChange={(e) =>
                  setter((prev) =>
                    prev.map((item) =>
                      item.id === q.id ? { ...item, questionText: e.target.value } : item
                    )
                  )
                }
                placeholder="Enter interview question..."
                className="w-full px-3 py-1.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Model Answer (Optional)</span>
            </label>
            <textarea
              value={q.sampleAnswer}
              onChange={(e) =>
                setter((prev) =>
                  prev.map((item) =>
                    item.id === q.id ? { ...item, sampleAnswer: e.target.value } : item
                  )
                )
              }
              rows={2}
              placeholder="Optional: Sample response..."
              className="w-full px-3 py-1.5 text-xs border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono"
            />
          </div>
        </div>
      ))}
    </div>
  );

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
          placeholder="e.g. IELTS SPEAKING PRACTICE"
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
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
            Topic Theme / Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Technology, Daily Life, Global Issues"
            className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
          />
        </div>
      </div>
    </div>
  );

  const renderPart2Section = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4 shadow-xs">
      <div className="border-b border-gray-100 dark:border-gray-700 pb-2">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          Part 2: Individual Long Turn (Cue Card)
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          1 minute to prepare, up to 2 minutes speaking · Optional visual/video prompt
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
            Cue Card Topic Title
          </label>
          <input
            type="text"
            value={part2Topic}
            onChange={(e) => setPart2Topic(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-600" />
              <span>Prep (sec)</span>
            </label>
            <input
              type="number"
              min={10}
              value={part2PrepTime}
              onChange={(e) => setPart2PrepTime(parseInt(e.target.value, 10) || 60)}
              className="w-full px-3 py-1.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-600" />
              <span>Speak (sec)</span>
            </label>
            <input
              type="number"
              min={30}
              value={part2SpeakTime}
              onChange={(e) => setPart2SpeakTime(parseInt(e.target.value, 10) || 120)}
              className="w-full px-3 py-1.5 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
          Cue Card Prompt *
        </label>
        <textarea
          value={part2QuestionText}
          onChange={(e) => setPart2QuestionText(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-medium"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
            Bullet Points (You should say: ...)
          </label>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">One per line</span>
        </div>
        <textarea
          value={part2Bullets}
          onChange={(e) => setPart2Bullets(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 text-xs border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono leading-relaxed"
        />
      </div>

      {/* Optional Part 2 Visual / Video Prompt */}
      <div className="p-3.5 bg-slate-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl space-y-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 block">
          Optional Visual / Video Prompt (Supports Ctrl+V image paste)
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={part2ImageUrl}
              onChange={(e) => setPart2ImageUrl(e.target.value)}
              placeholder="Image URL..."
              className="flex-1 px-2.5 py-1.5 text-xs border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 font-mono"
            />
            <label className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 cursor-pointer flex items-center gap-1 shrink-0">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Upload</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUploadPart2Media(f, 'image');
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={part2VideoUrl}
              onChange={(e) => setPart2VideoUrl(e.target.value)}
              placeholder="Video URL (YouTube / .mp4)..."
              className="flex-1 px-2.5 py-1.5 text-xs border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 font-mono"
            />
            <label className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 cursor-pointer flex items-center gap-1 shrink-0">
              <Video className="w-3.5 h-3.5" />
              <span>Upload</span>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUploadPart2Media(f, 'video');
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
        {(part2ImageUrl || part2VideoUrl) && (
          <MediaEmbed imageUrl={part2ImageUrl} videoUrl={part2VideoUrl} alt={part2Topic} />
        )}
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Model Cue Card Speech (Optional)</span>
        </label>
        <textarea
          value={part2SampleAnswer}
          onChange={(e) => setPart2SampleAnswer(e.target.value)}
          rows={5}
          placeholder="Optional: Sample monologue..."
          className="w-full px-3 py-2 text-xs border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono leading-relaxed"
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-text font-sans">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="speaking-editor-title"
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border-2 border-gray-200 dark:border-gray-700 relative"
      >
        {/* Header */}
        <div className="min-h-16 py-3 bg-white dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-700 px-6 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="speaking-editor-title"
                className="text-lg font-extrabold text-gray-900 dark:text-gray-100 leading-tight"
                style={{ fontFamily: outfit.style.fontFamily }}
              >
                {initialExam ? 'Edit Speaking Test' : 'Create Speaking Practice Test'}
              </h2>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                3-Part Speaking Studio · Press Ctrl+S to save
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
              <span>Save Speaking Test</span>
            </button>
          </div>
        </div>

        {/* Tabs (only when in By Tab mode) */}
        {viewMode === 'tabs' && (
          <div className="bg-slate-50/70 dark:bg-gray-900/70 border-b-2 border-gray-200 dark:border-gray-700 px-6 py-2.5 flex items-center shrink-0 select-none overflow-x-auto">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
              {(
                [
                  { id: 'info', label: 'General Info' },
                  { id: 'part1', label: `Part 1 (${part1Questions.length} Qs)` },
                  { id: 'part2', label: 'Part 2: Cue Card' },
                  { id: 'part3', label: `Part 3 (${part3Questions.length} Qs)` },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
                    activeTab === t.id
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50 dark:bg-gray-900/40">
          {viewMode === 'all' ? (
            <>
              {renderInfoSection()}
              {renderQuestionListSection(
                1,
                'Part 1: Introduction & Interview',
                'Short conversational questions on familiar topics',
                part1Questions,
                setPart1Questions
              )}
              {renderPart2Section()}
              {renderQuestionListSection(
                3,
                'Part 3: Two-Way Discussion',
                'Abstract, in-depth follow-up questions',
                part3Questions,
                setPart3Questions
              )}
            </>
          ) : (
            <>
              {activeTab === 'info' && renderInfoSection()}
              {activeTab === 'part1' &&
                renderQuestionListSection(
                  1,
                  'Part 1: Introduction & Interview',
                  'Short conversational questions on familiar topics',
                  part1Questions,
                  setPart1Questions
                )}
              {activeTab === 'part2' && renderPart2Section()}
              {activeTab === 'part3' &&
                renderQuestionListSection(
                  3,
                  'Part 3: Two-Way Discussion',
                  'Abstract, in-depth follow-up questions',
                  part3Questions,
                  setPart3Questions
                )}
            </>
          )}
        </div>

        {/* Unsaved Confirmation */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-30 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="speaking-discard-title"
              className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-5 h-5" />
                <h4 id="speaking-discard-title" className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                  Discard unsaved changes?
                </h4>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                You have unsaved edits in this Speaking test.
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

function useRefState(initial: string): string {
  const [val] = useState(initial);
  return val;
}

export default SpeakingEditorModal;
