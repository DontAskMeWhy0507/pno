import type { FC } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SubmitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSubmit: () => void;
  totalQuestions: number;
  answeredCount: number;
  flaggedCount: number;
}

export const SubmitConfirmModal: FC<SubmitConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmSubmit,
  totalQuestions,
  answeredCount,
  flaggedCount,
}) => {
  if (!isOpen) return null;

  const unansweredCount = totalQuestions - answeredCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Confirm Submission</h3>
            <p className="text-xs text-gray-500">Please review your progress before submitting</p>
          </div>
        </div>

        {/* Statistics list */}
        <div className="bg-gray-50 rounded-md p-3.5 space-y-2 text-xs border border-gray-200 mb-5">
          <div className="flex justify-between items-center text-gray-700">
            <span>Total questions:</span>
            <span className="font-bold text-gray-900">{totalQuestions}</span>
          </div>
          <div className="flex justify-between items-center text-emerald-700">
            <span>Answered:</span>
            <span className="font-bold">{answeredCount}</span>
          </div>
          {unansweredCount > 0 && (
            <div className="flex justify-between items-center text-rose-600 font-semibold">
              <span>Unanswered:</span>
              <span>{unansweredCount}</span>
            </div>
          )}
          {flaggedCount > 0 && (
            <div className="flex justify-between items-center text-amber-600">
              <span>Flagged for review:</span>
              <span className="font-semibold">{flaggedCount}</span>
            </div>
          )}
        </div>

        {unansweredCount > 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200 mb-5">
            ⚠️ You still have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}. Are you sure you want to submit and grade your exam now?
          </p>
        )}

        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition"
          >
            Keep Reviewing
          </button>
          <button
            onClick={onConfirmSubmit}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs transition flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Submit Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
