import type { FC } from 'react';
import type { Part, UserAnswerRecord } from '../../types/exam';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface BottomBarProps {
  parts: Part[];
  activePartNumber: number;
  onSelectPart: (partNumber: number) => void;
  answers: UserAnswerRecord;
  flaggedQuestions: number[];
  currentQuestionNumber: number;
  onSelectQuestion: (questionNumber: number) => void;
  onNextQuestion: () => void;
  onPrevQuestion: () => void;
  onSubmit: () => void;
  isReviewMode?: boolean;
  scoreReportDetails?: { questionNumber: number; isCorrect: boolean }[];
}

export const BottomBar: FC<BottomBarProps> = ({
  parts,
  activePartNumber,
  onSelectPart,
  answers,
  flaggedQuestions,
  currentQuestionNumber,
  onSelectQuestion,
  onNextQuestion,
  onPrevQuestion,
  onSubmit,
  isReviewMode,
  scoreReportDetails,
}) => {
  // Find current active part
  const activePart = parts.find(p => p.partNumber === activePartNumber) || parts[0];

  // Helper to count answered in a part
  const getPartProgress = (part: Part) => {
    let total = 0;
    let answered = 0;
    part.questionGroups.forEach(g => {
      g.questions.forEach(q => {
        total++;
        const a = answers[q.orderNumber];
        if (a !== undefined && a !== '' && (!Array.isArray(a) || a.length > 0)) {
          answered++;
        }
      });
    });
    return { answered, total };
  };

  // Extract all questions of the active part
  const activeQuestions = (activePart?.questionGroups || []).flatMap(g => g.questions);

  return (
    <footer className="min-h-[52px] bg-white border-t-2 border-gray-200 text-gray-800 flex items-center justify-between px-2.5 sm:px-4 pt-1.5 pb-safe sm:py-1.5 select-none text-xs z-20 shrink-0 shadow-xs">
      {/* Left: Parts list and Active part's question boxes */}
      <div className="flex items-center space-x-2 overflow-x-auto py-1 scrollbar-none flex-1 mr-2 sm:mr-4">
        {parts.map(part => {
          const isActive = part.partNumber === activePartNumber;
          const { answered, total } = getPartProgress(part);

          if (isActive) {
            return (
              <div key={part.id} className="flex items-center space-x-2 shrink-0 bg-slate-50 border-2 border-gray-200 rounded-xl px-2.5 py-1">
                {/* Active Part Label */}
                <div className="text-gray-900 font-extrabold px-1.5 py-0.5 text-[12px] flex items-center gap-1.5">
                  <span>Part {part.partNumber}</span>
                  <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md font-bold text-[10px]">
                    {answered}/{total}
                  </span>
                </div>

                {/* Question Numbers for this active part */}
                <div className="flex items-center space-x-1">
                  {activeQuestions.map(q => {
                    const num = q.orderNumber;
                    const a = answers[num];
                    const isAnswered =
                      a !== undefined && a !== '' && (!Array.isArray(a) || a.length > 0);
                    const isCurrent = currentQuestionNumber === num;
                    const isFlagged = flaggedQuestions.includes(num);

                    // Review mode status
                    let reviewColor = '';
                    if (isReviewMode && scoreReportDetails) {
                      const item = scoreReportDetails.find(d => d.questionNumber === num);
                      if (item) {
                        reviewColor = item.isCorrect
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-rose-600 text-white border-rose-600';
                      }
                    }

                    return (
                      <button
                        key={num}
                        onClick={() => onSelectQuestion(num)}
                        title={`Question ${num}${isFlagged ? ' (Flagged)' : ''}${
                          isAnswered ? ' (Answered)' : ' (Unanswered)'
                        }`}
                        className={`relative w-7 h-7 rounded-lg text-[11px] font-bold flex items-center justify-center transition border-2 ${
                          reviewColor
                            ? reviewColor
                            : isCurrent
                            ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-200 shadow-2xs'
                            : isAnswered
                            ? 'bg-blue-50 text-blue-700 border-blue-400 hover:bg-blue-100'
                            : 'bg-white text-gray-600 border-gray-200 hover:text-blue-600 hover:border-blue-300'
                        }`}
                      >
                        {num}
                        {/* Flag dot */}
                        {isFlagged && !isReviewMode && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-white" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          } else {
            // Inactive Part Button
            return (
              <button
                key={part.id}
                onClick={() => onSelectPart(part.partNumber)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-3 py-1.5 rounded-xl text-[11px] flex items-center gap-1.5 shrink-0 border-2 border-gray-200 transition"
              >
                <span>Part {part.partNumber}</span>
                <span className="bg-white text-gray-600 px-1.5 py-0.5 rounded-md text-[10px] border border-gray-200">
                  {answered}/{total}
                </span>
              </button>
            );
          }
        })}
      </div>

      {/* Right: Previous / Next buttons & Submit Checkmark */}
      <div className="flex items-center space-x-1.5 shrink-0">
        <button
          onClick={onPrevQuestion}
          className="w-8 h-8 bg-gray-100 hover:bg-gray-200 border-2 border-gray-200 rounded-xl flex items-center justify-center text-gray-700 transition"
          title="Previous Question"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onNextQuestion}
          className="w-8 h-8 bg-gray-100 hover:bg-gray-200 border-2 border-gray-200 rounded-xl flex items-center justify-center text-gray-700 transition"
          title="Next Question"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Submit button */}
        <button
          onClick={onSubmit}
          className="h-9 sm:h-8 px-3 sm:px-4 rounded-xl font-bold flex items-center gap-1.5 text-xs transition ml-1 sm:ml-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs shrink-0"
          title={isReviewMode ? 'View detailed score report' : 'Submit test'}
        >
          <Check className="w-3.5 h-3.5 stroke-[3]" />
          {isReviewMode ? (
            <span>Results</span>
          ) : (
            <span>
              Submit<span className="hidden sm:inline"> Test</span>
            </span>
          )}
        </button>
      </div>
    </footer>
  );
};
