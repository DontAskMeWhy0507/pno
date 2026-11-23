import { useState, useEffect, type FC } from 'react';
import type { Exam } from '../../types/exam';
import type { WritingExam } from '../../types/writing';
import type { SpeakingExam } from '../../types/speaking';
import { getAllWritingExams, saveWritingExam, deleteWritingExam } from '../../data/writingExams';
import { getAllSpeakingExams, saveSpeakingExam, deleteSpeakingExam } from '../../data/speakingExams';
import { WritingEditorModal } from '../admin/WritingEditorModal';
import { SpeakingEditorModal } from '../admin/SpeakingEditorModal';
import {
  deleteExam,
  getAllCollections,
  getExamCollection,
  createCollection,
  deleteCollection,
  isListeningExam,
} from '../../utils/storage';
import { getSavedExamSummary, clearExamProgress } from '../../utils/examProgress';
import { getSavedWritingSummary, clearWritingProgress } from '../../utils/writingProgress';
import { InProgressBanner, type InProgressItem } from './InProgressBanner';

import {
  BookOpen,
  Headphones,
  PenTool,
  Mic,
  Search,
  FolderOpen,
  Play,
  Clock,
  Plus,
  X,
  Trash2,
  Edit3,
  FolderPlus,
  Folder,
  Award,
} from 'lucide-react';

interface HomePageProps {
  exams: Exam[];
  onSelectExam: (exam: Exam) => void;
  onOpenEditor: (exam?: Exam | null) => void;
  onOpenTestManager: () => void;
  onOpenSmartImport: (collection?: string, skill?: 'reading' | 'listening' | 'writing' | 'speaking') => void;
  onRefreshExams: () => void;
  onStartWritingExam: (exam: WritingExam) => void;
  onStartSpeakingExam: (exam: SpeakingExam) => void;
}

