import { useState, useEffect, useRef, type FC } from 'react';
import type { SpeakingExam, SpeakingQuestion } from '../../types/speaking';
import { AiCoachPromptModal } from '../common/AiCoachPromptModal';
import {
  Mic,
  MicOff,
  Square,
  Play,
  ArrowLeft,
  Clock,
  Sparkles,
  FileText,
  Volume2,
  BookOpen,
  Award,
} from 'lucide-react';

interface SpeakingExamRoomProps {
  exam: SpeakingExam;
  onBackToHome: () => void;
}

export const SpeakingExamRoom: FC<SpeakingExamRoomProps> = ({ exam, onBackToHome }) => {
  const [activePart, setActivePart] = useState<1 | 2 | 3>(1);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);
  const [showAiCoachModal, setShowAiCoachModal] = useState(false);
  const [mobilePane, setMobilePane] = useState<'question' | 'recorder'>('question');

  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrlMap, setAudioUrlMap] = useState<Record<string, string>>({});
  const [transcriptsMap, setTranscriptsMap] = useState<Record<string, string>>({});

  // Part 2 prep timer state
  const defaultPrepSeconds = exam.part2Question?.prepTimeSeconds || 60;
  const [isPrepRunning, setIsPrepRunning] = useState(false);
  const [prepSecondsLeft, setPrepSecondsLeft] = useState(defaultPrepSeconds);
  const [prepNotes, setPrepNotes] = useState('');

  // Sample answer visibility
  const [showSampleMap, setShowSampleMap] = useState<Record<string, boolean>>({});

  // References
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const audioUrlMapRef = useRef<Record<string, string>>({});

  // Get current active questions list
  const currentQuestions: SpeakingQuestion[] =
    activePart === 1
      ? exam.part1Questions
      : activePart === 2
      ? [exam.part2Question]
      : exam.part3Questions;

  const currentQuestion = (currentQuestions[selectedQuestionIndex] || currentQuestions[0])!;
  const currentQId = currentQuestion.id;

  // Prep timer countdown
  useEffect(() => {
    if (!isPrepRunning) return;
    const timer = setInterval(() => {
      setPrepSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isPrepRunning]);

  useEffect(() => {
    if (isPrepRunning && prepSecondsLeft === 0) {
      setIsPrepRunning(false);
    }
  }, [isPrepRunning, prepSecondsLeft]);

  // Cleanup active mic, speech recognition, and blob URLs on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      Object.values(audioUrlMapRef.current).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
    };
  }, []);

  // Recording timer countdown
  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isRecording]);

  // Setup SpeechRecognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript + ' ';
        }
        setTranscriptsMap((prev) => ({
          ...prev,
          [currentQId]: fullTranscript.trim(),
        }));
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition warning:', err.error);
      };

      recognitionRef.current = recognition;
    }
  }, [currentQId]);

  // Start Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const prevUrl = audioUrlMapRef.current[currentQId];
        if (prevUrl) {
          try {
            URL.revokeObjectURL(prevUrl);
          } catch {}
        }
        const url = URL.createObjectURL(audioBlob);
        audioUrlMapRef.current[currentQId] = url;
        setAudioUrlMap((prev) => ({
          ...prev,
          [currentQId]: url,
        }));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecordingSeconds(0);
      setIsRecording(true);

      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          // Ignored
        }
      }
    } catch (err: any) {
      alert('Cannot connect to Microphone: ' + (err.message || 'Please grant microphone access to your browser.'));
    }
  };

  // Stop Voice Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignored
      }
    }
    setIsRecording(false);
  };

  const handleSelectPart = (partNum: 1 | 2 | 3) => {
    if (isRecording) stopRecording();
    setActivePart(partNum);
    setSelectedQuestionIndex(0);
  };

  const handleSelectQuestion = (idx: number) => {
    if (isRecording) stopRecording();
    setSelectedQuestionIndex(idx);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-white text-slate-900 font-sans select-auto overflow-hidden">
      {/* 1. TOP HEADER */}
      <header className="min-h-12 py-2 sm:py-0 sm:h-12 border-b border-slate-200 bg-white px-3 sm:px-5 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to leave the speaking room? Your in-progress recordings will be discarded.')) {
                if (isRecording) stopRecording();
                onBackToHome();
              }
            }}
            className="text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 transition shrink-0"
            title="Back to Home"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[160px] sm:max-w-none">{exam.title}</span>
            <span className="hidden md:inline text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded shrink-0">
              Speaking Room
            </span>
          </div>
        </div>

        {/* Actions & Part Switcher */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => setShowAiCoachModal(true)}
            className="flex items-center gap-1 px-2 sm:px-3 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition"
            title="Generate personalized AI coaching prompt"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="hidden sm:inline">AI Coaching Prompt</span>
            <span className="sm:hidden">AI</span>
          </button>

          {/* Part Switcher (Segmented Control) */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => handleSelectPart(1)}
              className={`px-2 sm:px-3 py-1 text-xs font-semibold rounded-md transition ${
                activePart === 1
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Part 1
            </button>
            <button
              onClick={() => handleSelectPart(2)}
              className={`px-2 sm:px-3 py-1 text-xs font-semibold rounded-md transition ${
                activePart === 2
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Part 2
            </button>
            <button
              onClick={() => handleSelectPart(3)}
              className={`px-2 sm:px-3 py-1 text-xs font-semibold rounded-md transition ${
                activePart === 3
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Part 3
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Tab Switcher (< md) */}
      <div className="flex md:hidden items-center bg-slate-100 border-b border-slate-200 px-2 py-1.5 gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setMobilePane('question')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition ${
            mobilePane === 'question'
              ? 'bg-white text-blue-700 shadow-xs border border-blue-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Câu hỏi &amp; Bài mẫu
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('recorder')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            mobilePane === 'recorder'
              ? 'bg-white text-blue-700 shadow-xs border border-blue-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {isRecording && <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />}
          <span>Thu âm &amp; Transcript</span>
        </button>
      </div>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Questions list & Prompt Details */}
        <div
          className={`${
            mobilePane === 'question' ? 'block w-full' : 'hidden'
          } md:block md:w-1/2 h-full md:border-r border-slate-200 overflow-y-auto p-4 sm:p-6 space-y-5 bg-white`}
        >
          {/* Question selection pills if multiple */}
          {currentQuestions.length > 1 && (
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 overflow-x-auto">
              <span className="text-xs font-semibold text-slate-500 shrink-0">Questions:</span>
              {currentQuestions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => handleSelectQuestion(idx)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition shrink-0 ${
                    selectedQuestionIndex === idx
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Q{idx + 1}
                </button>
              ))}
            </div>
          )}

          {/* Current Question Display */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                Part {currentQuestion.part} • {currentQuestion.topic}
              </span>
              <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                <Clock className="w-3 h-3 text-slate-400" />
                {currentQuestion.part === 2 ? '1 phút chuẩn bị • 2 phút nói' : '30 - 45 giây'}
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-900 leading-relaxed">
              "{currentQuestion.questionText}"
            </h3>

            {/* Cue Card Points for Part 2 */}
            {currentQuestion.cueCardBullets && (
              <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-lg space-y-2 mt-3 text-xs text-slate-800">
                <p className="font-semibold text-amber-900">You should say:</p>
                <ul className="space-y-1 list-disc list-inside text-slate-700">
                  {currentQuestion.cueCardBullets.map((bullet, i) => (
                    <li key={i}>{bullet}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Part 2: 1-Minute Prep Countdown & Scratchpad */}
          {activePart === 2 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">1 Phút Chuẩn Bị</h4>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-base font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-md border border-slate-200">
                    {formatSeconds(prepSecondsLeft)}
                  </span>
                  <button
                    onClick={() => {
                      if (isPrepRunning) {
                        setIsPrepRunning(false);
                      } else {
                        setIsPrepRunning(true);
                      }
                    }}
                    className={`px-3.5 py-1 text-xs font-semibold rounded-md transition shadow-xs ${
                      isPrepRunning
                        ? 'bg-slate-800 hover:bg-slate-900 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isPrepRunning ? 'Tạm Dừng' : prepSecondsLeft === defaultPrepSeconds ? 'Bắt Đầu' : 'Tiếp Tục'}
                  </button>
                  <button
                    onClick={() => {
                      setIsPrepRunning(false);
                      setPrepSecondsLeft(defaultPrepSeconds);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {prepSecondsLeft === 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-semibold text-amber-900">
                  ⏰ Đã hết thời gian chuẩn bị! Hãy bấm &quot;Bắt Đầu Ghi Âm&quot; ở cột bên phải để trình bày bài nói.
                </div>
              )}

              {/* Prep Notes */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Ghi chú từ khóa (Keywords):
                </label>
                <textarea
                  value={prepNotes}
                  onChange={(e) => setPrepNotes(e.target.value)}
                  placeholder="What, When, Who, Why, Feelings..."
                  rows={3}
                  className="w-full p-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-600 outline-none resize-none transition"
                />
              </div>
            </div>
          )}

          {/* Model Answer (Đáp Án Mẫu Band 8.0+) */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-slate-700" />
                <h4 className="text-sm font-bold text-slate-900">Bài Mẫu Band 8.0+</h4>
              </div>
              <button
                onClick={() =>
                  setShowSampleMap((prev) => ({ ...prev, [currentQId]: !prev[currentQId] }))
                }
                className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg transition shadow-2xs"
              >
                {showSampleMap[currentQId] ? 'Ẩn Bài Mẫu' : 'Xem Bài Mẫu'}
              </button>
            </div>

            {showSampleMap[currentQId] && (
              <div className="space-y-3 pt-2 animate-in fade-in">
                <div className="p-4 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-serif shadow-2xs">
                  {currentQuestion.sampleAnswer}
                </div>

                {/* Vocabulary */}
                {currentQuestion.keyVocabulary && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                      <span>Từ vựng trọng tâm:</span>
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {currentQuestion.keyVocabulary.map((v, i) => (
                        <div
                          key={i}
                          className="p-2.5 bg-white border border-slate-200 rounded-lg text-[11px] shadow-2xs"
                        >
                          <div className="font-bold text-slate-900">{v.word}</div>
                          <div className="text-slate-500">{v.meaning}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Voice Recording & Speech-to-Text Transcript */}
        <div
          className={`${
            mobilePane === 'recorder' ? 'flex w-full' : 'hidden'
          } md:flex md:w-1/2 h-full flex-col bg-slate-50/50 p-4 sm:p-6 space-y-5 overflow-y-auto`}
        >
          {/* Recorder Control Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center space-y-4 shadow-2xs text-center">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isRecording ? 'Đang Thu Âm Giọng Nói...' : 'Phòng Thu Giọng Nói'}
            </span>

            {/* Pulsing Record Circle */}
            <div className="relative flex items-center justify-center my-1">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                  isRecording
                    ? 'bg-rose-600 text-white shadow-md ring-4 ring-rose-200 animate-pulse'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 shadow-2xs'
                }`}
                title={isRecording ? 'Bấm để dừng' : 'Bấm để bắt đầu thu âm'}
              >
                {isRecording ? <Mic className="w-7 h-7" /> : <MicOff className="w-7 h-7" />}
              </button>
            </div>

            {/* Time Counter */}
            <div className="font-mono text-3xl font-bold text-slate-900">
              {formatSeconds(recordingSeconds)}
            </div>

            {/* Action Button */}
            <div className="flex items-center gap-3">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-2 transition"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Bắt Đầu Ghi Âm</span>
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-2 transition"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  <span>Dừng & Lưu</span>
                </button>
              )}
            </div>

            {/* Audio Playback if recorded */}
            {audioUrlMap[currentQId] && (
              <div className="w-full pt-4 border-t border-slate-100 space-y-2">
                <span className="text-xs text-slate-600 font-medium flex items-center justify-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-slate-500" />
                  <span>Nghe lại bản ghi:</span>
                </span>
                <audio controls src={audioUrlMap[currentQId]} className="w-full h-9 rounded" />
              </div>
            )}
          </div>

          {/* Speech-to-Text Transcript Box */}
          <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl p-5 space-y-3 min-h-[220px] shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-bold text-slate-900">Transcript Lời Nói (Speech-to-Text)</h4>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Tự động nhận diện</span>
            </div>

            <textarea
              value={transcriptsMap[currentQId] || ''}
              onChange={(e) =>
                setTranscriptsMap((prev) => ({ ...prev, [currentQId]: e.target.value }))
              }
              placeholder={
                isRecording
                  ? 'Đang lắng nghe và phiên âm lời nói của bạn...'
                  : 'Nội dung transcript sẽ xuất hiện ở đây khi bạn nói vào micro, hoặc bạn có thể tự nhập/chỉnh sửa tại đây.'
              }
              className="flex-1 w-full p-3 bg-slate-50/70 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none resize-none leading-relaxed transition"
            />

            {/* Bottom bar with word count and copy prompt */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-500 font-medium">
                Số từ: {(transcriptsMap[currentQId] || '').trim().split(/\s+/).filter(Boolean).length} từ
              </span>

              <button
                onClick={() => setShowAiCoachModal(true)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition"
                title="Tạo prompt cá nhân hoá theo mục tiêu Band điểm để gửi AI"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Copy Prompt Cho AI</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Coach Prompt Modal */}
      <AiCoachPromptModal
        isOpen={showAiCoachModal}
        onClose={() => setShowAiCoachModal(false)}
        skillType="speaking"
        taskTitle={`${exam.title} - ${currentQuestion.topic}`}
        taskPrompt={currentQuestion.questionText}
        partInfo={`Part ${currentQuestion.part}`}
        userContent={transcriptsMap[currentQId] || '(Chưa có transcript, hãy nói vào micro hoặc gõ vào ô)'}
        sampleContent={currentQuestion.sampleAnswer}
      />
    </div>
  );
};
