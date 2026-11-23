import { useState, useEffect, useCallback, useRef } from 'react';
import type { Exam, Part, ScoreReport, UserAnswerRecord } from './types/exam';
import { getAllExams, saveExam, isListeningExam } from './utils/storage';
import { gradeExam } from './utils/scoring';
import { ExamHeader } from './components/exam/ExamHeader';
import { PartTabs } from './components/exam/PartTabs';
import { PassageViewer } from './components/exam/PassageViewer';
import { ListeningAudioBar } from './components/exam/ListeningAudioBar';
import { QuestionGroupRenderer } from './components/exam/QuestionGroupRenderer';
import { SplitPane } from './components/exam/SplitPane';
import { BottomBar } from './components/exam/BottomBar';
import { SubmitConfirmModal } from './components/exam/SubmitConfirmModal';
import { LeaveExamModal } from './components/exam/LeaveExamModal';
import { ResultModal } from './components/exam/ResultModal';
import { TestManager } from './components/admin/TestManager';
import { TestEditor } from './components/admin/TestEditor';
import { SmartImportModal } from './components/admin/SmartImportModal';
import { HomePage } from './components/home/HomePage';
import type { WritingExam } from './types/writing';
import type { SpeakingExam } from './types/speaking';
import { getAllWritingExams, sampleWritingExams, saveWritingExam } from './data/writingExams';
import { getAllSpeakingExams, sampleSpeakingExams, saveSpeakingExam } from './data/speakingExams';
import { WritingExamRoom } from './components/writing/WritingExamRoom';
import { SpeakingExamRoom } from './components/speaking/SpeakingExamRoom';
import { WritingEditorModal } from './components/admin/WritingEditorModal';
import { SpeakingEditorModal } from './components/admin/SpeakingEditorModal';
import { ChevronLeft, ChevronRight, FileText, Headphones } from 'lucide-react';
import { clearExamProgress, loadExamProgress, saveExamProgress } from './utils/examProgress';
import Navbar from '../../components/navbar';
import { Footer } from '../../components/footer';

type View = 'home' | 'exam' | 'writing' | 'speaking';

function getExamPath(exam: Exam, partNumber: number): string {
  const skill = isListeningExam(exam) ? 'listening' : 'reading';
  return `/ielts/${skill}/${encodeURIComponent(exam.id)}/part/${partNumber}`;
}