export const HomePage: FC<HomePageProps> = ({
  exams,
  onSelectExam,
  onOpenEditor,
  onOpenTestManager,
  onOpenSmartImport,
  onRefreshExams,
  onStartWritingExam,
  onStartSpeakingExam,
}) => {
  const [activeTab, setActiveTab] = useState<'reading' | 'listening' | 'writing' | 'speaking'>('reading');
  const [viewMode, setViewMode] = useState<'all_tests' | 'by_collection'>('all_tests');
  const [selectedCollectionName, setSelectedCollectionName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');

  // Collections and Exams
  const collections = getAllCollections();
  const [writingExams, setWritingExams] = useState<WritingExam[]>(() => getAllWritingExams());
  const [speakingExams, setSpeakingExams] = useState<SpeakingExam[]>(() => getAllSpeakingExams());

  useEffect(() => {
    setWritingExams(getAllWritingExams());
    setSpeakingExams(getAllSpeakingExams());
  }, [exams]);

  const [isWritingEditorOpen, setIsWritingEditorOpen] = useState(false);
  const [editingWritingExam, setEditingWritingExam] = useState<WritingExam | null>(null);

  const [isSpeakingEditorOpen, setIsSpeakingEditorOpen] = useState(false);
  const [editingSpeakingExam, setEditingSpeakingExam] = useState<SpeakingExam | null>(null);

  const refreshWriting = () => setWritingExams(getAllWritingExams());
  const refreshSpeaking = () => setSpeakingExams(getAllSpeakingExams());

  const handleTabChange = (newTab: 'reading' | 'listening' | 'writing' | 'speaking') => {
    setActiveTab(newTab);
    setSearchQuery('');
  };

  const handleSaveWriting = (examToSave: WritingExam) => {
    saveWritingExam(examToSave);
    setIsWritingEditorOpen(false);
    setEditingWritingExam(null);
    refreshWriting();
  };

  const handleSaveSpeaking = (examToSave: SpeakingExam) => {
    saveSpeakingExam(examToSave);
    setIsSpeakingEditorOpen(false);
    setEditingSpeakingExam(null);
    refreshSpeaking();
  };

  const handleDeleteExam = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete test "${title}"?`)) {
      deleteExam(id);
      onRefreshExams();
    }
  };

  const handleDeleteWritingExam = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete writing test "${title}"?`)) {
      deleteWritingExam(id);
      refreshWriting();
    }
  };

  const handleDeleteSpeakingExam = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete speaking test "${title}"?`)) {
      deleteSpeakingExam(id);
      refreshSpeaking();
    }
  };

  const handleDeleteCollection = (e: React.MouseEvent, colName: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete collection "${colName}" and all tests inside it?`)) {
      deleteCollection(colName, true);
      if (selectedCollectionName === colName) {
        setSelectedCollectionName(null);
      }
      onRefreshExams();
    }
  };

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    try {
      createCollection(newCollectionName.trim(), newCollectionDesc.trim());
      setNewCollectionName('');
      setNewCollectionDesc('');
      setShowNewCollectionModal(false);
      onRefreshExams();
    } catch (err: any) {
      alert(err.message || 'Failed to create collection');
    }
  };

  // Get tests for a specific collection name
  const getTestsForCollection = (colName: string) => {
    return exams.filter(
      (e) => getExamCollection(e).toLowerCase() === colName.toLowerCase()
    );
  };

  const activeCollectionTests = selectedCollectionName
    ? getTestsForCollection(selectedCollectionName)
    : [];

  // Split by category for separate tabs
  const readingExams = exams.filter((e) => !isListeningExam(e));
  const listeningExams = exams.filter((e) => isListeningExam(e));
  const customReadingTests = readingExams.filter((e) => e.isBuiltin === false || e.collection === 'My Tests');
  const customListeningTests = listeningExams.filter((e) => e.isBuiltin === false || e.collection === 'My Tests');

  // Filter exams matching search query across all 4 skills
  const qClean = searchQuery.toLowerCase().trim();
  const readingSearchResults = qClean
    ? readingExams.filter(
        (e) =>
          e.title.toLowerCase().includes(qClean) ||
          (e.description && e.description.toLowerCase().includes(qClean))
      )
    : [];

  const listeningSearchResults = qClean
    ? listeningExams.filter(
        (e) =>
          e.title.toLowerCase().includes(qClean) ||
          (e.description && e.description.toLowerCase().includes(qClean))
      )
    : [];

  const writingSearchResults = qClean
    ? writingExams.filter(
        (w) =>
          w.title.toLowerCase().includes(qClean) ||
          (w.collection && w.collection.toLowerCase().includes(qClean)) ||
          w.task1.prompt.toLowerCase().includes(qClean) ||
          w.task2.prompt.toLowerCase().includes(qClean)
      )
    : [];

  const speakingSearchResults = qClean
    ? speakingExams.filter(
        (s) =>
          s.title.toLowerCase().includes(qClean) ||
          (s.description && s.description.toLowerCase().includes(qClean)) ||
          (s.collection && s.collection.toLowerCase().includes(qClean)) ||
          (s.part2Question && s.part2Question.topic && s.part2Question.topic.toLowerCase().includes(qClean))
      )
    : [];

  const [progressVersion, setProgressVersion] = useState(0);

  const handleDiscardExam = (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to discard your saved progress for "${title}"?\nYou will start fresh from question 1 next time.`)) {
      clearExamProgress(id);
      setProgressVersion((v) => v + 1);
    }
  };

  const handleDiscardWriting = (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to discard your essay draft for "${title}"?\nAll written text in this draft will be deleted.`)) {
      clearWritingProgress(id);
      setProgressVersion((v) => v + 1);
    }
  };

  const renderWritingCard = (test: WritingExam) => {
    const savedWriting = getSavedWritingSummary(test.id);
    return (
      <article
        key={`${test.id}-${progressVersion}`}
        className={`bg-white border hover:shadow-md rounded-xl p-5 space-y-3.5 transition-all duration-150 flex flex-col justify-between ${
          savedWriting
            ? 'border-emerald-300 ring-1 ring-emerald-100 bg-emerald-50/15'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="space-y-2">
          <header className="flex items-center justify-between flex-wrap gap-1">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
              {test.collection || 'IELTS Writing'}
            </span>
            <div className="flex items-center gap-1.5">
              {savedWriting && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" aria-hidden="true" />
                  <span>Draft ({savedWriting.task1Words + savedWriting.task2Words} words)</span>
                </span>
              )}
              <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                <Clock className="w-3 h-3" aria-hidden="true" /> {test.durationMinutes} mins
              </span>
            </div>
          </header>

          <h3 className="text-sm font-bold text-slate-900 leading-snug">{test.title}</h3>

          <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/80 text-xs space-y-1.5">
            <div className="text-slate-700 line-clamp-2">
              <strong className="text-slate-900">Task 1:</strong> {test.task1.prompt}
            </div>
            <div className="text-slate-700 line-clamp-2">
              <strong className="text-slate-900">Task 2:</strong> {test.task2.prompt}
            </div>
          </div>
        </div>

        <footer className="pt-2 flex items-center gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onStartWritingExam(test)}
            className={`flex-1 py-2 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
              savedWriting
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            aria-label={savedWriting ? `Resume writing draft for ${test.title}` : `Start writing test ${test.title}`}
          >
            <Play className="w-3.5 h-3.5 fill-white" aria-hidden="true" />
            <span>{savedWriting ? 'Resume Writing Draft' : 'Start Writing Test'}</span>
          </button>
          {savedWriting && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDiscardWriting(test.id, test.title);
              }}
              className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg border border-slate-200 hover:border-rose-300 transition shadow-2xs text-xs font-semibold flex items-center gap-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
              title="Discard saved draft"
              aria-label={`Discard saved draft for ${test.title}`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" />
              <span>Discard</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditingWritingExam(test);
              setIsWritingEditorOpen(true);
            }}
            className="p-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-emerald-700 rounded-lg border border-slate-200 transition shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
            title="Edit this writing test"
            aria-label={`Edit ${test.title}`}
          >
            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(e) => handleDeleteWritingExam(e, test.id, test.title)}
            className="p-2 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 transition shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-1"
            title="Delete this writing test"
            aria-label={`Delete ${test.title}`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </footer>
      </article>
    );
  };

  const renderSpeakingCard = (test: SpeakingExam) => (
    <article
      key={test.id}
      className="bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md rounded-xl p-5 space-y-3.5 transition-all duration-150 flex flex-col justify-between"
    >
      <div className="space-y-2">
        <header className="flex items-center justify-between">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
            {test.collection || 'IELTS Speaking'}
          </span>
          <span className="text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1 font-medium">
            <Award className="w-3 h-3 text-amber-600" aria-hidden="true" /> Band 8.0+ Sample
          </span>
        </header>

        <h3 className="text-sm font-bold text-slate-900 leading-snug">{test.title}</h3>
        {test.description && <p className="text-xs text-slate-500">{test.description}</p>}

        <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/80 text-xs space-y-1.5">
          <div className="text-slate-700">
            <strong className="text-slate-900">Part 1:</strong> {test.part1Questions.length} interview questions
          </div>
          <div className="text-slate-700">
            <strong className="text-slate-900">Part 2 Cue Card:</strong> "{test.part2Question.questionText}"
          </div>
          <div className="text-slate-700">
            <strong className="text-slate-900">Part 3:</strong> {test.part3Questions.length} in-depth discussion questions
          </div>
        </div>
      </div>

      <footer className="pt-2 flex items-center gap-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => onStartSpeakingExam(test)}
          className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          aria-label={`Start speaking practice for ${test.title}`}
        >
          <Mic className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Start Speaking Practice Now</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setEditingSpeakingExam(test);
            setIsSpeakingEditorOpen(true);
          }}
          className="p-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-indigo-700 rounded-lg border border-slate-200 transition shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
          title="Edit this speaking test"
          aria-label={`Edit ${test.title}`}
        >
          <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={(e) => handleDeleteSpeakingExam(e, test.id, test.title)}
          className="p-2 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 transition shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-1"
          title="Delete this speaking test"
          aria-label={`Delete ${test.title}`}
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </footer>
    </article>
  );

  const renderTestCard = (test: Exam, isCustom: boolean = false) => {
    const totalQ = test.parts.reduce(
      (sum, p) =>
        sum + (p.questionGroups || []).reduce((gSum, g) => gSum + (g.questions || []).length, 0),
      0
    );
    const colName = getExamCollection(test);
    const savedProgress = getSavedExamSummary(test.id);

    return (
      <article
        key={`${test.id}-${progressVersion}`}
        className={`bg-white border rounded-xl p-4 flex flex-col justify-between gap-3 transition-all duration-150 group shadow-2xs hover:shadow-md ${
          savedProgress
            ? 'border-emerald-300 ring-1 ring-emerald-100 bg-emerald-50/15'
            : isCustom
            ? 'border-blue-300 ring-1 ring-blue-100 bg-blue-50/20'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="min-w-0">
          <header className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80">
              {colName}
            </span>
            {isCustom && (
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-200 uppercase tracking-wider">
                CUSTOM / NEW
              </span>
            )}
            {savedProgress && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" aria-hidden="true" />
                <span>In Progress ({savedProgress.answeredCount}/{totalQ})</span>
              </span>
            )}
          </header>
          <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition line-clamp-2 leading-snug">
            {test.title}
          </h3>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-2">
            <span>
              {savedProgress
                ? `${Math.ceil(savedProgress.timeRemaining / 60)} mins left`
                : `${test.durationMinutes || (isListeningExam(test) ? 30 : 60)} mins`}
            </span>
            <span aria-hidden="true">•</span>
            <span>{test.parts.length} {isListeningExam(test) ? 'Sections' : 'Parts'}</span>
            <span aria-hidden="true">•</span>
            <span className="text-slate-700 font-semibold">
              {savedProgress ? `${savedProgress.answeredCount}/${totalQ} Answered` : `${totalQ} Questions`}
            </span>
          </div>
        </div>
        <footer className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 mt-1">
          <button
            type="button"
            onClick={() => onSelectExam(test)}
            className={`flex-1 py-1.5 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
              savedProgress
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            aria-label={savedProgress ? `Resume test ${test.title}` : `Start test ${test.title}`}
          >
            <Play className="w-3.5 h-3.5 fill-white" aria-hidden="true" />
            <span>{savedProgress ? 'Resume Test' : 'Start Test'}</span>
          </button>
          {savedProgress && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDiscardExam(test.id, test.title);
              }}
              className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg border border-slate-200 hover:border-rose-300 transition shadow-2xs text-xs font-semibold flex items-center gap-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
              title="Discard saved progress & restart from beginning"
              aria-label={`Discard progress for ${test.title}`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" />
              <span>Discard</span>
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenEditor(test);
            }}
            className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 rounded-lg border border-slate-200 transition shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
            title="Edit Test"
            aria-label={`Edit ${test.title}`}
          >
            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(e) => handleDeleteExam(e, test.id, test.title)}
            className="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 transition shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-1"
            title="Delete Test"
            aria-label={`Delete ${test.title}`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </footer>
      </article>
    );
  };

  // Build in-progress tests list across Reading, Listening, and Writing
  const inProgressItems: InProgressItem[] = [];

  for (const exam of exams) {
    const summary = getSavedExamSummary(exam.id);
    if (summary) {
      const totalQ = exam.parts.reduce(
        (sum, p) => sum + (p.questionGroups || []).reduce((gSum, g) => gSum + (g.questions || []).length, 0),
        0
      );
      inProgressItems.push({
        id: exam.id,
        title: exam.title,
        skill: isListeningExam(exam) ? 'listening' : 'reading',
        collection: getExamCollection(exam),
        answeredCount: summary.answeredCount,
        totalQuestions: totalQ,
        timeRemaining: summary.timeRemaining,
        lastSavedAt: summary.lastSavedAt || 0,
        activePartNumber: summary.activePartNumber,
        currentQuestionNumber: summary.currentQuestionNumber,
        rawExam: exam,
      });
    }
  }

  for (const w of writingExams) {
    const summary = getSavedWritingSummary(w.id);
    if (summary) {
      inProgressItems.push({
        id: w.id,
        title: w.title,
        skill: 'writing',
        collection: w.collection,
        answeredCount: 0,
        totalQuestions: 0,
        timeRemaining: summary.timeRemaining,
        lastSavedAt: summary.lastSavedAt || 0,
        task1Words: summary.task1Words,
        task2Words: summary.task2Words,
        rawWritingExam: w,
      });
    }
  }

  inProgressItems.sort((a, b) => b.lastSavedAt - a.lastSavedAt);

  const readingInProgressCount = inProgressItems.filter((i) => i.skill === 'reading').length;
  const listeningInProgressCount = inProgressItems.filter((i) => i.skill === 'listening').length;
  const writingInProgressCount = inProgressItems.filter((i) => i.skill === 'writing').length;

  return (
    <div className="flex-1 bg-transparent text-slate-800 dark:text-gray-100 flex flex-col font-sans select-auto">
      {/* 1. PNO IELTS SECTION HEADER (Unified with PNO Main Navbar) */}
      <header className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-200/80 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight font-display">
                PNO IELTS
              </span>
              <span className="text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-600 text-white tracking-wide uppercase">
                4 Skills
              </span>
            </div>
            <div className="hidden sm:block h-4 w-[1px] bg-slate-200 dark:bg-gray-700" aria-hidden="true" />
            <span className="hidden sm:inline text-xs text-slate-500 dark:text-gray-400 font-medium">
              Phòng luyện thi IELTS 4 kỹ năng trên máy tính
            </span>
          </div>

          {/* Search bar & Action buttons in semantic navigation landmark */}
          <nav aria-label="Quick Actions" className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
            <div className="relative flex-1 min-w-[160px] sm:flex-none sm:w-56">
              <label htmlFor="test-search-input" className="sr-only">
                Search practice tests
              </label>
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" aria-hidden="true" />
              <input
                id="test-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tests..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 text-slate-800 placeholder-slate-400 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition shadow-2xs"
              />
            </div>

            {/* Create new Collection (Secondary) */}
            <button
              type="button"
              onClick={() => setShowNewCollectionModal(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 shrink-0"
              title="Create a new collection folder"
              aria-label="Create new collection folder"
            >
              <FolderPlus className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <span className="hidden xs:inline sm:inline">+ Collection</span>
            </button>

            {/* Test Manager Button (Secondary) */}
            <button
              type="button"
              onClick={onOpenTestManager}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 shrink-0"
              title="Manage all tests: Browse by collections, Edit, Delete, Export JSON"
              aria-label="Open Test Bank manager"
            >
              <FolderOpen className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <span>Test Bank</span>
            </button>

            {/* Primary Call-to-action: Open 4-Skill Add Test Modal */}
            <button
              type="button"
              onClick={() => onOpenSmartImport(undefined, activeTab)}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 shrink-0"
              title="Add a new practice test across any of the 4 IELTS skills"
              aria-label="Add a new practice test"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>+ Add Test</span>
            </button>
          </nav>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-5 sm:py-6 space-y-5 sm:space-y-6">

        {/* In-Progress Banner: Prominently displays any test just exited / active */}
        <InProgressBanner
          items={inProgressItems}
          onResumeExam={onSelectExam}
          onResumeWriting={onStartWritingExam}
          onDiscardExam={handleDiscardExam}
          onDiscardWriting={handleDiscardWriting}
        />

        {/* Unified Category Tabs (Accessible Segmented Control) */}
        <nav aria-label="IELTS Skills Navigation" className="w-full overflow-x-auto pb-1">
          <div
            role="tablist"
            aria-label="IELTS Skills"
            className="inline-flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-gray-800 rounded-xl w-max min-w-full sm:min-w-0 sm:w-fit border border-slate-200/80 dark:border-gray-700"
          >
            <button
              id="tab-reading"
              role="tab"
              aria-selected={activeTab === 'reading'}
              aria-controls="reading-panel"
              type="button"
              onClick={() => handleTabChange('reading')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                activeTab === 'reading'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Reading</span>
              {readingInProgressCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-600 text-white font-bold leading-none animate-pulse">
                  {readingInProgressCount}
                </span>
              )}
            </button>

            <button
              id="tab-listening"
              role="tab"
              aria-selected={activeTab === 'listening'}
              aria-controls="listening-panel"
              type="button"
              onClick={() => handleTabChange('listening')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                activeTab === 'listening'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Headphones className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Listening</span>
              {listeningInProgressCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-600 text-white font-bold leading-none animate-pulse">
                  {listeningInProgressCount}
                </span>
              )}
            </button>

            <button
              id="tab-writing"
              role="tab"
              aria-selected={activeTab === 'writing'}
              aria-controls="writing-panel"
              type="button"
              onClick={() => handleTabChange('writing')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                activeTab === 'writing'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <PenTool className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Writing</span>
              {writingInProgressCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-600 text-white font-bold leading-none animate-pulse">
                  {writingInProgressCount}
                </span>
              )}
            </button>

            <button
              id="tab-speaking"
              role="tab"
              aria-selected={activeTab === 'speaking'}
              aria-controls="speaking-panel"
              type="button"
              onClick={() => handleTabChange('speaking')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                activeTab === 'speaking'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Speaking</span>
            </button>
          </div>
        </nav>

        {/* TAB 1: READING */}
        {activeTab === 'reading' && (
          <section id="reading-panel" role="tabpanel" aria-labelledby="tab-reading" className="space-y-6">
            {/* Search Results if user is searching */}
            {searchQuery.trim() && (
              <div className="space-y-3 p-5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Search results for "{searchQuery}" ({readingSearchResults.length} tests)
                  </span>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    Clear Search
                  </button>
                </div>
                {readingSearchResults.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No matching reading tests found.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {readingSearchResults.map((test) => renderTestCard(test, !test.isBuiltin || test.collection === 'My Tests'))}
                  </div>
                )}
              </div>
            )}

            {/* View Mode Toggle Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {viewMode === 'all_tests'
                    ? `All Reading Tests (${readingExams.length} Tests Available)`
                    : `IELTS Test Collections (${collections.length} Collections)`}
                </h2>
                <p className="text-xs text-slate-500">
                  {viewMode === 'all_tests'
                    ? 'Start any IELTS reading practice test immediately, or browse your custom imports below'
                    : 'Practice tests organized by Cambridge volumes and official collections'}
                </p>
              </div>

              {/* View Switcher: All Tests vs Collections */}
              <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => setViewMode('all_tests')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                    viewMode === 'all_tests'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Tests ({readingExams.length})
                </button>
                <button
                  onClick={() => setViewMode('by_collection')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                    viewMode === 'by_collection'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Collections ({collections.length})
                </button>
              </div>
            </div>

            {/* VIEW MODE 1: ALL TESTS (DEFAULT) */}
            {viewMode === 'all_tests' && (
              <div className="space-y-6">
                {/* Pinned Custom Tests Section */}
                {customReadingTests.length > 0 && (
                  <div className="space-y-3 bg-blue-50/50 border border-blue-200/80 rounded-xl p-4 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-500 text-sm">⭐</span>
                        <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                          My Custom Reading Tests ({customReadingTests.length})
                        </h3>
                      </div>
                      <button
                        onClick={() => onOpenSmartImport(undefined, 'reading')}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Another Test</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {customReadingTests.map((t) => renderTestCard(t, true))}
                    </div>
                  </div>
                )}

                {/* All Tests Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Complete Reading Test Bank ({readingExams.length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {readingExams.map((t) => renderTestCard(t, !t.isBuiltin || t.collection === 'My Tests'))}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW MODE 2: BY COLLECTION */}
            {viewMode === 'by_collection' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {collections.map((col) => {
                  const colTests = getTestsForCollection(col.name);
                  const hasCustom = colTests.some((t) => t.isBuiltin === false);

                  return (
                    <div
                      key={col.id}
                      onClick={() => setSelectedCollectionName(col.name)}
                      className="bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md rounded-xl p-5 transition-all cursor-pointer group shadow-2xs"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition">
                            <Folder className="w-4 h-4" />
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
                            {col.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasCustom && (
                            <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-semibold">
                              Custom Tests Added
                            </span>
                          )}
                          <button
                            onClick={(e) => handleDeleteCollection(e, col.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title={`Delete collection "${col.name}"`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-1 mb-4">
                        {col.description || `IELTS collection: ${col.name}`}
                      </p>

                      {/* Reading & Listening Pills */}
                      <div className="flex items-center gap-2">
                        {(() => {
                          const readingCount = colTests.filter((t) => !isListeningExam(t)).length;
                          const listeningCount = colTests.filter((t) => isListeningExam(t)).length;
                          return (
                            <>
                              <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-200 transition">
                                <BookOpen className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                                <span>{readingCount} Reading</span>
                              </div>

                              <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium group-hover:bg-slate-100 transition">
                                <Headphones className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                                <span>{listeningCount} Listening</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: LISTENING */}
        {activeTab === 'listening' && (
          <section id="listening-panel" role="tabpanel" aria-labelledby="tab-listening" className="space-y-6">
            {/* Search results */}
            {searchQuery.trim() && (
              <div className="space-y-3 p-5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Search results for "{searchQuery}" ({listeningSearchResults.length} tests)
                  </span>
                  <button onClick={() => setSearchQuery('')} className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
                    Clear Search
                  </button>
                </div>
                {listeningSearchResults.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No matching listening tests found.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {listeningSearchResults.map(t => renderTestCard(t, !t.isBuiltin))}
                  </div>
                )}
              </div>
            )}

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-blue-600" />
                  Listening Practice Tests ({listeningExams.length} Available)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  4 sections · 40 questions · Audio player with MP3 support · Instant band scoring
                </p>
              </div>
              <button
                onClick={() => onOpenSmartImport(undefined, 'listening')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Listening Test</span>
              </button>
            </div>

            {/* Custom (user-added) listening tests */}
            {customListeningTests.length > 0 && (
              <div className="space-y-3 bg-blue-50/50 border border-blue-200/80 rounded-xl p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500 text-sm">⭐</span>
                    <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                      My Custom Listening Tests ({customListeningTests.length})
                    </h3>
                  </div>
                  <button onClick={() => onOpenSmartImport(undefined, 'listening')} className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1">
                    <Plus className="w-3 h-3" />
                    <span>Add Another</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {customListeningTests.map(t => renderTestCard(t, true))}
                </div>
              </div>
            )}

            {/* All listening tests */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Built-in Listening Tests ({listeningExams.filter(e => e.isBuiltin !== false).length})
              </h3>
              {listeningExams.filter(e => e.isBuiltin !== false).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                  <Headphones className="w-10 h-10 text-slate-300" />
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-slate-700">No listening tests yet</p>
                    <p className="text-xs text-slate-500">Import a Listening test via TXT format to get started.</p>
                  </div>
                  <button onClick={() => onOpenSmartImport(undefined, 'listening')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Import First Listening Test</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {listeningExams.filter(e => e.isBuiltin !== false).map(t => renderTestCard(t, false))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 3: WRITING SECTION */}
        {activeTab === 'writing' && (
          <section id="writing-panel" role="tabpanel" aria-labelledby="tab-writing" className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Computer-Delivered IELTS Writing Room</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Split-screen layout, visual charts, live word counters, Band 8.5+ model essays & AI coaching prompts
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingWritingExam(null);
                      setIsWritingEditorOpen(true);
                    }}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Writing Test</span>
                  </button>
                  <button
                    disabled={writingExams.length === 0}
                    onClick={() => writingExams[0] && onStartWritingExam(writingExams[0])}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition ${
                      writingExams.length === 0
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Enter Writing Room</span>
                  </button>
                </div>
              </div>

              {/* Search results */}
              {searchQuery.trim() && (
                <div className="space-y-3 p-5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Search results for "{searchQuery}" ({writingSearchResults.length} tests)
                    </span>
                    <button onClick={() => setSearchQuery('')} className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
                      Clear Search
                    </button>
                  </div>
                  {writingSearchResults.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">No matching writing tests found.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {writingSearchResults.map((test) => renderWritingCard(test))}
                    </div>
                  )}
                </div>
              )}

              {/* Writing Tests Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {writingExams.map((test) => renderWritingCard(test))}
              </div>
            </div>
          </section>
        )}

        {/* TAB 4: SPEAKING SECTION */}
        {activeTab === 'speaking' && (
          <section id="speaking-panel" role="tabpanel" aria-labelledby="tab-speaking" className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Mic className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>IELTS Speaking Room (Live Audio Recording & Transcript)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Real audio recorder, speech-to-text live transcripts, 1-minute cue card prep timer & Band 8.0+ sample responses
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingSpeakingExam(null);
                      setIsSpeakingEditorOpen(true);
                    }}
                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Speaking Test</span>
                  </button>
                  <button
                    disabled={speakingExams.length === 0}
                    onClick={() => speakingExams[0] && onStartSpeakingExam(speakingExams[0])}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition ${
                      speakingExams.length === 0
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Enter Speaking Room</span>
                  </button>
                </div>
              </div>

              {/* Search results */}
              {searchQuery.trim() && (
                <div className="space-y-3 p-5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Search results for "{searchQuery}" ({speakingSearchResults.length} tests)
                    </span>
                    <button onClick={() => setSearchQuery('')} className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
                      Clear Search
                    </button>
                  </div>
                  {speakingSearchResults.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">No matching speaking tests found.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {speakingSearchResults.map((test) => renderSpeakingCard(test))}
                    </div>
                  )}
                </div>
              )}

              {/* Speaking Tests Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {speakingExams.map((test) => renderSpeakingCard(test))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Tests Modal for Selected Collection */}
      {selectedCollectionName !== null && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-xl animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Folder className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Collection: {selectedCollectionName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeCollectionTests.length} tests available in this collection
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const col = selectedCollectionName || undefined;
                    setSelectedCollectionName(null);
                    onOpenSmartImport(col, activeTab === 'listening' ? 'listening' : 'reading');
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-xs transition"
                  title="Add a new test to this collection"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Test</span>
                </button>

                <button
                  onClick={() => setSelectedCollectionName(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tests List inside Selected Collection */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {activeCollectionTests.length > 0 ? (
                activeCollectionTests.map((test) => {
                  const totalQ = test.parts.reduce(
                    (sum, p) =>
                      sum + (p.questionGroups || []).reduce((gSum, g) => gSum + (g.questions || []).length, 0),
                    0
                  );

                  return (
                    <div
                      key={test.id}
                      className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-3.5 flex items-center justify-between gap-4 transition group shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
                          {test.title}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" /> {test.durationMinutes || (isListeningExam(test) ? 30 : 60)} mins
                          </span>
                          <span>•</span>
                          <span>{test.parts.length} {isListeningExam(test) ? 'Sections' : 'Reading Parts'}</span>
                          <span>•</span>
                          <span className="text-slate-700 font-semibold">{totalQ} Questions</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setSelectedCollectionName(null);
                            onSelectExam(test);
                          }}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1 transition"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Start Test</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCollectionName(null);
                            onOpenEditor(test);
                          }}
                          className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 rounded-lg border border-slate-200 transition shadow-2xs"
                          title="Edit Test"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteExam(e, test.id, test.title)}
                          className="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 transition shadow-2xs"
                          title="Delete Test"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 space-y-2.5">
                  <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-600 font-medium">
                    No tests in {selectedCollectionName} yet.
                  </p>
                  <button
                    onClick={() => {
                      const col = selectedCollectionName || undefined;
                      setSelectedCollectionName(null);
                      onOpenSmartImport(col, activeTab === 'listening' ? 'listening' : 'reading');
                    }}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Import New Test to this Collection</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Collection Modal */}
      {showNewCollectionModal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-blue-600" />
                <span>Create New Collection</span>
              </h3>
              <button onClick={() => setShowNewCollectionModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCollection} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Collection Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="e.g., Cambridge 18, Mock Tests 2026..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={newCollectionDesc}
                  onChange={(e) => setNewCollectionDesc(e.target.value)}
                  placeholder="e.g., Authentic IELTS practice exams..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCollectionModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition"
                >
                  Create Collection
                </button>
              </div>
            </form>
          </div>
        </div>
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
          onSave={handleSaveWriting}
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
          onSave={handleSaveSpeaking}
        />
      )}
    </div>
  );
};
