import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Exam, Part, ScoreReport, UserAnswerRecord } from './types/exam';
import { getAllExams, loadFullExam, saveExam, isListeningExam } from './utils/storage';
import { gradeExam } from './utils/scoring';
import { ExamHeader } from './components/exam/ExamHeader';
import { PartTabs } from './components/exam/PartTabs';
import { PassageViewer } from './components/exam/PassageViewer';
import { ListeningAudioBar } from './components/exam/ListeningAudioBar';
import { QuestionGroupRenderer } from './components/exam/QuestionGroupRenderer';
import { SplitPane } from './components/exam/SplitPane';
import { BottomBar } from './components/exam/BottomBar';
import { HomePage } from './components/home/HomePage';
import type { StartExamOptions } from './components/home/TestDetailView';
import type { WritingExam } from './types/writing';
import type { SpeakingExam } from './types/speaking';
import { getAllWritingExams, sampleWritingExams, saveWritingExam } from './data/writingExams';
import { getAllSpeakingExams, sampleSpeakingExams, saveSpeakingExam } from './data/speakingExams';
import { ChevronLeft, ChevronRight, FileText, Headphones } from 'lucide-react';
import { clearExamProgress, loadExamProgress, saveExamProgress } from './utils/examProgress';
import { clearSpeakingProgress, clearWritingProgress } from './utils/writingProgress';
import {
  buildLocalSyncPayload,
  CLOUD_MIGRATION_FLAG,
  getExamSkillLabel,
  hydrateFromCloudBootstrap,
  type CloudAttemptRow,
  type CloudBootstrapPayload,
  type CloudIeltsSkill,
} from './utils/cloudSync';
import { api } from '@pno/trpc';
import { Box, useColorMode, useColorModeValue, useToast } from '@chakra-ui/react';
import Navbar from '../../components/navbar';
import { Footer } from '../../components/footer';
import { menuEventChannel } from '../../events/menu';

const SubmitConfirmModal = dynamic(
  () => import('./components/exam/SubmitConfirmModal').then((m) => m.SubmitConfirmModal),
  { ssr: false }
);
const LeaveExamModal = dynamic(
  () => import('./components/exam/LeaveExamModal').then((m) => m.LeaveExamModal),
  { ssr: false }
);
const ResultModal = dynamic(
  () => import('./components/exam/ResultModal').then((m) => m.ResultModal),
  { ssr: false }
);
const TestManager = dynamic(
  () => import('./components/admin/TestManager').then((m) => m.TestManager),
  { ssr: false }
);
const TestEditor = dynamic(
  () => import('./components/admin/TestEditor').then((m) => m.TestEditor),
  { ssr: false }
);
const SmartImportModal = dynamic(
  () => import('./components/admin/SmartImportModal').then((m) => m.SmartImportModal),
  { ssr: false }
);
const WritingExamRoom = dynamic(
  () => import('./components/writing/WritingExamRoom').then((m) => m.WritingExamRoom),
  { ssr: false }
);
const SpeakingExamRoom = dynamic(
  () => import('./components/speaking/SpeakingExamRoom').then((m) => m.SpeakingExamRoom),
  { ssr: false }
);
const WritingEditorModal = dynamic(
  () => import('./components/admin/WritingEditorModal').then((m) => m.WritingEditorModal),
  { ssr: false }
);
const SpeakingEditorModal = dynamic(
  () => import('./components/admin/SpeakingEditorModal').then((m) => m.SpeakingEditorModal),
  { ssr: false }
);

type View = 'home' | 'exam' | 'writing' | 'speaking';

function getExamPath(exam: Exam, partNumber: number): string {
  const skill = isListeningExam(exam) ? 'listening' : 'reading';
  return `/ielts/${skill}/${encodeURIComponent(exam.id)}/part/${partNumber}`;
}

function sliceExamParts(exam: Exam, selectedParts?: number[]): Exam {
  if (!selectedParts || selectedParts.length === 0) return exam;
  const filtered = exam.parts.filter((p) => selectedParts.includes(p.partNumber));
  if (filtered.length === 0) return exam;
  return { ...exam, parts: filtered };
}

function normalizeAnswersRecord(raw?: Record<string, string | string[]>): UserAnswerRecord {
  if (!raw) return {};
  const result: UserAnswerRecord = {};
  for (const [k, v] of Object.entries(raw)) {
    const num = Number(k);
    if (!Number.isNaN(num)) {
      result[num] = v;
    }
  }
  return result;
}

