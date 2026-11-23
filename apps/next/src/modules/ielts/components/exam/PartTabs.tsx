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
    <div className="bg-white border-b border-gray-300 select-none">
      <div className="px-4 py-1.5 flex items-center space-x-2">
        {parts.map((part) => {
          const isActive = part.partNumber === activePartNumber;

          return (
            <button
              key={part.id}
              onClick={() => onSelectPart(part.partNumber)}
              className={`px-4 py-1 text-xs font-semibold rounded-none transition flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#222222] text-white shadow-none'
                  : 'bg-transparent text-gray-800 hover:bg-gray-100'
              }`}
            >
              <span>Part {part.partNumber}</span>
            </button>
          );
        })}
      </div>

      {minQ !== null && maxQ !== null && (
        <div className="bg-[#f8f9fa] border-t border-gray-200 px-6 py-1 text-xs font-semibold text-gray-700">
          Questions {minQ}–{maxQ}
        </div>
      )}
    </div>
  );
};