export function App() {
  // Navigation View: 'home' | 'exam' | 'writing' | 'speaking'
  const [currentView, setCurrentView] = useState<View>('home');

  // List of all exams
  const [allExams, setAllExams] = useState<Exam[]>(() => getAllExams());

  // Current Active Exam in Test Mode
  const [currentExam, setCurrentExam] = useState<Exam>(() => (allExams[0] ?? getAllExams()[0])!);

  // Current Writing & Speaking Exams
  const [currentWritingExam, setCurrentWritingExam] = useState<WritingExam>(() => sampleWritingExams[0]!);
  const [currentSpeakingExam, setCurrentSpeakingExam] = useState<SpeakingExam>(() => sampleSpeakingExams[0]!);

  // Navigation & Part State
  const [activePartNumber, setActivePartNumber] = useState<number>(1);
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState<number>(1);

  // User responses
  const [answers, setAnswers] = useState<UserAnswerRecord>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<number[]>([]);

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState<number>(
    () => (currentExam.durationMinutes || 60) * 60
  );
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Result & Review State
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isReviewMode, setIsReviewMode] = useState<boolean>(false);
  const [scoreReport, setScoreReport] = useState<ScoreReport | null>(null);
  const [showListeningTranscript, setShowListeningTranscript] = useState<boolean>(false);

  // Modals
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState<boolean>(false);
  const [isLeaveExamModalOpen, setIsLeaveExamModalOpen] = useState<boolean>(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState<boolean>(false);
  const [isTestManagerOpen, setIsTestManagerOpen] = useState<boolean>(false);
  const [isSmartImportOpen, setIsSmartImportOpen] = useState<boolean>(false);
  const [smartImportCollection, setSmartImportCollection] = useState<string | undefined>(undefined);
  const [smartImportSkill, setSmartImportSkill] = useState<'reading' | 'listening' | 'writing' | 'speaking' | undefined>(undefined);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  const [isWritingEditorOpen, setIsWritingEditorOpen] = useState(false);
  const [editingWritingExam, setEditingWritingExam] = useState<WritingExam | null>(null);
  const [isSpeakingEditorOpen, setIsSpeakingEditorOpen] = useState(false);
  const [editingSpeakingExam, setEditingSpeakingExam] = useState<SpeakingExam | null>(null);
  const listeningContentRef = useRef<HTMLDivElement>(null);

  // Display Settings with persistent localStorage
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>(() => {
    const saved = localStorage.getItem('ielts_font_size');
    if (saved === 'sm' || saved === 'base' || saved === 'lg') return saved;
    return 'base';
  });

  const handleUpdateFontSize = (newSize: 'sm' | 'base' | 'lg') => {
    setFontSize(newSize);
    try {
      localStorage.setItem('ielts_font_size', newSize);
    } catch {}
  };

  const handleRefreshExams = () => {
    const fresh = getAllExams();
    setAllExams(fresh);
    if (!fresh.some((exam) => exam.id === currentExam.id) && fresh[0]) {
      setCurrentExam(fresh[0]);
    }
  };

  const navigateHome = useCallback((replace = false) => {
    if (currentView === 'exam' && !isCompleted && currentExam?.id) {
      saveExamProgress(currentExam.id, {
        answers,
        flaggedQuestions,
        activePartNumber,
        currentQuestionNumber,
        timeRemaining,
      });
    }
    window.history[replace ? 'replaceState' : 'pushState']({}, '', '/ielts');
    setCurrentView('home');
  }, [activePartNumber, answers, currentExam?.id, currentQuestionNumber, currentView, flaggedQuestions, isCompleted, timeRemaining]);

  const navigateExam = useCallback((exam: Exam, partNumber: number, replace = false) => {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', getExamPath(exam, partNumber));
    setCurrentView('exam');
  }, []);

  const navigateSkill = useCallback((skill: 'writing' | 'speaking', examId: string, replace = false) => {
    window.history[replace ? 'replaceState' : 'pushState'](
      {},
      '',
      `/ielts/${skill}/${encodeURIComponent(examId)}`
    );
    setCurrentView(skill);
  }, []);

  useEffect(() => {
    const applyRoute = () => {
      const routePath = window.location.pathname.replace(/^\/ielts\/?/, '/');
      const parts = routePath.split('/').filter(Boolean);
      const skill = parts[0];
      const examId = parts[1] ? decodeURIComponent(parts[1]) : '';

      if ((skill === 'reading' || skill === 'listening') && examId) {
        const exam = allExams.find((candidate) => candidate.id === examId);
        if (exam && (skill === 'listening') === isListeningExam(exam)) {
          const requestedPart = Number(parts[3]);
          const partNumber = exam.parts.some((part) => part.partNumber === requestedPart) ? requestedPart : exam.parts[0]?.partNumber ?? 1;
          const savedProgress = loadExamProgress(exam.id);
          setCurrentExam(exam);
          setAnswers(savedProgress?.answers ?? {});
          setFlaggedQuestions(savedProgress?.flaggedQuestions ?? []);
          setTimeRemaining(savedProgress?.timeRemaining ?? (exam.durationMinutes || 60) * 60);
          setIsPaused(false);
          setIsCompleted(false);
          setIsReviewMode(false);
          setScoreReport(null);
          setActivePartNumber(partNumber);
          setCurrentQuestionNumber(savedProgress?.currentQuestionNumber ?? exam.parts.find((part) => part.partNumber === partNumber)?.questionGroups.flatMap((group) => group.questions)[0]?.orderNumber ?? 1);
          setCurrentView('exam');
          return;
        }
      }

      if (skill === 'writing' && examId) {
        const allWriting = getAllWritingExams();
        const exam = allWriting.find((candidate) => candidate.id === examId) || sampleWritingExams.find((candidate) => candidate.id === examId);
        if (exam) {
          setCurrentWritingExam(exam);
          setCurrentView('writing');
          return;
        }
      }

      if (skill === 'speaking' && examId) {
        const allSpeaking = getAllSpeakingExams();
        const exam = allSpeaking.find((candidate) => candidate.id === examId) || sampleSpeakingExams.find((candidate) => candidate.id === examId);
        if (exam) {
          setCurrentSpeakingExam(exam);
          setCurrentView('speaking');
          return;
        }
      }

      setCurrentView('home');
    };

    applyRoute();
    window.addEventListener('popstate', applyRoute);
    return () => window.removeEventListener('popstate', applyRoute);
  }, [allExams]);

  useEffect(() => {
    if (currentView !== 'exam') return;
    const timer = window.setTimeout(() => {
      saveExamProgress(currentExam.id, {
        answers,
        flaggedQuestions,
        activePartNumber,
        currentQuestionNumber,
        timeRemaining,
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [activePartNumber, answers, currentExam.id, currentQuestionNumber, currentView, flaggedQuestions, timeRemaining]);

  // Guaranteed synchronous save on window/tab close or refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentView === 'exam' && !isCompleted && currentExam?.id) {
        saveExamProgress(currentExam.id, {
          answers,
          flaggedQuestions,
          activePartNumber,
          currentQuestionNumber,
          timeRemaining,
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activePartNumber, answers, currentExam?.id, currentQuestionNumber, currentView, flaggedQuestions, isCompleted, timeRemaining]);

  const completeExam = useCallback(() => {
    const report = gradeExam(currentExam, answers);
    setScoreReport(report);
    setIsCompleted(true);
    setIsResultModalOpen(true);
    clearExamProgress(currentExam.id);
  }, [answers, currentExam]);

  // Timer interval
  useEffect(() => {
    if (currentView !== 'exam' || isCompleted || isPaused || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [currentView, isCompleted, isPaused, timeRemaining]);

  useEffect(() => {
    if (currentView === 'exam' && !isCompleted && timeRemaining === 0) {
      completeExam();
    }
  }, [completeExam, currentView, isCompleted, timeRemaining]);

  // Find active Part object
  const activePart: Part =
    (currentExam.parts.find((p) => p.partNumber === activePartNumber) || currentExam.parts[0])!;

  // All questions in the exam flattened
  const allQuestions = currentExam.parts.flatMap((p) =>
    p.questionGroups.flatMap((g) => g.questions)
  );

  // Update answer
  const handleAnswerChange = (orderNumber: number, answer: string | string[]) => {
    if (isReviewMode) return;
    setAnswers((prev) => ({
      ...prev,
      [orderNumber]: answer,
    }));
  };

  // Toggle flag
  const handleToggleFlag = (orderNumber: number) => {
    setFlaggedQuestions((prev) =>
      prev.includes(orderNumber) ? prev.filter((n) => n !== orderNumber) : [...prev, orderNumber]
    );
  };

  // Select exactly one part. Listening content is intentionally not a continuous page.
  const handleSelectPart = (partNumber: number) => {
    setActivePartNumber(partNumber);
    navigateExam(currentExam, partNumber);
    listeningContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Select question and scroll to it
  const handleSelectQuestion = (questionNumber: number) => {
    setCurrentQuestionNumber(questionNumber);

    // If question belongs to another part, switch to that part
    const targetPart = currentExam.parts.find((p) =>
      p.questionGroups.some((g) => g.questions.some((q) => q.orderNumber === questionNumber))
    );

    if (targetPart && targetPart.partNumber !== activePartNumber) {
      setActivePartNumber(targetPart.partNumber);
      navigateExam(currentExam, targetPart.partNumber);
    }

    // Smooth scroll to card
    setTimeout(() => {
      const card = document.getElementById(`q-card-${questionNumber}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  // Next / Prev Question
  const handleNextQuestion = () => {
    const currentIndex = allQuestions.findIndex((q) => q.orderNumber === currentQuestionNumber);
    if (currentIndex >= 0 && currentIndex < allQuestions.length - 1) {
      handleSelectQuestion(allQuestions[currentIndex + 1]!.orderNumber);
    }
  };

  const handlePrevQuestion = () => {
    const currentIndex = allQuestions.findIndex((q) => q.orderNumber === currentQuestionNumber);
    if (currentIndex > 0) {
      handleSelectQuestion(allQuestions[currentIndex - 1]!.orderNumber);
    }
  };

  // Submit test
  const handleConfirmSubmit = () => {
    setIsSubmitConfirmOpen(false);
    completeExam();
  };

  // Retake exam
  const handleRetakeExam = () => {
    clearExamProgress(currentExam.id);
    setAnswers({});
    setFlaggedQuestions([]);
    setTimeRemaining((currentExam.durationMinutes || 60) * 60);
    setIsPaused(false);
    setIsCompleted(false);
    setIsReviewMode(false);
    setScoreReport(null);
    setIsResultModalOpen(false);
    setActivePartNumber(1);
    setCurrentQuestionNumber(1);
  };

  // Start taking an exam from Home or Manager
  const handleStartExam = (exam: Exam) => {
    const savedProgress = loadExamProgress(exam.id);
    setCurrentExam(exam);
    setAnswers(savedProgress?.answers ?? {});
    setFlaggedQuestions(savedProgress?.flaggedQuestions ?? []);
    setTimeRemaining(savedProgress?.timeRemaining ?? (exam.durationMinutes || 60) * 60);
    setIsPaused(false);
    setIsCompleted(false);
    setIsReviewMode(false);
    setScoreReport(null);
    const savedPart = savedProgress?.activePartNumber;
    const partNumber = exam.parts.some((part) => part.partNumber === savedPart) ? savedPart! : exam.parts[0]?.partNumber ?? 1;
    setActivePartNumber(partNumber);
    setCurrentQuestionNumber(savedProgress?.currentQuestionNumber ?? exam.parts[0]?.questionGroups.flatMap((group) => group.questions)[0]?.orderNumber ?? 1);
    navigateExam(exam, partNumber);
  };

  // Save exam from editor
  const handleSaveExamFromEditor = (savedExam: Exam) => {
    saveExam(savedExam);
    setIsEditorOpen(false);
    setEditingExam(null);
    handleRefreshExams();
    if (savedExam.id === currentExam.id) {
      setCurrentExam(savedExam);
    }
  };

  const handleStartWritingExam = (exam: WritingExam) => {
    setCurrentWritingExam(exam);
    navigateSkill('writing', exam.id);
  };

  const handleStartSpeakingExam = (exam: SpeakingExam) => {
    setCurrentSpeakingExam(exam);
    navigateSkill('speaking', exam.id);
  };

  // Stats
  const answeredCount = Object.values(answers).filter(
    (a) => a !== undefined && a !== '' && (!Array.isArray(a) || a.length > 0)
  ).length;

  return (
    <div
      className={
        currentView === 'home'
          ? 'min-h-screen w-full flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans'
          : 'h-[100dvh] w-full overflow-hidden bg-white text-gray-900 font-sans'
      }
    >
      {/* 1. HOMEPAGE VIEW (Unified with PNO Navbar & Footer) */}
      {currentView === 'home' && (
        <>
          <Navbar />
          <HomePage
            exams={allExams}
            onSelectExam={handleStartExam}
            onOpenEditor={(examToEdit) => {
              setEditingExam(examToEdit || null);
              setIsEditorOpen(true);
            }}
            onOpenTestManager={() => setIsTestManagerOpen(true)}
            onOpenSmartImport={(collection, skill) => {
              setSmartImportCollection(collection);
              setSmartImportSkill(skill);
              setIsSmartImportOpen(true);
            }}
            onRefreshExams={handleRefreshExams}
            onStartWritingExam={handleStartWritingExam}
            onStartSpeakingExam={handleStartSpeakingExam}
          />
          <Footer />
        </>
      )}

      {/* 2. WRITING EXAM ROOM VIEW */}
      {currentView === 'writing' && (
        <WritingExamRoom
          key={currentWritingExam.id}
          exam={currentWritingExam}
          onBackToHome={navigateHome}
        />
      )}

      {/* 3. SPEAKING EXAM ROOM VIEW */}
      {currentView === 'speaking' && (
        <SpeakingExamRoom
          key={currentSpeakingExam.id}
          exam={currentSpeakingExam}
          onBackToHome={navigateHome}
        />
      )}

      {/* 4. EXAM VIEW (Standard Computer-Based IELTS Reading & Listening UI) */}
      {currentView === 'exam' && (
        <div className="flex flex-col h-full w-full overflow-hidden">
          {/* Top Header */}
          <ExamHeader
            examTitle={currentExam.title}
            durationMinutes={currentExam.durationMinutes}
            timeRemaining={timeRemaining}
            isPaused={isPaused}
            onTogglePause={() => setIsPaused((prev) => !prev)}
            onOpenTestManager={() => setIsTestManagerOpen(true)}
            onBackToHome={navigateHome}
            onOpenLeaveModal={() => setIsLeaveExamModalOpen(true)}
            fontSize={fontSize}
            onChangeFontSize={handleUpdateFontSize}
          />

          {/* Sticky Review Mode Banner */}
          {isReviewMode && scoreReport && (
            <div className="bg-amber-500 text-white px-6 py-2 flex flex-wrap items-center justify-between gap-3 shadow-md z-20 border-b border-amber-600 animate-in fade-in select-none">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-black text-xs tracking-wider bg-amber-700/70 px-2 py-0.5 rounded uppercase">
                  Review Mode
                </span>
                <span className="text-xs font-bold text-white">
                  IELTS Band: {scoreReport.bandScore.toFixed(1)}
                </span>
                <span className="text-xs text-amber-100 font-medium">
                  ({scoreReport.totalCorrect}/{scoreReport.totalQuestions} Correct • {Math.round((scoreReport.totalCorrect / scoreReport.totalQuestions) * 100)}% Accuracy)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Jump to Next Incorrect Question */}
                {scoreReport.details.some((d) => !d.isCorrect) && (
                  <button
                    onClick={() => {
                      const incorrect = scoreReport.details.filter((d) => !d.isCorrect);
                      const currentIdx = incorrect.findIndex((d) => d.questionNumber === currentQuestionNumber);
                      const nextInc = incorrect[(currentIdx + 1) % incorrect.length];
                      if (nextInc) handleSelectQuestion(nextInc.questionNumber);
                    }}
                    className="px-2.5 py-1 text-xs font-bold bg-white text-amber-900 hover:bg-amber-50 rounded shadow-xs transition"
                  >
                    Next Incorrect →
                  </button>
                )}

                <button
                  onClick={() => setIsResultModalOpen(true)}
                  className="px-2.5 py-1 text-xs font-semibold bg-amber-700/70 hover:bg-amber-700 text-white rounded transition"
                >
                  Score Report
                </button>

                <button
                  onClick={() => {
                    setIsReviewMode(false);
                    navigateHome();
                  }}
                  className="px-2.5 py-1 text-xs font-semibold bg-black/30 hover:bg-black/40 text-white rounded transition"
                >
                  Exit Review
                </button>
              </div>
            </div>
          )}

          {/* Part Navigation Tabs */}
          <PartTabs
            parts={currentExam.parts}
            activePartNumber={activePartNumber}
            onSelectPart={handleSelectPart}
            answers={answers}
          />

          {/* Main Area: Full-width for Listening, SplitPane for Reading */}
          {isListeningExam(currentExam) ? (
            <div ref={listeningContentRef} className="flex-1 overflow-y-auto bg-[#f8f9fa] relative select-none">
              <div className="max-w-4xl mx-auto min-h-full bg-white px-6 md:px-12 py-8 shadow-xs border-x border-gray-200 pb-24">
                <div key={activePart.id} className="pt-2">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">
                      Part {activePart.partNumber}
                    </h2>

                    {isReviewMode && activePart.passage && (
                      <button
                        onClick={() => setShowListeningTranscript((prev) => !prev)}
                        className="px-3 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{showListeningTranscript ? 'Hide Audio Transcript' : 'View Audio Transcript / Script'}</span>
                      </button>
                    )}
                  </div>

                  {/* Audio Transcript / Script Viewer for Listening Review Mode */}
                  {isReviewMode && showListeningTranscript && activePart.passage && (
                    <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2 text-slate-800 leading-relaxed max-h-80 overflow-y-auto font-sans shadow-inner">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5 border-b pb-1.5">
                        <Headphones className="w-3.5 h-3.5 text-blue-600" />
                        <span>Audio Recording Transcript — Part {activePart.partNumber}</span>
                      </div>
                      <div className="whitespace-pre-line text-slate-700 font-normal">
                        {activePart.passage}
                      </div>
                    </div>
                  )}

                  {activePart.questionGroups.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">No questions for this section yet.</div>
                  ) : (
                    activePart.questionGroups.map((group) => (
                      <QuestionGroupRenderer
                        key={group.id}
                        group={group}
                        answers={answers}
                        onAnswerChange={handleAnswerChange}
                        flaggedQuestions={flaggedQuestions}
                        onToggleFlag={handleToggleFlag}
                        isReviewMode={isReviewMode}
                        scoreReport={scoreReport}
                        fontSize={fontSize}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Corner Navigation Buttons */}
              <div className="fixed bottom-24 right-6 z-30 flex items-center gap-0.5">
                <button
                  onClick={handlePrevQuestion}
                  className="w-7 h-7 bg-[#6a6e78] hover:bg-[#52565f] text-white flex items-center justify-center font-bold transition shadow-xs"
                  title="Previous question"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextQuestion}
                  className="w-7 h-7 bg-[#23252a] hover:bg-[#111] text-white flex items-center justify-center font-bold transition shadow-xs"
                  title="Next question"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden relative">
              <SplitPane
                defaultLeftPercent={50}
                left={
                  <PassageViewer
                    key={activePart.id}
                    title={activePart.title}
                    subtitle={activePart.subtitle}
                    passage={activePart.passage}
                    footnotes={activePart.footnotes}
                    fontSize={fontSize}
                  />
                }
                right={
                  <div className="relative w-full min-h-full pb-20">
                    {activePart.questionGroups.length === 0 ? (
                      <div className="text-center py-16 text-gray-400 text-sm">
                        No questions for this part yet. Click "+ Add Test" to import questions.
                      </div>
                    ) : (
                      activePart.questionGroups.map((group) => (
                        <QuestionGroupRenderer
                          key={group.id}
                          group={group}
                          answers={answers}
                          onAnswerChange={handleAnswerChange}
                          flaggedQuestions={flaggedQuestions}
                          onToggleFlag={handleToggleFlag}
                          isReviewMode={isReviewMode}
                          scoreReport={scoreReport}
                          fontSize={fontSize}
                        />
                      ))
                    )}

                    {/* Corner Navigation Buttons matching official IELTS on Computer */}
                    <div className="fixed bottom-13 right-4 z-30 flex items-center gap-0.5">
                      <button
                        onClick={handlePrevQuestion}
                        className="w-7 h-7 bg-[#6a6e78] hover:bg-[#52565f] text-white flex items-center justify-center font-bold transition shadow-xs"
                        title="Previous question"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleNextQuestion}
                        className="w-7 h-7 bg-[#23252a] hover:bg-[#111] text-white flex items-center justify-center font-bold transition shadow-xs"
                        title="Next question"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                }
              />
            </div>
          )}

          {/* Sleek Horizontal Audio Player Bar for Listening pinned above BottomBar */}
          {isListeningExam(currentExam) && (
            <ListeningAudioBar
              audioUrl={activePart.audioUrl || currentExam.parts[0]?.audioUrl}
              sectionTitle={`Section ${activePart.partNumber}`}
              partNumber={activePart.partNumber}
              testId={currentExam.id}
              onAudioChange={(newUrl) => {
                const updatedParts = currentExam.parts.map((p) =>
                  p.id === activePart.id || !p.audioUrl ? { ...p, audioUrl: newUrl } : p
                );
                const updatedExam = { ...currentExam, parts: updatedParts };
                setCurrentExam(updatedExam);
                saveExam(updatedExam);
              }}
            />
          )}

          {/* Bottom Bar with 1-40 Question Navigation */}
          <BottomBar
            parts={currentExam.parts}
            activePartNumber={activePartNumber}
            onSelectPart={handleSelectPart}
            answers={answers}
            flaggedQuestions={flaggedQuestions}
            currentQuestionNumber={currentQuestionNumber}
            onSelectQuestion={handleSelectQuestion}
            onNextQuestion={handleNextQuestion}
            onPrevQuestion={handlePrevQuestion}
            onSubmit={() => {
              if (isReviewMode && scoreReport) {
                setIsResultModalOpen(true);
              } else {
                setIsSubmitConfirmOpen(true);
              }
            }}
            isReviewMode={isReviewMode}
            scoreReportDetails={scoreReport?.details}
          />
        </div>
      )}

      {/* Submit Confirmation Modal */}
      <SubmitConfirmModal
        isOpen={isSubmitConfirmOpen}
        onClose={() => setIsSubmitConfirmOpen(false)}
        onConfirmSubmit={handleConfirmSubmit}
        totalQuestions={allQuestions.length}
        answeredCount={answeredCount}
        flaggedCount={flaggedQuestions.length}
      />

      {/* Leave Exam & Autosave Modal */}
      <LeaveExamModal
        isOpen={isLeaveExamModalOpen}
        onClose={() => setIsLeaveExamModalOpen(false)}
        onSaveAndExit={() => {
          saveExamProgress(currentExam.id, {
            answers,
            flaggedQuestions,
            activePartNumber,
            currentQuestionNumber,
            timeRemaining,
          });
          setIsLeaveExamModalOpen(false);
          navigateHome();
        }}
        onDiscardAndExit={() => {
          clearExamProgress(currentExam.id);
          setIsLeaveExamModalOpen(false);
          navigateHome();
        }}
        examTitle={currentExam.title}
        totalQuestions={allQuestions.length}
        answeredCount={answeredCount}
        timeRemaining={timeRemaining}
      />

      {/* Result & Score Modal */}
      {scoreReport && (
        <ResultModal
          isOpen={isResultModalOpen}
          onClose={() => setIsResultModalOpen(false)}
          exam={currentExam}
          scoreReport={scoreReport}
          timeSpentSeconds={Math.max(
            0,
            (currentExam.durationMinutes || 60) * 60 - timeRemaining
          )}
          onEnterReviewMode={(targetQuestionNumber) => {
            setIsReviewMode(true);
            setIsResultModalOpen(false);
            if (targetQuestionNumber) {
              handleSelectQuestion(targetQuestionNumber);
            }
          }}
          onRetakeExam={handleRetakeExam}
          onOpenTestManager={() => {
            setIsResultModalOpen(false);
            navigateHome();
            setIsTestManagerOpen(true);
          }}
        />
      )}

      {/* Smart Import & Creation Modal */}
      <SmartImportModal
        isOpen={isSmartImportOpen}
        initialCollection={smartImportCollection}
        defaultSkill={smartImportSkill}
        onClose={() => {
          setIsSmartImportOpen(false);
          setSmartImportCollection(undefined);
          setSmartImportSkill(undefined);
        }}
        onImportSuccess={(savedExam: Exam, action: 'save_only' | 'take_test' | 'edit') => {
          setIsSmartImportOpen(false);
          setSmartImportCollection(undefined);
          setSmartImportSkill(undefined);
          handleRefreshExams();
          if (action === 'take_test') {
            handleStartExam(savedExam);
          } else if (action === 'edit') {
            setEditingExam(savedExam);
            setIsEditorOpen(true);
          }
        }}
        onWritingImportSuccess={() => {
          setIsSmartImportOpen(false);
          setSmartImportCollection(undefined);
          setSmartImportSkill(undefined);
          handleRefreshExams();
        }}
        onSpeakingImportSuccess={() => {
          setIsSmartImportOpen(false);
          setSmartImportCollection(undefined);
          setSmartImportSkill(undefined);
          handleRefreshExams();
        }}
        onOpenManualEditor={() => {
          setIsSmartImportOpen(false);
          setSmartImportCollection(undefined);
          setSmartImportSkill(undefined);
          setEditingExam(null);
          setIsEditorOpen(true);
        }}
        onOpenWritingEditor={(exam) => {
          setIsSmartImportOpen(false);
          setSmartImportCollection(undefined);
          setSmartImportSkill(undefined);
          setEditingWritingExam(exam || null);
          setIsWritingEditorOpen(true);
        }}
        onOpenSpeakingEditor={(exam) => {
          setIsSmartImportOpen(false);
          setSmartImportCollection(undefined);
          setSmartImportSkill(undefined);
          setEditingSpeakingExam(exam || null);
          setIsSpeakingEditorOpen(true);
        }}
      />

      {/* Test Manager & Library Modal */}
      <TestManager
        isOpen={isTestManagerOpen}
        onClose={() => setIsTestManagerOpen(false)}
        onSelectExam={(exam) => {
          handleStartExam(exam);
          setIsTestManagerOpen(false);
        }}
        onOpenEditor={(examToEdit) => {
          setEditingExam(examToEdit || null);
          setIsEditorOpen(true);
        }}
        onOpenSmartImport={() => {
          setIsTestManagerOpen(false);
          setIsSmartImportOpen(true);
        }}
      />

      {/* Test Editor Modal */}
      {isEditorOpen && (
        <TestEditor
          key={editingExam?.id || 'new-exam'}
          initialExam={editingExam}
          onSave={handleSaveExamFromEditor}
          onCancel={() => {
            setIsEditorOpen(false);
            setEditingExam(null);
          }}
        />
      )}

      {/* Writing Editor Modal */}
      {isWritingEditorOpen && (
        <WritingEditorModal
          key={editingWritingExam?.id || 'new-writing'}
          isOpen={isWritingEditorOpen}
          initialExam={editingWritingExam}
          onClose={() => {
            setIsWritingEditorOpen(false);
            setEditingWritingExam(null);
          }}
          onSave={(saved) => {
            saveWritingExam(saved);
            setIsWritingEditorOpen(false);
            setEditingWritingExam(null);
            handleRefreshExams();
          }}
        />
      )}

      {/* Speaking Editor Modal */}
      {isSpeakingEditorOpen && (
        <SpeakingEditorModal
          key={editingSpeakingExam?.id || 'new-speaking'}
          isOpen={isSpeakingEditorOpen}
          initialExam={editingSpeakingExam}
          onClose={() => {
            setIsSpeakingEditorOpen(false);
            setEditingSpeakingExam(null);
          }}
          onSave={(saved) => {
            saveSpeakingExam(saved);
            setIsSpeakingEditorOpen(false);
            setEditingSpeakingExam(null);
            handleRefreshExams();
          }}
        />
      )}
    </div>
  );
}

export default App;