export function App() {
  const { colorMode } = useColorMode();
  const toast = useToast();

  // Navigation View: 'home' | 'exam' | 'writing' | 'speaking'
  const [currentView, setCurrentView] = useState<View>('home');

  // List of all exams (lightweight catalog initially)
  const [allExams, setAllExams] = useState<Exam[]>(() => getAllExams());
  const [isLoadingExamData, setIsLoadingExamData] = useState(false);

  // Cloud sync state
  const [recentAttempts, setRecentAttempts] = useState<CloudAttemptRow[]>([]);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'offline'>('synced');
  const cloudHydratedRef = useRef(false);

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

  // Timer & session mode state
  const [sessionMode, setSessionMode] = useState<'full' | 'practice'>('full');
  const [selectedParts, setSelectedParts] = useState<number[] | undefined>(undefined);
  const [isUntimed, setIsUntimed] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState<number>(
    () => (currentExam.durationMinutes || 60) * 60
  );
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

  // tRPC Cloud Sync queries & mutations
  const bootstrapQuery = api.ielts.bootstrap.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const bulkSyncMutation = api.ielts.bulkSyncLocal.useMutation();
  const upsertExamMutation = api.ielts.upsertExam.useMutation();
  const deleteExamMutation = api.ielts.deleteExam.useMutation();
  const upsertCollectionMutation = api.ielts.upsertCollection.useMutation();
  const deleteCollectionMutation = api.ielts.deleteCollection.useMutation();
  const saveProgressMutation = api.ielts.saveProgress.useMutation();
  const clearProgressMutation = api.ielts.clearProgress.useMutation();
  const recordAttemptMutation = api.ielts.recordAttempt.useMutation();
  const deleteAttemptMutation = api.ielts.deleteAttempt.useMutation();

  const handleRefreshExams = useCallback(() => {
    const fresh = getAllExams();
    setAllExams(fresh);
    setCurrentExam((prev) => {
      if (!fresh.some((exam) => exam.id === prev.id) && fresh[0]) {
        return fresh[0];
      }
      return prev;
    });
  }, []);

  // Hydrate IELTS state from cloud once bootstrap resolves
  useEffect(() => {
    if (!bootstrapQuery.data || cloudHydratedRef.current) return;
    cloudHydratedRef.current = true;

    const alreadyMigrated =
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(CLOUD_MIGRATION_FLAG) === '1';

    if (!alreadyMigrated) {
      const localPayload = buildLocalSyncPayload();
      const hasLocalData =
        localPayload.customExams.length > 0 ||
        localPayload.deletedExams.length > 0 ||
        localPayload.collections.length > 0 ||
        localPayload.deletedCollections.length > 0 ||
        localPayload.progressList.length > 0;

      if (hasLocalData) {
        setSyncStatus('saving');
        bulkSyncMutation.mutate(localPayload, {
          onSuccess: (merged) => {
            hydrateFromCloudBootstrap(merged as CloudBootstrapPayload);
            setRecentAttempts((merged.recentAttempts || []) as CloudAttemptRow[]);
            localStorage.setItem(CLOUD_MIGRATION_FLAG, '1');
            handleRefreshExams();
            setSyncStatus('synced');
          },
          onError: () => {
            hydrateFromCloudBootstrap(bootstrapQuery.data as CloudBootstrapPayload);
            setRecentAttempts((bootstrapQuery.data.recentAttempts || []) as CloudAttemptRow[]);
            handleRefreshExams();
            setSyncStatus('offline');
          },
        });
        return;
      }
      localStorage.setItem(CLOUD_MIGRATION_FLAG, '1');
    }

    hydrateFromCloudBootstrap(bootstrapQuery.data as CloudBootstrapPayload);
    setRecentAttempts((bootstrapQuery.data.recentAttempts || []) as CloudAttemptRow[]);
    handleRefreshExams();
    setSyncStatus('synced');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapQuery.data]);

  const cloudSyncExam = useCallback(
    (
      skill: CloudIeltsSkill,
      examId: string,
      title: string,
      collection: string,
      data: Record<string, unknown>
    ) => {
      setSyncStatus('saving');
      upsertExamMutation.mutate(
        { examId, skill, title, collection, data },
        {
          onSuccess: () => setSyncStatus('synced'),
          onError: () => setSyncStatus('offline'),
        }
      );
    },
    [upsertExamMutation]
  );

  const cloudDeleteExam = useCallback(
    (skill: CloudIeltsSkill, examId: string) => {
      setSyncStatus('saving');
      deleteExamMutation.mutate(
        { examId, skill },
        {
          onSuccess: () => setSyncStatus('synced'),
          onError: () => setSyncStatus('offline'),
        }
      );
    },
    [deleteExamMutation]
  );

  const cloudSaveProgress = useCallback(
    (skill: CloudIeltsSkill, examId: string, state: Record<string, unknown>) => {
      saveProgressMutation.mutate(
        { examId, skill, state },
        {
          onError: () => setSyncStatus('offline'),
        }
      );
    },
    [saveProgressMutation]
  );

  const cloudClearProgress = useCallback(
    (skill: CloudIeltsSkill, examId: string) => {
      clearProgressMutation.mutate({ examId, skill });
    },
    [clearProgressMutation]
  );

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

  // Ref holding the latest Reading/Listening exam state so timer ticks don't rebind listeners
  const latestExamStateRef = useRef({
    currentView,
    currentExam,
    answers,
    flaggedQuestions,
    activePartNumber,
    currentQuestionNumber,
    timeRemaining,
    sessionMode,
    selectedParts,
    isUntimed,
    elapsedSeconds,
    sessionDurationSeconds,
    isCompleted,
    isReviewMode,
  });
  latestExamStateRef.current = {
    currentView,
    currentExam,
    answers,
    flaggedQuestions,
    activePartNumber,
    currentQuestionNumber,
    timeRemaining,
    sessionMode,
    selectedParts,
    isUntimed,
    elapsedSeconds,
    sessionDurationSeconds,
    isCompleted,
    isReviewMode,
  };

  const navigateHome = useCallback(
    (replace = false) => {
      const s = latestExamStateRef.current;
      const wasInExamRoom = s.currentView !== 'home';
      if (
        s.currentView === 'exam' &&
        !s.isCompleted &&
        !s.isReviewMode &&
        s.currentExam?.id
      ) {
        const snapshot = {
          answers: s.answers,
          flaggedQuestions: s.flaggedQuestions,
          activePartNumber: s.activePartNumber,
          currentQuestionNumber: s.currentQuestionNumber,
          timeRemaining: s.timeRemaining,
          mode: s.sessionMode,
          selectedParts: s.selectedParts,
          isUntimed: s.isUntimed,
          elapsedSeconds: s.elapsedSeconds,
          sessionDurationSeconds: s.sessionDurationSeconds,
        };
        saveExamProgress(s.currentExam.id, snapshot);
        cloudSaveProgress(getExamSkillLabel(s.currentExam), s.currentExam.id, {
          ...snapshot,
          lastSavedAt: Date.now(),
        });
      }
      window.history[replace ? 'replaceState' : 'pushState']({}, '', '/ielts');
      setCurrentView('home');
      if (wasInExamRoom && !s.isCompleted && !s.isReviewMode) {
        toast({
          title: 'Đã lưu tiến độ làm bài',
          description: 'Bài làm của bạn được lưu nền và có thể xem lại trong tab History.',
          status: 'success',
          duration: 2800,
          isClosable: true,
          position: 'bottom-right',
        });
      }
    },
    [cloudSaveProgress, toast]
  );

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

  // Deep-link URL routing with async loadFullExam (mount + popstate only)
  useEffect(() => {
    let cancelled = false;
    const applyRoute = async () => {
      const routePath = window.location.pathname.replace(/^\/ielts\/?/, '/');
      const parts = routePath.split('/').filter(Boolean);
      const skill = parts[0];
      const examId = parts[1] ? decodeURIComponent(parts[1]) : '';

      if ((skill === 'reading' || skill === 'listening') && examId) {
        const candidate = getAllExams().find((ex) => ex.id === examId);
        if (candidate && (skill === 'listening') === isListeningExam(candidate)) {
          setIsLoadingExamData(true);
          try {
            const fullExam = (await loadFullExam(candidate)) ?? candidate;
            if (cancelled || !fullExam.parts?.length) return;
            const savedProgress = loadExamProgress(fullExam.id);
            const slicedExam = sliceExamParts(fullExam, savedProgress?.selectedParts);
            const requestedPart = Number(parts[3]);
            const partNumber = slicedExam.parts.some((p) => p.partNumber === requestedPart)
              ? requestedPart
              : slicedExam.parts[0]?.partNumber ?? 1;
            const defaultSecs = (fullExam.durationMinutes || 60) * 60;
            setCurrentExam(slicedExam);
            setSessionMode(savedProgress?.mode ?? 'full');
            setSelectedParts(savedProgress?.selectedParts);
            setIsUntimed(Boolean(savedProgress?.isUntimed));
            setElapsedSeconds(savedProgress?.elapsedSeconds ?? 0);
            setSessionDurationSeconds(savedProgress?.sessionDurationSeconds ?? defaultSecs);
            setAnswers(savedProgress?.answers ?? {});
            setFlaggedQuestions(savedProgress?.flaggedQuestions ?? []);
            setTimeRemaining(savedProgress?.timeRemaining ?? defaultSecs);
            setIsPaused(false);
            setIsCompleted(false);
            setIsReviewMode(false);
            setScoreReport(null);
            setActivePartNumber(partNumber);
            setCurrentQuestionNumber(
              savedProgress?.currentQuestionNumber ??
                slicedExam.parts
                  .find((p) => p.partNumber === partNumber)
                  ?.questionGroups.flatMap((g) => g.questions)[0]?.orderNumber ??
                1
            );
            setCurrentView('exam');
          } finally {
            if (!cancelled) setIsLoadingExamData(false);
          }
          return;
        }
      }

      if (skill === 'writing' && examId) {
        const allWriting = getAllWritingExams();
        const exam =
          allWriting.find((c) => c.id === examId) ||
          sampleWritingExams.find((c) => c.id === examId);
        if (exam) {
          setCurrentWritingExam(exam);
          setCurrentView('writing');
          return;
        }
      }

      if (skill === 'speaking' && examId) {
        const allSpeaking = getAllSpeakingExams();
        const exam =
          allSpeaking.find((c) => c.id === examId) ||
          sampleSpeakingExams.find((c) => c.id === examId);
        if (exam) {
          setCurrentSpeakingExam(exam);
          setCurrentView('speaking');
          return;
        }
      }

      setCurrentView('home');
    };

    void applyRoute();
    const onPopState = () => void applyRoute();
    const onIeltsNavigate = (path: string) => {
      window.history.pushState({}, '', path);
      void applyRoute();
    };
    window.addEventListener('popstate', onPopState);
    menuEventChannel.on('ieltsNavigate', onIeltsNavigate);
    return () => {
      cancelled = true;
      window.removeEventListener('popstate', onPopState);
      menuEventChannel.off('ieltsNavigate', onIeltsNavigate);
    };
  }, []);

  // Handle pending IELTS quick actions triggered from CommandMenu on other pages
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('pno_pending_ielts_action');
      if (!pending) return;
      sessionStorage.removeItem('pno_pending_ielts_action');
      if (pending === 'add_test') {
        setIsSmartImportOpen(true);
      } else if (pending === 'test_bank') {
        setIsTestManagerOpen(true);
      } else if (pending === 'new_collection') {
        window.setTimeout(() => {
          menuEventChannel.emit('openIeltsNewCollection');
        }, 100);
      }
    } catch {}
  }, []);

  // Debounced save ONLY when answers, flags, part, or question changes (NOT on 1s timer ticks)
  useEffect(() => {
    if (currentView !== 'exam' || isCompleted || isReviewMode) return;
    const buildSnapshot = () => ({
      answers,
      flaggedQuestions,
      activePartNumber,
      currentQuestionNumber,
      timeRemaining: latestExamStateRef.current.timeRemaining,
      mode: latestExamStateRef.current.sessionMode,
      selectedParts: latestExamStateRef.current.selectedParts,
      isUntimed: latestExamStateRef.current.isUntimed,
      elapsedSeconds: latestExamStateRef.current.elapsedSeconds,
      sessionDurationSeconds: latestExamStateRef.current.sessionDurationSeconds,
    });
    const localTimer = window.setTimeout(() => {
      saveExamProgress(currentExam.id, buildSnapshot());
    }, 400);

    const cloudTimer = window.setTimeout(() => {
      cloudSaveProgress(getExamSkillLabel(currentExam), currentExam.id, {
        ...buildSnapshot(),
        lastSavedAt: Date.now(),
      });
    }, 2000);

    return () => {
      window.clearTimeout(localTimer);
      window.clearTimeout(cloudTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePartNumber, answers, currentExam.id, currentQuestionNumber, currentView, flaggedQuestions, isCompleted, isReviewMode]);

  // Periodic 15s checkpoint for timer remaining
  useEffect(() => {
    if (currentView !== 'exam' || isCompleted || isReviewMode) return;
    const checkpoint = window.setInterval(() => {
      const s = latestExamStateRef.current;
      if (s.currentView !== 'exam' || s.isCompleted || s.isReviewMode || !s.currentExam?.id) return;
      const snapshot = {
        answers: s.answers,
        flaggedQuestions: s.flaggedQuestions,
        activePartNumber: s.activePartNumber,
        currentQuestionNumber: s.currentQuestionNumber,
        timeRemaining: s.timeRemaining,
        mode: s.sessionMode,
        selectedParts: s.selectedParts,
        isUntimed: s.isUntimed,
        elapsedSeconds: s.elapsedSeconds,
        sessionDurationSeconds: s.sessionDurationSeconds,
      };
      saveExamProgress(s.currentExam.id, snapshot);
      cloudSaveProgress(getExamSkillLabel(s.currentExam), s.currentExam.id, {
        ...snapshot,
        lastSavedAt: Date.now(),
      });
    }, 15_000);
    return () => window.clearInterval(checkpoint);
  }, [cloudSaveProgress, currentView, isCompleted, isReviewMode]);

  // Guaranteed synchronous flush on window/tab close or refresh (registered once)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const s = latestExamStateRef.current;
      if (s.currentView === 'exam' && !s.isCompleted && !s.isReviewMode && s.currentExam?.id) {
        saveExamProgress(s.currentExam.id, {
          answers: s.answers,
          flaggedQuestions: s.flaggedQuestions,
          activePartNumber: s.activePartNumber,
          currentQuestionNumber: s.currentQuestionNumber,
          timeRemaining: s.timeRemaining,
          mode: s.sessionMode,
          selectedParts: s.selectedParts,
          isUntimed: s.isUntimed,
          elapsedSeconds: s.elapsedSeconds,
          sessionDurationSeconds: s.sessionDurationSeconds,
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const completeExam = useCallback(() => {
    const s = latestExamStateRef.current;
    const report = gradeExam(s.currentExam, s.answers);
    const timeSpentSeconds = s.isUntimed
      ? s.elapsedSeconds
      : Math.max(0, s.sessionDurationSeconds - s.timeRemaining);
    const attemptDetails = {
      mode: s.sessionMode,
      selectedParts: s.selectedParts,
      answers: Object.fromEntries(
        Object.entries(s.answers).map(([k, v]) => [String(k), v])
      ),
      partScores: Object.fromEntries(
        Object.entries(report.partScores).map(([k, v]) => [String(k), v])
      ),
    };
    const bandToSave = s.sessionMode === 'practice' ? null : report.bandScore;

    setScoreReport(report);
    setIsCompleted(true);
    setIsResultModalOpen(true);
    clearExamProgress(s.currentExam.id);

    recordAttemptMutation.mutate(
      {
        examId: s.currentExam.id,
        examTitle: s.currentExam.title,
        skill: getExamSkillLabel(s.currentExam),
        bandScore: bandToSave,
        totalCorrect: report.totalCorrect,
        totalQuestions: report.totalQuestions,
        timeSpentSeconds,
        details: attemptDetails,
      },
      {
        onSuccess: (created) => {
          setRecentAttempts((prev) => [
            {
              id: created.id,
              examId: created.examId,
              examTitle: created.examTitle,
              skill: created.skill as CloudIeltsSkill,
              bandScore: created.bandScore,
              totalCorrect: created.totalCorrect,
              totalQuestions: created.totalQuestions,
              timeSpentSeconds: created.timeSpentSeconds,
              details: attemptDetails,
              completedAt: created.completedAt,
            },
            ...prev.slice(0, 199),
          ]);
        },
      }
    );
  }, [recordAttemptMutation]);

  // Timer interval — NEVER depends on timeRemaining so it isn't recreated every second!
  useEffect(() => {
    if (currentView !== 'exam' || isCompleted || isPaused) return;

    const timer = window.setInterval(() => {
      if (latestExamStateRef.current.isUntimed) {
        setElapsedSeconds((prev) => prev + 1);
      } else {
        setTimeRemaining((previous) => {
          if (previous <= 1) {
            window.clearInterval(timer);
            return 0;
          }
          return previous - 1;
        });
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [currentView, isCompleted, isPaused]);

  useEffect(() => {
    if (currentView === 'exam' && !isCompleted && !isUntimed && timeRemaining === 0) {
      completeExam();
    }
  }, [completeExam, currentView, isCompleted, isUntimed, timeRemaining]);

  const activePart: Part | undefined =
    currentExam.parts.find((p) => p.partNumber === activePartNumber) || currentExam.parts[0];

  const allQuestions = currentExam.parts.flatMap((p) =>
    p.questionGroups.flatMap((g) => g.questions)
  );

  const handleAnswerChange = (orderNumber: number, answer: string | string[]) => {
    if (isReviewMode) return;
    setAnswers((prev) => ({
      ...prev,
      [orderNumber]: answer,
    }));
  };

  const handleToggleFlag = (orderNumber: number) => {
    setFlaggedQuestions((prev) =>
      prev.includes(orderNumber) ? prev.filter((n) => n !== orderNumber) : [...prev, orderNumber]
    );
  };

  const handleSelectPart = (partNumber: number) => {
    setActivePartNumber(partNumber);
    navigateExam(currentExam, partNumber);
    listeningContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectQuestion = (questionNumber: number) => {
    setCurrentQuestionNumber(questionNumber);

    const targetPart = currentExam.parts.find((p) =>
      p.questionGroups.some((g) => g.questions.some((q) => q.orderNumber === questionNumber))
    );

    if (targetPart && targetPart.partNumber !== activePartNumber) {
      setActivePartNumber(targetPart.partNumber);
      navigateExam(currentExam, targetPart.partNumber);
    }

    setTimeout(() => {
      const card = document.getElementById(`q-card-${questionNumber}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

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

  const handleConfirmSubmit = () => {
    setIsSubmitConfirmOpen(false);
    completeExam();
  };

  const handleRetakeExam = () => {
    clearExamProgress(currentExam.id);
    cloudClearProgress(getExamSkillLabel(currentExam), currentExam.id);
    setAnswers({});
    setFlaggedQuestions([]);
    const resetSecs = isUntimed ? 0 : sessionDurationSeconds || (currentExam.durationMinutes || 60) * 60;
    setElapsedSeconds(0);
    setTimeRemaining(resetSecs);
    setIsPaused(false);
    setIsCompleted(false);
    setIsReviewMode(false);
    setScoreReport(null);
    setIsResultModalOpen(false);
    const firstPart = currentExam.parts[0];
    setActivePartNumber(firstPart?.partNumber ?? 1);
    setCurrentQuestionNumber(
      firstPart?.questionGroups.flatMap((g) => g.questions)[0]?.orderNumber ?? 1
    );
  };

  const handleStartExam = async (examOrSummary: Exam, options?: StartExamOptions) => {
    setIsLoadingExamData(true);
    try {
      const fullExam = (await loadFullExam(examOrSummary)) ?? examOrSummary;
      if (!fullExam.parts?.length) {
        toast({
          title: 'Unable to load test content',
          description: 'No passages or questions found for this test.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      const isFresh = Boolean(options?.fresh);
      if (isFresh) {
        clearExamProgress(fullExam.id);
        cloudClearProgress(getExamSkillLabel(fullExam), fullExam.id);
      }

      const savedProgress = isFresh ? null : loadExamProgress(fullExam.id);
      const nextMode: 'full' | 'practice' =
        options?.mode ?? savedProgress?.mode ?? 'full';
      const nextSelectedParts =
        options?.selectedParts ?? savedProgress?.selectedParts;
      const slicedExam = sliceExamParts(fullExam, nextSelectedParts);

      const defaultSecs = (fullExam.durationMinutes || 60) * 60;
      let nextUntimed = false;
      let nextDurationSecs = defaultSecs;
      let nextTime = defaultSecs;
      let nextElapsed = 0;

      if (options) {
        if (options.mode === 'practice') {
          if (options.timeLimitMinutes && options.timeLimitMinutes > 0) {
            nextUntimed = false;
            nextDurationSecs = options.timeLimitMinutes * 60;
            nextTime = nextDurationSecs;
          } else {
            nextUntimed = true;
            nextDurationSecs = 0;
            nextTime = 0;
          }
        }
      } else if (savedProgress) {
        nextUntimed = Boolean(savedProgress.isUntimed);
        nextDurationSecs = savedProgress.sessionDurationSeconds ?? defaultSecs;
        nextTime = savedProgress.timeRemaining;
        nextElapsed = savedProgress.elapsedSeconds ?? 0;
      }

      const nextAnswers = savedProgress?.answers ?? {};
      const nextFlags = savedProgress?.flaggedQuestions ?? [];
      const savedPart = savedProgress?.activePartNumber;
      const partNumber = slicedExam.parts.some((part) => part.partNumber === savedPart)
        ? savedPart!
        : slicedExam.parts[0]?.partNumber ?? 1;
      const nextQNum =
        savedProgress?.currentQuestionNumber ??
        slicedExam.parts[0]?.questionGroups.flatMap((group) => group.questions)[0]?.orderNumber ??
        1;

      setCurrentExam(slicedExam);
      setSessionMode(nextMode);
      setSelectedParts(nextSelectedParts);
      setIsUntimed(nextUntimed);
      setElapsedSeconds(nextElapsed);
      setSessionDurationSeconds(nextDurationSecs);
      setAnswers(nextAnswers);
      setFlaggedQuestions(nextFlags);
      setTimeRemaining(nextTime);
      setIsPaused(false);
      setIsCompleted(false);
      setIsReviewMode(false);
      setScoreReport(null);
      setActivePartNumber(partNumber);
      setCurrentQuestionNumber(nextQNum);
      const snapshot = {
        answers: nextAnswers,
        flaggedQuestions: nextFlags,
        activePartNumber: partNumber,
        currentQuestionNumber: nextQNum,
        timeRemaining: nextTime,
        mode: nextMode,
        selectedParts: nextSelectedParts,
        isUntimed: nextUntimed,
        elapsedSeconds: nextElapsed,
        sessionDurationSeconds: nextDurationSecs,
      };
      saveExamProgress(fullExam.id, snapshot);
      cloudSaveProgress(getExamSkillLabel(fullExam), fullExam.id, {
        ...snapshot,
        lastSavedAt: Date.now(),
      });
      navigateExam(slicedExam, partNumber);
    } catch (err) {
      toast({
        title: 'Failed to load test',
        description: err instanceof Error ? err.message : 'Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoadingExamData(false);
    }
  };

  const handleViewAttemptDetail = async (attempt: CloudAttemptRow) => {
    const candidate = getAllExams().find((ex) => ex.id === attempt.examId);
    if (!candidate) {
      toast({
        title: 'Không tìm thấy đề thi này',
        status: 'error',
        duration: 2500,
        isClosable: true,
      });
      return;
    }

    setIsLoadingExamData(true);
    try {
      const fullExam = (await loadFullExam(candidate)) ?? candidate;
      const slicedExam = sliceExamParts(fullExam, attempt.details?.selectedParts);
      const restoredAnswers = normalizeAnswersRecord(attempt.details?.answers);
      const report = gradeExam(slicedExam, restoredAnswers);
      const firstPart = slicedExam.parts[0];
      const partNumber = firstPart?.partNumber ?? 1;
      const firstQ = firstPart?.questionGroups.flatMap((g) => g.questions)[0]?.orderNumber ?? 1;

      setCurrentExam(slicedExam);
      setSessionMode(attempt.details?.mode === 'practice' ? 'practice' : 'full');
      setSelectedParts(attempt.details?.selectedParts);
      setIsUntimed(true);
      setElapsedSeconds(attempt.timeSpentSeconds);
      setSessionDurationSeconds(0);
      setAnswers(restoredAnswers);
      setFlaggedQuestions([]);
      setTimeRemaining(0);
      setIsPaused(true);
      setIsCompleted(true);
      setIsReviewMode(true);
      setScoreReport(report);
      setIsResultModalOpen(true);
      setActivePartNumber(partNumber);
      setCurrentQuestionNumber(firstQ);
      navigateExam(slicedExam, partNumber);
    } catch (err) {
      toast({
        title: 'Không thể mở chi tiết lượt làm',
        description: err instanceof Error ? err.message : 'Vui lòng thử lại.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoadingExamData(false);
    }
  };

  const handleOpenExamEditor = async (examToEdit?: Exam | null) => {
    if (!examToEdit) {
      setEditingExam(null);
      setIsEditorOpen(true);
      return;
    }
    setIsLoadingExamData(true);
    try {
      const fullExam = (await loadFullExam(examToEdit)) ?? examToEdit;
      setEditingExam(fullExam);
      setIsEditorOpen(true);
    } catch {
      toast({
        title: 'Unable to load test for editing',
        status: 'error',
        duration: 2500,
        isClosable: true,
      });
    } finally {
      setIsLoadingExamData(false);
    }
  };

  const handleSaveExamFromEditor = (savedExam: Exam) => {
    saveExam(savedExam);
    cloudSyncExam(
      getExamSkillLabel(savedExam),
      savedExam.id,
      savedExam.title,
      savedExam.collection || 'My Tests',
      savedExam as unknown as Record<string, unknown>
    );
    setIsEditorOpen(false);
    setEditingExam(null);
    handleRefreshExams();
    if (savedExam.id === currentExam.id) {
      setCurrentExam(savedExam);
    }
  };

  const handleStartWritingExam = (exam: WritingExam, fresh = false) => {
    if (fresh) {
      clearWritingProgress(exam.id);
      cloudClearProgress('Writing', exam.id);
    }
    setCurrentWritingExam(exam);
    navigateSkill('writing', exam.id);
  };

  const handleStartSpeakingExam = (exam: SpeakingExam, fresh = false) => {
    if (fresh) {
      clearSpeakingProgress(exam.id);
      cloudClearProgress('Speaking', exam.id);
    }
    setCurrentSpeakingExam(exam);
    navigateSkill('speaking', exam.id);
  };

  const ambientBg = useColorModeValue(
    "linear(to-b, blue.50 0%, rgba(224, 237, 255, 0.45) 55%, transparent 100%)",
    "linear(to-b, rgba(75, 131, 255, 0.14) 0%, rgba(75, 131, 255, 0.04) 55%, transparent 100%)",
  );

  const answeredCount = Object.values(answers).filter(
    (a) => a !== undefined && a !== '' && (!Array.isArray(a) || a.length > 0)
  ).length;

  return (
    <div
      data-theme={colorMode}
      className={`ielts-root ${colorMode === 'dark' ? 'dark ielts-dark' : 'ielts-light'} ${
        currentView === 'home'
          ? 'min-h-screen w-full flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans relative'
          : 'h-[100dvh] w-full overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans'
      }`}
    >
      {isLoadingExamData && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 px-6 py-4 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 text-sm font-bold">
            Loading test data...
          </div>
        </div>
      )}

      {/* 1. HOMEPAGE VIEW */}
      {currentView === 'home' && (
        <div className="relative w-full flex flex-col">
          <Box
            pos="absolute"
            top={0}
            left={0}
            right={0}
            h={{ base: '380px', md: '480px' }}
            bgGradient={ambientBg}
            pointerEvents="none"
            zIndex={0}
          />
          <div className="relative z-[1] flex flex-col">
            <Navbar />
            <div className="min-h-[calc(100dvh-80px)] flex flex-col">
              <HomePage
                exams={allExams}
                recentAttempts={recentAttempts}
                syncStatus={syncStatus}
                onSelectExam={(exam, options) => void handleStartExam(exam, options)}
                onOpenEditor={(examToEdit) => void handleOpenExamEditor(examToEdit)}
                onOpenTestManager={() => setIsTestManagerOpen(true)}
                onOpenSmartImport={(collection, skill) => {
                  setSmartImportCollection(collection);
                  setSmartImportSkill(skill);
                  setIsSmartImportOpen(true);
                }}
                onRefreshExams={handleRefreshExams}
                onStartWritingExam={handleStartWritingExam}
                onStartSpeakingExam={handleStartSpeakingExam}
                onViewAttemptDetail={(attempt) => void handleViewAttemptDetail(attempt)}
                onDeleteAttempt={(attemptId) => {
                  setRecentAttempts((prev) => prev.filter((a) => a.id !== attemptId));
                  deleteAttemptMutation.mutate({ id: attemptId });
                }}
                onCloudSaveExam={cloudSyncExam}
                onCloudDeleteExam={cloudDeleteExam}
                onCloudCreateCollection={(col) => {
                  upsertCollectionMutation.mutate({
                    name: col.name,
                    description: col.description,
                  });
                }}
                onCloudDeleteCollection={(name, examsToTombstone) => {
                  deleteCollectionMutation.mutate({ name, examsToTombstone });
                }}
                onCloudClearProgress={cloudClearProgress}
              />
            </div>
            <Footer />
          </div>
        </div>
      )}

      {/* 2. WRITING EXAM ROOM VIEW */}
      {currentView === 'writing' && (
        <WritingExamRoom
          key={currentWritingExam.id}
          exam={currentWritingExam}
          onBackToHome={navigateHome}
          onProgressSync={(examId, state) => cloudSaveProgress('Writing', examId, state)}
          onSubmitAttempt={(payload) => {
            recordAttemptMutation.mutate(
              {
                examId: payload.examId,
                examTitle: payload.examTitle,
                skill: 'Writing',
                bandScore: null,
                totalCorrect: payload.task1Words + payload.task2Words,
                totalQuestions: 0,
                timeSpentSeconds: payload.timeSpentSeconds,
                details: {
                  task1Words: payload.task1Words,
                  task2Words: payload.task2Words,
                  task1Text: payload.task1Text,
                  task2Text: payload.task2Text,
                },
              },
              {
                onSuccess: (created) => {
                  setRecentAttempts((prev) => [
                    {
                      id: created.id,
                      examId: created.examId,
                      examTitle: created.examTitle,
                      skill: 'Writing',
                      bandScore: created.bandScore,
                      totalCorrect: created.totalCorrect,
                      totalQuestions: created.totalQuestions,
                      timeSpentSeconds: created.timeSpentSeconds,
                      details: {
                        task1Words: payload.task1Words,
                        task2Words: payload.task2Words,
                        task1Text: payload.task1Text,
                        task2Text: payload.task2Text,
                      },
                      completedAt: created.completedAt,
                    },
                    ...prev.slice(0, 199),
                  ]);
                },
              }
            );
          }}
        />
      )}

      {/* 3. SPEAKING EXAM ROOM VIEW */}
      {currentView === 'speaking' && (
        <SpeakingExamRoom
          key={currentSpeakingExam.id}
          exam={currentSpeakingExam}
          onBackToHome={navigateHome}
          onProgressSync={(examId, state) => cloudSaveProgress('Speaking', examId, state)}
        />
      )}

      {/* 4. EXAM VIEW (Reading & Listening) */}
      {currentView === 'exam' && activePart && (
        <div className="flex flex-col h-full w-full overflow-hidden">
          <ExamHeader
            examTitle={currentExam.title}
            durationMinutes={currentExam.durationMinutes}
            timeRemaining={timeRemaining}
            isUntimed={isUntimed}
            elapsedSeconds={elapsedSeconds}
            isPaused={isPaused}
            onTogglePause={() => setIsPaused((prev) => !prev)}
            onOpenTestManager={() => setIsTestManagerOpen(true)}
            onBackToHome={navigateHome}
            fontSize={fontSize}
            onChangeFontSize={handleUpdateFontSize}
          />

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
                  ({scoreReport.totalCorrect}/{scoreReport.totalQuestions} Correct •{' '}
                  {Math.round((scoreReport.totalCorrect / scoreReport.totalQuestions) * 100)}% Accuracy)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {scoreReport.details.some((d) => !d.isCorrect) && (
                  <button
                    onClick={() => {
                      const incorrect = scoreReport.details.filter((d) => !d.isCorrect);
                      const currentIdx = incorrect.findIndex(
                        (d) => d.questionNumber === currentQuestionNumber
                      );
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

          <PartTabs
            parts={currentExam.parts}
            activePartNumber={activePartNumber}
            onSelectPart={handleSelectPart}
            answers={answers}
          />

          {isListeningExam(currentExam) ? (
            <div
              ref={listeningContentRef}
              className="flex-1 overflow-y-auto bg-[#f8f9fa] dark:bg-gray-900 relative select-none"
            >
              <div className="max-w-4xl mx-auto min-h-full bg-white px-3 sm:px-6 md:px-12 py-4 sm:py-8 shadow-xs border-x border-gray-200 pb-24">
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
                        <span>
                          {showListeningTranscript
                            ? 'Hide Audio Transcript'
                            : 'View Audio Transcript / Script'}
                        </span>
                      </button>
                    )}
                  </div>

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
                    <div className="text-center py-8 text-gray-400 text-sm">
                      No questions for this section yet.
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
                </div>
              </div>

              <div className="hidden md:flex fixed bottom-24 right-6 z-30 items-center gap-0.5">
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
                        No questions for this part yet. Click &quot;+ Add Test&quot; to import questions.
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

                    <div className="hidden md:flex fixed bottom-13 right-4 z-30 items-center gap-0.5">
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
                cloudSyncExam(
                  'Listening',
                  updatedExam.id,
                  updatedExam.title,
                  updatedExam.collection || 'My Tests',
                  updatedExam as unknown as Record<string, unknown>
                );
              }}
            />
          )}

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

      {/* Lazy-mounted Modals (only loaded/rendered when open) */}
      {isSubmitConfirmOpen && (
        <SubmitConfirmModal
          isOpen={isSubmitConfirmOpen}
          onClose={() => setIsSubmitConfirmOpen(false)}
          onConfirmSubmit={handleConfirmSubmit}
          totalQuestions={allQuestions.length}
          answeredCount={answeredCount}
          flaggedCount={flaggedQuestions.length}
        />
      )}

      {isLeaveExamModalOpen && (
        <LeaveExamModal
          isOpen={isLeaveExamModalOpen}
          onClose={() => setIsLeaveExamModalOpen(false)}
          onSaveAndExit={() => {
            setIsLeaveExamModalOpen(false);
            navigateHome();
          }}
          onDiscardAndExit={() => {
            clearExamProgress(currentExam.id);
            cloudClearProgress(getExamSkillLabel(currentExam), currentExam.id);
            setIsLeaveExamModalOpen(false);
            navigateHome();
          }}
          examTitle={currentExam.title}
          totalQuestions={allQuestions.length}
          answeredCount={answeredCount}
          timeRemaining={timeRemaining}
        />
      )}

      {isResultModalOpen && scoreReport && (
        <ResultModal
          isOpen={isResultModalOpen}
          onClose={() => setIsResultModalOpen(false)}
          exam={currentExam}
          scoreReport={scoreReport}
          timeSpentSeconds={
            isUntimed
              ? elapsedSeconds
              : Math.max(0, sessionDurationSeconds - timeRemaining)
          }
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

      {isSmartImportOpen && (
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
            cloudSyncExam(
              getExamSkillLabel(savedExam),
              savedExam.id,
              savedExam.title,
              savedExam.collection || 'My Tests',
              savedExam as unknown as Record<string, unknown>
            );
            setIsSmartImportOpen(false);
            setSmartImportCollection(undefined);
            setSmartImportSkill(undefined);
            handleRefreshExams();
            if (action === 'take_test') {
              void handleStartExam(savedExam);
            } else if (action === 'edit') {
              setEditingExam(savedExam);
              setIsEditorOpen(true);
            }
          }}
          onWritingImportSuccess={(saved) => {
            if (saved) {
              cloudSyncExam(
                'Writing',
                saved.id,
                saved.title,
                saved.collection || 'My Tests',
                saved as unknown as Record<string, unknown>
              );
            }
            setIsSmartImportOpen(false);
            setSmartImportCollection(undefined);
            setSmartImportSkill(undefined);
            handleRefreshExams();
          }}
          onSpeakingImportSuccess={(saved) => {
            if (saved) {
              cloudSyncExam(
                'Speaking',
                saved.id,
                saved.title,
                saved.collection || 'My Tests',
                saved as unknown as Record<string, unknown>
              );
            }
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
      )}

      {isTestManagerOpen && (
        <TestManager
          isOpen={isTestManagerOpen}
          onClose={() => setIsTestManagerOpen(false)}
          onSelectExam={(exam) => {
            void handleStartExam(exam);
            setIsTestManagerOpen(false);
          }}
          onOpenEditor={(examToEdit) => void handleOpenExamEditor(examToEdit)}
          onOpenSmartImport={() => {
            setIsTestManagerOpen(false);
            setIsSmartImportOpen(true);
          }}
          onExamsMutated={handleRefreshExams}
          onCloudSaveExam={(ex) =>
            cloudSyncExam(
              getExamSkillLabel(ex),
              ex.id,
              ex.title,
              ex.collection || 'My Tests',
              ex as unknown as Record<string, unknown>
            )
          }
          onCloudDeleteExam={(ex) => cloudDeleteExam(getExamSkillLabel(ex), ex.id)}
          onCloudCreateCollection={(col) =>
            upsertCollectionMutation.mutate({
              name: col.name,
              description: col.description,
            })
          }
        />
      )}

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
            cloudSyncExam(
              'Writing',
              saved.id,
              saved.title,
              saved.collection || 'My Tests',
              saved as unknown as Record<string, unknown>
            );
            setIsWritingEditorOpen(false);
            setEditingWritingExam(null);
            handleRefreshExams();
          }}
        />
      )}

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
            cloudSyncExam(
              'Speaking',
              saved.id,
              saved.title,
              saved.collection || 'My Tests',
              saved as unknown as Record<string, unknown>
            );
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
