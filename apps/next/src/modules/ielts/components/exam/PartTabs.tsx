import type { FC } from 'react';
import type { Part, UserAnswerRecord } from '../../types/exam';

interface PartTabsProps {
  parts: Part[];
  activePartNumber: number;
  onSelectPart: (partNumber: number) => void;
  answers: UserAnswerRecord;
}

export const PartTabs: FC<PartTabsProps> = ({
  parts,
  activePartNumber,
  onSelectPart,
  answers: _answers,
}) => {
  const activePart = parts.find((p) => p.partNumber === activePartNumber);
  const activeQuestions = activePart ? activePart.questionGroups.flatMap((g) => g.questions) : [];
  const minQ = activeQuestions.length > 0 ? Math.min(...activeQuestions.map((q) => q.orderNumber)) : null;
  const maxQ = activeQuestions.length > 0 ? Math.max(...activeQuestions.map((q) => q.orderNumber)) : null;

  return (
    <div className="bg-white border-b-2 border-gray-200 select-none">
      <div className="px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between flex-nowrap overflow-x-auto scrollbar-none gap-2">
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {parts.map((part) => {
            const isActive = part.partNumber === activePartNumber;

            return (
              <button
                key={part.id}
                onClick={() => onSelectPart(part.partNumber)}
                className={`px-3 sm:px-3.5 py-1.5 text-xs font-bold rounded-xl border-2 transition flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 hover:border-gray-300'
                }`}
              >
                <span>Part {part.partNumber}</span>
              </button>
            );
          })}
        </div>

        {minQ !== null && maxQ !== null && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold shrink-0 whitespace-nowrap">
            Q {minQ}–{maxQ}
          </div>
        )}
      </div>
    </div>
  );
};
