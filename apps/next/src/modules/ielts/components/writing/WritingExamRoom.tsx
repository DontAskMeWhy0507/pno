import { useState, useEffect, useRef, type FC } from 'react';
import type { WritingExam } from '../../types/writing';
import { AiCoachPromptModal } from '../common/AiCoachPromptModal';
import {
  loadWritingProgress,
  saveWritingProgress,
  clearWritingProgress,
} from '../../utils/writingProgress';
import {
  Scissors,
  Copy,
  Undo2,
  Redo2,
  FileText,
  Eye,
  HelpCircle,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  Award,
  BookOpen,
} from 'lucide-react';

interface WritingExamRoomProps {
  exam: WritingExam;
  onBackToHome: () => void;
}

export const WritingExamRoom: FC<WritingExamRoomProps> = ({ exam, onBackToHome }) => {
  const savedWriting = loadWritingProgress(exam.id);
  const [activeTaskNum, setActiveTaskNum] = useState<1 | 2>(savedWriting?.activeTaskNum ?? 1);
  const [task1Text, setTask1Text] = useState(savedWriting?.task1Text ?? '');
  const [task2Text, setTask2Text] = useState(savedWriting?.task2Text ?? '');
  const [candidateName] = useState('PNO Candidate');
  const [showAiCoachModal, setShowAiCoachModal] = useState(false);
  const [mobilePane, setMobilePane] = useState<'prompt' | 'editor'>('prompt');

  // 60 minutes timer
  const [timeRemaining, setTimeRemaining] = useState(savedWriting?.timeRemaining ?? exam.durationMinutes * 60);
  const [isTimeHidden, setIsTimeHidden] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Modals
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesText, setNotesText] = useState(savedWriting?.notesText ?? '');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Autosave progress debounced
  useEffect(() => {
    if (isSubmitted) return;
    const timer = setTimeout(() => {
      saveWritingProgress(exam.id, {
        task1Text,
        task2Text,
        activeTaskNum,
        notesText,
        timeRemaining,
        lastSavedAt: Date.now(),
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [activeTaskNum, exam.id, isSubmitted, notesText, task1Text, task2Text, timeRemaining]);

  // Synchronous flush on tab close/refresh
  useEffect(() => {
    const handleUnload = () => {
      if (!isSubmitted) {
        saveWritingProgress(exam.id, {
          task1Text,
          task2Text,
          activeTaskNum,
          notesText,
          timeRemaining,
          lastSavedAt: Date.now(),
        });
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [activeTaskNum, exam.id, isSubmitted, notesText, task1Text, task2Text, timeRemaining]);

  // Timer tick
  useEffect(() => {
    if (isSubmitted) return;
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsSubmitted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isSubmitted]);

  // Format time MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Word count helper
  const countWords = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  };

  const currentText = activeTaskNum === 1 ? task1Text : task2Text;
  const setCurrentText = (val: string) => {
    if (activeTaskNum === 1) setTask1Text(val);
    else setTask2Text(val);
  };

  const task1Words = countWords(task1Text);
  const task2Words = countWords(task2Text);
  const currentWords = activeTaskNum === 1 ? task1Words : task2Words;
  const minWords = activeTaskNum === 1 ? exam.task1.minWords : exam.task2.minWords;

  // Toolbar actions
  const handleCut = () => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start !== end) {
      const selected = currentText.substring(start, end);
      navigator.clipboard.writeText(selected);
      const newText = currentText.substring(0, start) + currentText.substring(end);
      setCurrentText(newText);
    }
  };

  const handleCopy = () => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const selected = currentText.substring(el.selectionStart, el.selectionEnd);
    if (selected) {
      navigator.clipboard.writeText(selected);
    }
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-white text-gray-900 font-sans select-auto overflow-hidden">
      {/* 1. TOP HEADER (Responsive for PC & Mobile) */}
      <header className="min-h-12 py-1.5 sm:py-0 sm:h-12 border-b border-gray-200 bg-white px-2.5 sm:px-5 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => {
              saveWritingProgress(exam.id, {
                task1Text,
                task2Text,
                activeTaskNum,
                notesText,
                timeRemaining,
                lastSavedAt: Date.now(),
              });
              if (window.confirm('Return to Home? Your essay draft and remaining time are automatically saved. You can resume anytime.')) {
                onBackToHome();
              }
            }}
            className="text-gray-500 hover:text-gray-800 p-1.5 rounded hover:bg-gray-100 transition mr-1 shrink-0"
            title="Return to Home (Draft is auto-saved)"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* PNO Badge */}
          <div className="px-2 h-6 rounded bg-blue-600 flex items-center justify-center text-white text-[10px] font-extrabold tracking-wider shrink-0">
            PNO
          </div>
          <span className="text-xs sm:text-sm font-semibold text-gray-800 truncate max-w-[110px] sm:max-w-none">{candidateName}</span>

          {/* Live Autosave Indicator */}
          <span
            className="hidden md:inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 ml-2 shrink-0"
            title="Your essay draft is automatically saved in your browser"
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Draft Auto-saved</span>
          </span>
        </div>

        {/* Timer & Hide button & AI Prompt Button */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            onClick={() => setShowAiCoachModal(true)}
            className="flex items-center gap-1 px-2 sm:px-3 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition"
            title="Generate personalized AI coaching prompt"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="hidden sm:inline">AI Coaching Prompt</span>
            <span className="sm:hidden">AI</span>
          </button>

          {!isTimeHidden ? (
            <span className="font-mono text-sm sm:text-base font-bold text-gray-900 tracking-wider">
              {formatTime(timeRemaining)}
            </span>
          ) : (
            <span className="text-xs text-gray-400 italic">Hidden</span>
          )}
          <button
            onClick={() => setIsTimeHidden(!isTimeHidden)}
            className="text-xs font-semibold text-gray-600 hover:text-gray-900 px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-50 transition"
          >
            {isTimeHidden ? 'Show' : 'Hide'}
          </button>
        </div>
      </header>

      {/* Mobile Tab Switcher (< md) */}
      <div className="flex md:hidden items-center bg-slate-100 border-b border-gray-200 px-2 py-1.5 gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setMobilePane('prompt')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition ${
            mobilePane === 'prompt'
              ? 'bg-white text-blue-700 shadow-xs border border-blue-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Đề bài &amp; Biểu đồ
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('editor')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition ${
            mobilePane === 'editor'
              ? 'bg-white text-blue-700 shadow-xs border border-blue-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Bài viết ({currentWords} từ)
        </button>
      </div>

      {/* 2. MAIN SPLIT AREA */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANE: Task prompt, instructions and Visual Chart */}
        <div
          className={`${
            mobilePane === 'prompt' ? 'block w-full' : 'hidden'
          } md:block md:w-1/2 h-full md:border-r border-gray-300 overflow-y-auto p-4 sm:p-6 bg-white space-y-4`}
        >
          {/* Top warning instruction matching screenshot */}
          <div className="border-l-2 border-red-500 pl-2 text-xs italic text-gray-700">
            {activeTaskNum === 1
              ? `You should spend about ${exam.task1.recommendedMinutes || 20} minutes on this task. Write at least ${exam.task1.minWords || 150} words.`
              : `You should spend about ${exam.task2.recommendedMinutes || 40} minutes on this task. Write at least ${exam.task2.minWords || 250} words.`}
          </div>

          {activeTaskNum === 1 ? (
            /* Task 1 Content */
            <div className="space-y-4">
              <h2 className="text-base font-bold text-gray-900 leading-snug">
                {exam.task1.title || 'Writing Task 1'}
              </h2>

              <div className="p-4 bg-slate-50 border border-gray-200 rounded-lg text-sm text-gray-800 font-serif leading-relaxed whitespace-pre-line">
                {exam.task1.prompt}
              </div>

              {exam.task1.imageUrl ? (
                <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-2xs flex justify-center">
                  <img
                    src={exam.task1.imageUrl}
                    alt={exam.task1.title || 'Task 1 Diagram'}
                    className="max-h-96 w-auto object-contain rounded"
                  />
                </div>
              ) : exam.id === 'writing_test_2' ? (
                /* Built-in SVG Line Graph for Writing Test 2 (USA, Canada, Mexico 2010-2020) */
                <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-2xs">
                  <div className="flex items-center justify-center gap-6 mb-3 text-xs font-semibold text-gray-700">
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-0.5 bg-blue-600 inline-block"></span>
                      <span>USA</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-0.5 bg-emerald-600 inline-block"></span>
                      <span>Canada</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-0.5 bg-amber-600 inline-block"></span>
                      <span>Mexico</span>
                    </div>
                  </div>
                  <svg viewBox="0 0 420 220" className="w-full h-56 overflow-visible">
                    {[0, 20, 40, 60, 80, 100].map((pct) => {
                      const y = 185 - (pct / 100) * 155;
                      return (
                        <g key={pct}>
                          <line x1="45" y1={y} x2="395" y2={y} stroke="#e5e7eb" strokeWidth="1" />
                          <text x="38" y={y + 4} textAnchor="end" fontSize="10" fill="#4b5563" fontWeight="600">
                            {pct}%
                          </text>
                        </g>
                      );
                    })}
                    {[2010, 2012, 2014, 2016, 2018, 2020].map((yr, i) => {
                      const x = 55 + i * 66;
                      return (
                        <text key={yr} x={x} y="205" textAnchor="middle" fontSize="10" fill="#374151" fontWeight="700">
                          {yr}
                        </text>
                      );
                    })}
                    {/* USA: 72 -> 75 -> 78 -> 81 -> 84 -> 86 */}
                    <polyline
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2.5"
                      points="55,73.4 121,68.8 187,64.1 253,59.5 319,54.8 385,51.7"
                    />
                    {/* Canada: 68 -> 73 -> 78 -> 83 -> 86 -> 88 */}
                    <polyline
                      fill="none"
                      stroke="#059669"
                      strokeWidth="2.5"
                      points="55,79.6 121,71.9 187,64.1 253,56.4 319,51.7 385,48.6"
                    />
                    {/* Mexico: 30 -> 36 -> 43 -> 52 -> 61 -> 70 */}
                    <polyline
                      fill="none"
                      stroke="#d97706"
                      strokeWidth="2.5"
                      points="55,138.5 121,129.2 187,118.4 253,104.4 319,90.5 385,76.5"
                    />
                  </svg>
                </div>
              ) : (exam.id === 'writing_test_1' || exam.task1.prompt.includes('2004')) ? (
                /* Bar Chart Recreation for Writing Test 1 (UK 2004 expenditure) */
                <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-2xs">
                  {/* Legend */}
                  <div className="flex items-center justify-center gap-6 mb-4 text-xs font-semibold text-gray-700">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 bg-gray-900 inline-block border border-gray-900"></span>
                      <span>Food and drink</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 bg-[#8b919d] inline-block border border-[#8b919d]"></span>
                      <span>Restaurant and hotel</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 bg-white inline-block border border-gray-400"></span>
                      <span>Entertainment</span>
                    </div>
                  </div>

                  {/* SVG/HTML Chart Container */}
                  <div className="relative h-64 flex pt-2">
                    {/* Y Axis */}
                    <div className="w-12 h-full flex flex-col justify-between items-end pr-2 text-[11px] font-bold text-gray-700 border-r border-gray-300">
                      <span>25%</span>
                      <span>20%</span>
                      <span>15%</span>
                      <span>10%</span>
                      <span>5%</span>
                      <span>0%</span>
                    </div>

                    {/* Y-axis label */}
                    <div className="absolute -left-6 top-1/2 -rotate-90 text-[11px] font-bold text-gray-600 origin-center">
                      % of Total Spending
                    </div>

                    {/* Grid lines & Bars */}
                    <div className="flex-1 h-full relative flex items-end justify-around px-2">
                      {/* Horizontal background lines */}
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
                        <div className="border-b border-gray-300 w-full h-0"></div>
                        <div className="border-b border-gray-300 w-full h-0"></div>
                        <div className="border-b border-gray-300 w-full h-0"></div>
                        <div className="border-b border-gray-300 w-full h-0"></div>
                        <div className="border-b border-gray-300 w-full h-0"></div>
                        <div className="border-b-2 border-gray-500 w-full h-0"></div>
                      </div>

                      {/* Group 1: Under 30 */}
                      <div className="flex flex-col items-center z-10 w-16">
                        <div className="flex items-end gap-1 h-56">
                          <div
                            style={{ height: `${(6 / 25) * 100}%` }}
                            className="w-4 bg-gray-900 border border-gray-900"
                            title="Food & drink: 6%"
                          ></div>
                          <div
                            style={{ height: `${(14 / 25) * 100}%` }}
                            className="w-4 bg-[#8b919d] border border-[#8b919d]"
                            title="Restaurant & hotel: 14%"
                          ></div>
                          <div
                            style={{ height: `${(7 / 25) * 100}%` }}
                            className="w-4 bg-white border border-gray-400"
                            title="Entertainment: 7%"
                          ></div>
                        </div>
                        <span className="text-xs font-bold text-gray-800 mt-2">Under 30</span>
                      </div>

                      {/* Group 2: 31-45 */}
                      <div className="flex flex-col items-center z-10 w-16">
                        <div className="flex items-end gap-1 h-56">
                          <div
                            style={{ height: `${(13 / 25) * 100}%` }}
                            className="w-4 bg-gray-900 border border-gray-900"
                            title="Food & drink: 13%"
                          ></div>
                          <div
                            style={{ height: `${(12 / 25) * 100}%` }}
                            className="w-4 bg-[#8b919d] border border-[#8b919d]"
                            title="Restaurant & hotel: 12%"
                          ></div>
                          <div
                            style={{ height: `${(8 / 25) * 100}%` }}
                            className="w-4 bg-white border border-gray-400"
                            title="Entertainment: 8%"
                          ></div>
                        </div>
                        <span className="text-xs font-bold text-gray-800 mt-2">31-45</span>
                      </div>

                      {/* Group 3: 46-60 */}
                      <div className="flex flex-col items-center z-10 w-16">
                        <div className="flex items-end gap-1 h-56">
                          <div
                            style={{ height: `${(17 / 25) * 100}%` }}
                            className="w-4 bg-gray-900 border border-gray-900"
                            title="Food & drink: 17%"
                          ></div>
                          <div
                            style={{ height: `${(12 / 25) * 100}%` }}
                            className="w-4 bg-[#8b919d] border border-[#8b919d]"
                            title="Restaurant & hotel: 12%"
                          ></div>
                          <div
                            style={{ height: `${(14 / 25) * 100}%` }}
                            className="w-4 bg-white border border-gray-400"
                            title="Entertainment: 14%"
                          ></div>
                        </div>
                        <span className="text-xs font-bold text-gray-800 mt-2">46-60</span>
                      </div>

                      {/* Group 4: 61-75 */}
                      <div className="flex flex-col items-center z-10 w-16">
                        <div className="flex items-end gap-1 h-56">
                          <div
                            style={{ height: `${(20 / 25) * 100}%` }}
                            className="w-4 bg-gray-900 border border-gray-900"
                            title="Food & drink: 20%"
                          ></div>
                          <div
                            style={{ height: `${(2 / 25) * 100}%` }}
                            className="w-4 bg-[#8b919d] border border-[#8b919d]"
                            title="Restaurant & hotel: 2%"
                          ></div>
                          <div
                            style={{ height: `${(23 / 25) * 100}%` }}
                            className="w-4 bg-white border border-gray-400"
                            title="Entertainment: 23%"
                          ></div>
                        </div>
                        <span className="text-xs font-bold text-gray-800 mt-2">61-75</span>
                      </div>

                      {/* Group 5: 76+ */}
                      <div className="flex flex-col items-center z-10 w-16">
                        <div className="flex items-end gap-1 h-56">
                          <div
                            style={{ height: `${(23 / 25) * 100}%` }}
                            className="w-4 bg-gray-900 border border-gray-900"
                            title="Food & drink: 23%"
                          ></div>
                          <div
                            style={{ height: `${(7 / 25) * 100}%` }}
                            className="w-4 bg-[#8b919d] border border-[#8b919d]"
                            title="Restaurant & hotel: 7%"
                          ></div>
                          <div
                            style={{ height: `${(13 / 25) * 100}%` }}
                            className="w-4 bg-white border border-gray-400"
                            title="Entertainment: 13%"
                          ></div>
                        </div>
                        <span className="text-xs font-bold text-gray-800 mt-2">76+</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            /* Task 2 Content */
            <div className="space-y-4">
              <h2 className="text-base font-bold text-gray-900 leading-snug">
                Writing Task 2 Essay
              </h2>
              <div className="p-4 bg-slate-50 border border-gray-200 rounded-lg text-sm text-gray-800 font-serif leading-relaxed">
                {exam.task2.prompt}
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                <p>• Viết ít nhất 250 từ.</p>
                <p>• Nêu rõ các luận điểm, ví dụ thực tế và quan điểm cá nhân.</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANE: Toolbar, Textarea and Word count */}
        <div
          className={`${
            mobilePane === 'editor' ? 'flex w-full' : 'hidden'
          } md:flex md:w-1/2 h-full flex-col bg-white`}
        >
          {/* Mini Toolbar matching screenshot icons */}
          <div className="h-10 border-b border-gray-200 px-4 flex items-center gap-3 text-gray-400 bg-white select-none shrink-0">
            <button
              onClick={handleCut}
              className="p-1 hover:text-gray-700 hover:bg-gray-100 rounded transition"
              title="Cut"
            >
              <Scissors className="w-4 h-4" />
            </button>
            <button
              onClick={handleCopy}
              className="p-1 hover:text-gray-700 hover:bg-gray-100 rounded transition"
              title="Copy"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={() => document.execCommand('undo')}
              className="p-1 hover:text-gray-700 hover:bg-gray-100 rounded transition"
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => document.execCommand('redo')}
              className="p-1 hover:text-gray-700 hover:bg-gray-100 rounded transition"
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Textarea */}
          <div className="flex-1 p-3 sm:p-4 relative">
            <textarea
              ref={textareaRef}
              value={currentText}
              onChange={(e) => setCurrentText(e.target.value)}
              placeholder="Type your answer here..."
              spellCheck={false}
              className="w-full h-full p-2 resize-none border-0 outline-none text-sm text-gray-800 leading-relaxed font-sans placeholder-gray-400"
            />
          </div>

          {/* Bottom Word Count indicator */}
          <div className="h-8 border-t border-gray-200 px-4 flex items-center justify-end bg-white shrink-0">
            <span
              className={`text-xs ${
                currentWords >= minWords ? 'text-emerald-600 font-semibold' : 'text-amber-600'
              }`}
            >
              Số từ: {currentWords} (Tối thiểu {minWords} từ)
            </span>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM BAR (Responsive for PC & Mobile) */}
      <footer className="min-h-12 py-2 sm:py-0 sm:h-12 border-t border-gray-200 bg-slate-50 px-3 sm:px-5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Left Task Tabs */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTaskNum(1)}
            className={`px-2.5 sm:px-4 py-1.5 rounded text-xs font-bold transition ${
              activeTaskNum === 1
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
            }`}
          >
            Task 1 {task1Words > 0 && `(${task1Words})`}
          </button>
          <button
            onClick={() => setActiveTaskNum(2)}
            className={`px-2.5 sm:px-4 py-1.5 rounded text-xs font-bold transition ${
              activeTaskNum === 2
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
            }`}
          >
            Task 2 {task2Words > 0 && `(${task2Words})`}
          </button>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <button
            onClick={() => setShowNotesModal(true)}
            className="px-2 sm:px-3 py-1.5 sm:py-1 text-xs font-semibold text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-100 transition flex items-center gap-1"
            title="Ghi chú"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ghi chú</span>
          </button>

          <button
            onClick={() => setShowReviewModal(true)}
            className="px-2 sm:px-3 py-1.5 sm:py-1 text-xs font-semibold text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-100 transition flex items-center gap-1"
            title="Xem lại bài làm"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Xem lại bài làm</span>
          </button>

          <button
            onClick={() => setShowGuideModal(true)}
            className="px-2 sm:px-3 py-1.5 sm:py-1 text-xs font-semibold text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-100 transition flex items-center gap-1"
            title="Hướng dẫn"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Hướng dẫn</span>
          </button>

          <button
            onClick={() => {
              clearWritingProgress(exam.id);
              setIsSubmitted(true);
            }}
            className="px-3 sm:px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition shadow-xs flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Nộp bài</span>
          </button>
        </div>
      </footer>

      {/* 4. RESULT & MODEL ANSWER MODAL AFTER SUBMISSION */}
      {isSubmitted && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Kết Quả Nộp Bài & Đáp Án Mẫu Band 8.5+
                  </h3>
                  <p className="text-xs text-gray-500">
                    Task 1: {task1Words} từ • Task 2: {task2Words} từ
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAiCoachModal(true)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 shadow-xs transition"
                  title="Mở bảng tạo prompt cá nhân hoá theo mục tiêu Band để gửi AI"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Copy Prompt Cho AI</span>
                </button>

                <button
                  onClick={() => setIsSubmitted(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded transition"
                >
                  Tiếp tục sửa bài
                </button>

                <button
                  onClick={onBackToHome}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition"
                >
                  Về Trang Chủ
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
              {/* Task 1 Comparison */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-sm font-bold text-blue-700">TASK 1 MODEL ANSWER (Simon Band 9.0)</span>
                  <span className="text-xs text-gray-500">Bài làm của bạn: {task1Words} từ</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Your Answer */}
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <h5 className="text-xs font-bold text-gray-700 mb-2">Bài viết của bạn:</h5>
                    <div className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                      {task1Text || <span className="text-gray-400 italic">Chưa nhập bài làm</span>}
                    </div>
                  </div>

                  {/* Model Answer */}
                  <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200">
                    <h5 className="text-xs font-bold text-emerald-800 mb-2">Bài mẫu chuẩn Band 9.0:</h5>
                    <div className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                      {exam.task1.sampleAnswer}
                    </div>
                  </div>
                </div>

                {/* Key vocabulary for Task 1 */}
                {exam.task1.keyVocabulary && (
                  <div className="pt-2">
                    <h5 className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                      <span>Từ vựng & Cụm từ đắt giá cho dạng bài này:</span>
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {exam.task1.keyVocabulary.map((v, i) => (
                        <span
                          key={i}
                          className="text-[11px] bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded"
                        >
                          <strong>{v.word}</strong>: {v.meaning}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Task 2 Comparison */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-sm font-bold text-blue-700">TASK 2 MODEL ESSAY (Band 8.5+)</span>
                  <span className="text-xs text-gray-500">Bài làm của bạn: {task2Words} từ</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Your Answer */}
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <h5 className="text-xs font-bold text-gray-700 mb-2">Bài viết của bạn:</h5>
                    <div className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                      {task2Text || <span className="text-gray-400 italic">Chưa nhập bài làm</span>}
                    </div>
                  </div>

                  {/* Model Answer */}
                  <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200">
                    <h5 className="text-xs font-bold text-emerald-800 mb-2">Bài mẫu chuẩn Band 8.5+:</h5>
                    <div className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                      {exam.task2.sampleAnswer}
                    </div>
                  </div>
                </div>

                {/* Key vocabulary for Task 2 */}
                {exam.task2.keyVocabulary && (
                  <div className="pt-2">
                    <h5 className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                      <span>Từ vựng C1-C2 dùng trong bài mẫu:</span>
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {exam.task2.keyVocabulary.map((v, i) => (
                        <span
                          key={i}
                          className="text-[11px] bg-sky-50 text-sky-900 border border-sky-200 px-2 py-0.5 rounded"
                        >
                          <strong>{v.word}</strong>: {v.meaning}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. NOTES MODAL */}
      {showNotesModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-3">
            <h4 className="text-sm font-bold text-gray-900">Sổ tay ghi chú (Scratchpad)</h4>
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Ghi nhanh dàn bài, từ vựng hoặc ý tưởng tại đây..."
              rows={8}
              className="w-full p-3 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <div className="flex justify-end">
              <button
                onClick={() => setShowNotesModal(false)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. REVIEW MODAL */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h4 className="text-sm font-bold text-gray-900">Xem Lại Toàn Bộ Bài Làm</h4>
              <button onClick={() => setShowReviewModal(false)} className="text-gray-400 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <h5 className="font-bold text-blue-700 mb-1">TASK 1 ({task1Words} từ):</h5>
                <div className="p-3 bg-gray-50 rounded border border-gray-200 whitespace-pre-wrap">
                  {task1Text || '(Chưa viết)'}
                </div>
              </div>
              <div>
                <h5 className="font-bold text-blue-700 mb-1">TASK 2 ({task2Words} từ):</h5>
                <div className="p-3 bg-gray-50 rounded border border-gray-200 whitespace-pre-wrap">
                  {task2Text || '(Chưa viết)'}
                </div>
              </div>
            </div>
            <div className="p-3 border-t flex justify-end">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded"
              >
                Tiếp Tục Viết
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. GUIDE MODAL */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-3">
            <h4 className="text-sm font-bold text-gray-900">Hướng Dẫn Thi IELTS Writing Trên Máy</h4>
            <div className="text-xs text-gray-600 space-y-2 leading-relaxed">
              <p>• <strong>Thời gian làm bài:</strong> 60 phút cho cả 2 task. Bạn có thể tự do chuyển đổi giữa Task 1 và Task 2 bất kỳ lúc nào.</p>
              <p>• <strong>Khuyến nghị phân bổ:</strong> Dành 20 phút cho Task 1 (tối thiểu 150 từ) và 40 phút cho Task 2 (tối thiểu 250 từ).</p>
              <p>• <strong>Thanh công cụ:</strong> Sử dụng các nút Cut, Copy, Undo, Redo trên đầu khung gõ để chỉnh sửa văn bản nhanh.</p>
              <p>• <strong>Ẩn đồng hồ:</strong> Bấm nút "Ẩn" cạnh thời gian nếu bạn muốn tập trung viết mà không bị áp lực số phút đếm ngược.</p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. AI COACH PROMPT MODAL */}
      <AiCoachPromptModal
        isOpen={showAiCoachModal}
        onClose={() => setShowAiCoachModal(false)}
        skillType="writing"
        taskTitle={exam.title}
        taskPrompt={`TASK 1:\n${exam.task1.prompt}\n\nTASK 2:\n${exam.task2.prompt}`}
        userContent={`--- BÀI LÀM TASK 1 (${task1Words} từ) ---\n${task1Text || '(Chưa làm)'}\n\n--- BÀI LÀM TASK 2 (${task2Words} từ) ---\n${task2Text || '(Chưa làm)'}`}
        sampleContent={`--- BÀI MẪU TASK 1 (Band 9.0 Simon) ---\n${exam.task1.sampleAnswer}\n\n--- BÀI MẪU TASK 2 (Band 8.5+) ---\n${exam.task2.sampleAnswer}`}
        wordCount={task1Words + task2Words}
      />
    </div>
  );
};
