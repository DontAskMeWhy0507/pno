import { useEffect, type FC } from 'react';
import type { ScoreReport, Exam } from '../../types/exam';
import { isListeningExam } from '../../utils/storage';
import { Award, RotateCcw, Eye, BookOpen } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
  scoreReport: ScoreReport;
  timeSpentSeconds: number;
  onEnterReviewMode: (questionNumber?: number) => void;
  onRetakeExam: () => void;
  onOpenTestManager: () => void;
}

export const ResultModal: FC<ResultModalProps> = ({
  isOpen,
  onClose,
  exam,
  scoreReport,
  timeSpentSeconds,
  onEnterReviewMode,
  onRetakeExam,
  onOpenTestManager,
}) => {
  useEffect(() => {
    if (isOpen && scoreReport.bandScore >= 6.5) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // Safe fallback
      }
    }
  }, [isOpen, scoreReport.bandScore]);

  if (!isOpen) return null;

  const minutesSpent = Math.floor(timeSpentSeconds / 60);
  const secondsSpent = timeSpentSeconds % 60;
  const accuracy = Math.round((scoreReport.totalCorrect / scoreReport.totalQuestions) * 100) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-gray-200 my-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 text-amber-600 mb-3 shadow-inner">
            <Award className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 uppercase">
            {isListeningExam(exam) ? 'IELTS Listening — Score Report' : 'IELTS Reading — Score Report'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{exam.title}</p>
        </div>

        {/* Big Band Score Box */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 text-center">
            <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">
              IELTS Band Score
            </span>
            <span className="text-3xl font-black text-blue-900 mt-1 block">
              {scoreReport.bandScore.toFixed(1)}
            </span>
            <span className="text-[10px] text-blue-600 font-medium">Academic Scale</span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 text-center">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
              Correct Answers
            </span>
            <span className="text-3xl font-black text-emerald-900 mt-1 block">
              {scoreReport.totalCorrect} / {scoreReport.totalQuestions}
            </span>
            <span className="text-[10px] text-emerald-600 font-medium">Accuracy {accuracy}%</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-center">
            <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block">
              Time Spent
            </span>
            <span className="text-2xl font-black text-slate-800 mt-1.5 block">
              {minutesSpent}m {secondsSpent}s
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Limit: {exam.durationMinutes} mins</span>
          </div>
        </div>

        {/* Part-by-Part breakdown */}
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-6 text-xs">
          <h4 className="font-bold text-gray-800 mb-2.5">Score by Part:</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(scoreReport.partScores).map(([pNum, stats]) => (
              <div key={pNum} className="bg-white p-2.5 rounded border border-gray-200 text-center">
                <span className="font-semibold text-gray-600 block">Part {pNum}</span>
                <span className="font-bold text-sm text-gray-900 mt-0.5 block">
                  {stats.correct} / {stats.total}
                </span>
                <span className="text-[10px] text-gray-500">
                  {Math.round((stats.correct / (stats.total || 1)) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Matrix of 1-40 Questions */}
        <div className="mb-6">
          <h4 className="font-bold text-gray-800 text-xs mb-2">Answer Sheet:</h4>
          <div className="grid grid-cols-10 sm:grid-cols-10 gap-1.5 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded border border-gray-200">
            {scoreReport.details.map((item) => (
              <button
                key={item.questionNumber}
                onClick={() => {
                  onClose();
                  onEnterReviewMode(item.questionNumber);
                }}
                title={`Q${item.questionNumber}: ${item.isCorrect ? 'Correct' : 'Incorrect'} — click to review`}
                className={`py-1.5 text-xs font-bold rounded flex items-center justify-center transition border ${
                  item.isCorrect
                    ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600'
                    : 'bg-rose-500 text-white border-rose-600 hover:bg-rose-600'
                }`}
              >
                {item.questionNumber}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200">
          <button
            onClick={onRetakeExam}
            className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retake This Test</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenTestManager}
              className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 rounded border border-gray-300 transition flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Test Bank</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onEnterReviewMode();
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs transition flex items-center gap-1.5"
            >
              <Eye className="w-4 h-4" />
              <span>Review Answers & Explanations</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
