import { useState, useEffect, useRef, type FC } from 'react';
import { useColorMode, useToast } from '@chakra-ui/react';
import type { SpeakingExam, SpeakingQuestion } from '../../types/speaking';
import { AiCoachPromptModal } from '../common/AiCoachPromptModal';
import { MediaEmbed } from '../exam/MediaEmbed';
import {
  loadSpeakingProgress,
  saveSpeakingProgress,
  clearSpeakingProgress,
} from '../../utils/writingProgress';
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
  Sun,
  Moon,
  CheckCircle2,
} from 'lucide-react';

interface SpeakingExamRoomProps {
  exam: SpeakingExam;
  onBackToHome: () => void;
  onProgressSync?: (examId: string, state: Record<string, unknown>) => void;
}

export const SpeakingExamRoom: FC<SpeakingExamRoomProps> = ({
  exam,
  onBackToHome,
  onProgressSync,
}) => {
  const savedSpeaking = loadSpeakingProgress(exam.id);
  const [activePart, setActivePart] = useState<1 | 2 | 3>(savedSpeaking?.activePart ?? 1);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(
    savedSpeaking?.selectedQuestionIndex ?? 0
  );
  const [showAiCoachModal, setShowAiCoachModal] = useState(false);
  const [mobilePane, setMobilePane] = useState<'question' | 'recorder'>('question');
  const { colorMode, toggleColorMode } = useColorMode();
  const toast = useToast();

  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrlMap, setAudioUrlMap] = useState<Record<string, string>>({});
  const [transcriptsMap, setTranscriptsMap] = useState<Record<string, string>>(
    savedSpeaking?.transcriptsMap ?? {}
  );

  // Part 2 prep timer state
  const defaultPrepSeconds = exam.part2Question?.prepTimeSeconds || 60;
  const [isPrepRunning, setIsPrepRunning] = useState(false);
  const [prepSecondsLeft, setPrepSecondsLeft] = useState(defaultPrepSeconds);
  const [prepNotes, setPrepNotes] = useState(savedSpeaking?.prepNotes ?? '');

  // Auto-save Speaking progress immediately on mount and debounced cloud sync
  useEffect(() => {
    const payload = {
      activePart,
      selectedQuestionIndex,
      prepNotes,
      transcriptsMap,
      lastSavedAt: Date.now(),
    };
    saveSpeakingProgress(exam.id, payload);
    const timer = setTimeout(() => {
      onProgressSync?.(exam.id, payload);
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id, activePart, selectedQuestionIndex, prepNotes, transcriptsMap]);

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
      toast({
        title: 'Microphone access required',
        description: err.message || 'Please grant microphone access in your browser settings.',
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'bottom-right',
      });
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
      <header className="min-h-14 py-2 sm:py-0 sm:h-14 border-b-2 border-slate-200 bg-white px-3 sm:px-5 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => {
              if (isRecording) stopRecording();
              saveSpeakingProgress(exam.id, {
                activePart,
                selectedQuestionIndex,
                prepNotes,
                transcriptsMap,
                lastSavedAt: Date.now(),
              });
              onBackToHome();
            }}
            className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition font-semibold shrink-0"
            title="Return to Home (Progress is auto-saved)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Home</span>
          </button>

          {/* PNO Badge */}
          <div className="hidden xs:flex sm:flex px-2.5 h-7 rounded-xl bg-blue-600 items-center justify-center text-white text-[11px] font-extrabold tracking-wider shrink-0 shadow-2xs">
            PNO
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[160px] sm:max-w-none">{exam.title}</span>
            <span
              className="hidden md:inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0"
              title="Your speaking transcripts and notes are auto-saved"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Auto-saved</span>
            </span>
          </div>
        </div>

        {/* Actions & Part Switcher */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            onClick={() => setShowAiCoachModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition"
            title="Generate personalized AI coaching prompt"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="hidden sm:inline">AI Coach Prompt</span>
            <span className="sm:hidden">AI</span>
          </button>

          <button
            onClick={toggleColorMode}
            className="p-1.5 rounded-xl text-slate-600 hover:bg-slate-100 transition"
            title={colorMode === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
          >
            {colorMode === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Part Switcher (Segmented Control) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border-2 border-slate-200">
            <button
              onClick={() => handleSelectPart(1)}
              className={`px-2.5 sm:px-3 py-1 text-xs font-bold rounded-lg transition ${
                activePart === 1
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Part 1
            </button>
            <button
              onClick={() => handleSelectPart(2)}
              className={`px-2.5 sm:px-3 py-1 text-xs font-bold rounded-lg transition ${
                activePart === 2
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Part 2
            </button>
            <button
              onClick={() => handleSelectPart(3)}
              className={`px-2.5 sm:px-3 py-1 text-xs font-bold rounded-lg transition ${
                activePart === 3
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Part 3
            </button>
          </div>

          <button
            onClick={() => {
              if (isRecording) stopRecording();
              clearSpeakingProgress(exam.id);
              onBackToHome();
            }}
            className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-2xs transition"
            title="Complete practice session and clear in-progress status"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Finish</span>
          </button>
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
          Questions &amp; Model Answers
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
          <span>Voice Recorder &amp; Transcript</span>
        </button>
      </div>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Questions list & Prompt Details */}
        <div
          className={`${
            mobilePane === 'question' ? 'block w-full' : 'hidden'
          } md:block md:w-1/2 h-full md:border-r-2 border-slate-200 overflow-y-auto p-4 sm:p-6 space-y-5 bg-white`}
        >
          {/* Question selection pills if multiple */}
          {currentQuestions.length > 1 && (
            <div className="flex items-center gap-2 pb-2 border-b-2 border-slate-100 overflow-x-auto">
              <span className="text-xs font-bold text-slate-500 shrink-0">Questions:</span>
              {currentQuestions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => handleSelectQuestion(idx)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border-2 transition shrink-0 ${
                    selectedQuestionIndex === idx
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  Q{idx + 1}
                </button>
              ))}
            </div>
          )}

          {/* Current Question Display */}
          <div className="bg-slate-50/70 border-2 border-slate-200 rounded-2xl p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider">
                Part {currentQuestion.part} • {currentQuestion.topic}
              </span>
              <span className="text-[11px] text-slate-500 flex items-center gap-1 font-semibold">
                <Clock className="w-3 h-3 text-slate-400" />
                {currentQuestion.part === 2 ? '1 min prep • 2 mins speaking' : '30 - 45 secs'}
              </span>
            </div>

            <h3 className="text-base font-extrabold text-slate-900 leading-relaxed">
              &ldquo;{currentQuestion.questionText}&rdquo;
            </h3>

            {/* Cue Card Points for Part 2 */}
            {currentQuestion.cueCardBullets && (
              <div className="p-4 bg-amber-50/60 border-2 border-amber-200/80 rounded-xl space-y-2 mt-3 text-xs text-slate-800">
                <p className="font-bold text-amber-900">You should say:</p>
                <ul className="space-y-1 list-disc list-inside text-slate-700">
                  {currentQuestion.cueCardBullets.map((bullet, i) => (
                    <li key={i}>{bullet}</li>
                  ))}
                </ul>
              </div>
            )}

            {(currentQuestion.imageUrl || currentQuestion.videoUrl) && (
              <MediaEmbed
                imageUrl={currentQuestion.imageUrl}
                videoUrl={currentQuestion.videoUrl}
                alt={currentQuestion.topic || 'Speaking cue card visual'}
                className="mt-3"
              />
            )}
          </div>

          {/* Part 2: 1-Minute Prep Countdown & Scratchpad */}
          {activePart === 2 && (
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900">1-Minute Preparation Timer</h4>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-base font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-xl border-2 border-slate-200">
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
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition shadow-xs ${
                      isPrepRunning
                        ? 'bg-slate-800 hover:bg-slate-900 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isPrepRunning ? 'Pause' : prepSecondsLeft === defaultPrepSeconds ? 'Start' : 'Resume'}
                  </button>
                  <button
                    onClick={() => {
                      setIsPrepRunning(false);
                      setPrepSecondsLeft(defaultPrepSeconds);
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {prepSecondsLeft === 0 && (
                <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-xl text-xs font-bold text-amber-900">
                  ⏰ Preparation time is up! Click &ldquo;Start Recording&rdquo; on the right to begin speaking.
                </div>
              )}

              {/* Prep Notes */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
                  Keyword Notes:
                </label>
                <textarea
                  value={prepNotes}
                  onChange={(e) => setPrepNotes(e.target.value)}
                  placeholder="What, When, Who, Why, Feelings..."
                  rows={3}
                  className="w-full p-3 bg-slate-50/70 border-2 border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-600 outline-none resize-none transition"
                />
              </div>
            </div>
          )}

          {/* Model Answer (Band 8.0+) */}
          <div className="bg-slate-50/70 border-2 border-slate-200 rounded-2xl p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-extrabold text-slate-900">Band 8.0+ Model Answer</h4>
              </div>
              <button
                onClick={() =>
                  setShowSampleMap((prev) => ({ ...prev, [currentQId]: !prev[currentQId] }))
                }
                className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border-2 border-slate-200 text-xs font-bold rounded-xl transition shadow-2xs"
              >
                {showSampleMap[currentQId] ? 'Hide Model Answer' : 'Show Model Answer'}
              </button>
            </div>

            {showSampleMap[currentQId] && (
              <div className="space-y-3 pt-2 animate-in fade-in">
                <div className="p-4 bg-white rounded-xl border-2 border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap shadow-2xs">
                  {currentQuestion.sampleAnswer}
                </div>

                {/* Vocabulary */}
                {currentQuestion.keyVocabulary && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                      <span>Key Vocabulary &amp; Collocations:</span>
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {currentQuestion.keyVocabulary.map((v, i) => (
                        <div
                          key={i}
                          className="p-2.5 bg-white border-2 border-slate-200 rounded-xl text-[11px] shadow-2xs"
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
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center space-y-4 shadow-2xs text-center">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              {isRecording ? 'Recording in Progress...' : 'Voice Recording Studio'}
            </span>

            {/* Pulsing Record Circle */}
            <div className="relative flex items-center justify-center my-1">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                  isRecording
                    ? 'bg-rose-600 text-white shadow-md ring-4 ring-rose-200 animate-pulse'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-2 border-slate-200 shadow-2xs'
                }`}
                title={isRecording ? 'Click to stop recording' : 'Click to start recording'}
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
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Start Recording</span>
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  <span>Stop &amp; Save</span>
                </button>
              )}
            </div>

            {/* Audio Playback if recorded */}
            {audioUrlMap[currentQId] && (
              <div className="w-full pt-4 border-t-2 border-slate-100 space-y-2">
                <span className="text-xs text-slate-600 font-bold flex items-center justify-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-slate-500" />
                  <span>Playback Recording:</span>
                </span>
                <audio controls src={audioUrlMap[currentQId]} className="w-full h-9 rounded-xl" />
              </div>
            )}
          </div>

          {/* Speech-to-Text Transcript Box */}
          <div className="flex-1 flex flex-col bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-3 min-h-[220px] shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-extrabold text-slate-900">Live Speech-to-Text Transcript</h4>
              </div>
              <span className="text-[11px] text-slate-400 font-semibold">Auto-transcribed</span>
            </div>

            <textarea
              value={transcriptsMap[currentQId] || ''}
              onChange={(e) =>
                setTranscriptsMap((prev) => ({ ...prev, [currentQId]: e.target.value }))
              }
              placeholder={
                isRecording
                  ? 'Listening and transcribing your speech in real time...'
                  : 'Your spoken transcript will appear here as you speak into the microphone, or you can type/edit your response directly.'
              }
              className="flex-1 w-full p-3.5 bg-slate-50/70 border-2 border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-600 outline-none resize-none leading-relaxed transition"
            />

            {/* Bottom bar with word count and copy prompt */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-500 font-bold">
                Word count: {(transcriptsMap[currentQId] || '').trim().split(/\s+/).filter(Boolean).length} words
              </span>

              <button
                onClick={() => setShowAiCoachModal(true)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition"
                title="Generate personalized AI coaching prompt"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Copy AI Coach Prompt</span>
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
        userContent={transcriptsMap[currentQId] || '(No transcript recorded yet — speak into the microphone or type your response)'}
        sampleContent={currentQuestion.sampleAnswer}
      />
    </div>
  );
};
