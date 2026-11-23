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
    <footer className="min-h-[44px] sm:h-11 bg-[#2a2b2e] text-white flex items-center justify-between px-2 sm:px-3 py-1 sm:py-0 select-none text-xs z-20 border-t border-black/40 shrink-0">
      {/* Left: Parts list and Active part's question boxes */}
      <div className="flex items-center space-x-2 overflow-x-auto py-1 scrollbar-none flex-1 mr-2 sm:mr-4">
        {parts.map(part => {
          const isActive = part.partNumber === activePartNumber;
          const { answered, total } = getPartProgress(part);

          if (isActive) {
            return (
              <div key={part.id} className="flex items-center space-x-1.5 shrink-0">
                {/* Active Part Label */}
                <div className="text-white font-bold px-2 py-1 text-[12px] flex items-center gap-1.5">
                  <span>Part {part.partNumber}</span>
                  <span className="text-gray-300 font-medium text-[11px]">
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
                        reviewColor = item.isCorrect ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-rose-600 text-white border-rose-500';
                      }
                    }

                    return (
                      <button
                        key={num}
                        onClick={() => onSelectQuestion(num)}
                        title={`Question ${num}${isFlagged ? ' (Flagged)' : ''}${
                          isAnswered ? ' (Answered)' : ' (Unanswered)'
                        }`}
                        className={`relative w-6 h-6 rounded-none text-[11px] font-bold flex items-center justify-center transition border ${
                          reviewColor
                            ? reviewColor
                            : isCurrent
                            ? 'bg-white text-black border-white ring-1 ring-white'
                            : isAnswered
                            ? 'bg-[#484c55] text-white border-gray-400 hover:bg-[#535863]'
                            : 'bg-transparent text-gray-300 border-gray-600 hover:text-white hover:border-gray-400'
                        }`}
                      >
                        {num}
                        {/* Flag dot */}
                        {isFlagged && !isReviewMode && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full border border-gray-900" />
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
                className="bg-[#1e2024] hover:bg-[#34373e] text-gray-300 font-medium px-2.5 py-1 rounded-none text-[11px] flex items-center gap-1 shrink-0 border border-gray-700 transition"
              >
                <span>Part {part.partNumber}</span>
                <span className="text-gray-400 text-[10px]">
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
          className="w-6.5 h-6.5 bg-[#40434a] hover:bg-[#52565f] rounded-none flex items-center justify-center text-gray-200 transition"
          title="Previous Question"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onNextQuestion}
          className="w-6.5 h-6.5 bg-[#40434a] hover:bg-[#52565f] rounded-none flex items-center justify-center text-gray-200 transition"
          title="Next Question"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Submit button */}
        <button
          onClick={onSubmit}
          className={`h-6.5 px-3 rounded-none font-bold flex items-center gap-1 text-xs transition ml-2 ${
            isReviewMode
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-[#0891b2] hover:bg-[#06b6d4] text-white'
          }`}
          title={isReviewMode ? 'View detailed score report' : 'Submit exam'}
        >
          <Check className="w-3.5 h-3.5 stroke-[3]" />
          <span>{isReviewMode ? 'Results' : 'Submit'}</span>
        </button>
      </div>
    </footer>
  );
};
