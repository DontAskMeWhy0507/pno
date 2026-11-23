import type { FC } from 'react';
import { BookmarkCheck, Clock, CheckCircle2, RotateCcw, ArrowLeft } from 'lucide-react';

interface LeaveExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAndExit: () => void;
  onDiscardAndExit: () => void;
  examTitle: string;
  totalQuestions: number;
  answeredCount: number;
  timeRemaining: number;
}

export const LeaveExamModal: FC<LeaveExamModalProps> = ({
  isOpen,
  onClose,
  onSaveAndExit,
  onDiscardAndExit,
  examTitle,
  totalQuestions,
  answeredCount,
  timeRemaining,
}) => {
  if (!isOpen) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-11 h-11 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <BookmarkCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-tight">
              Leave & Resume Later?
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Your test progress is automatically saved to your browser.
            </p>
          </div>
        </div>

        {/* Status card */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-2.5 text-xs mb-5">
          <div className="font-semibold text-slate-800 line-clamp-1 border-b border-slate-200 pb-2">
            {examTitle}
          </div>

          <div className="flex justify-between items-center text-slate-600">
            <span>Questions answered:</span>
            <span className="font-bold text-blue-600 text-sm">
              {answeredCount} / {totalQuestions}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-600">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Time remaining:</span>
            </span>
            <span className="font-semibold text-slate-800">
              {minutes}m {seconds < 10 ? `0${seconds}` : seconds}s
            </span>
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center gap-1.5 text-emerald-700 font-medium bg-emerald-50/80 -mx-1 px-2.5 py-1.5 rounded">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Auto-saved. You can return and continue anytime.</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2.5">
          <button
            onClick={onSaveAndExit}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Save Progress & Return to Home</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-slate-300 transition"
          >
            Keep Working on Test
          </button>

          <div className="text-center pt-1">
            <button
              onClick={onDiscardAndExit}
              className="text-[11px] text-slate-400 hover:text-rose-600 transition flex items-center justify-center gap-1 mx-auto"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Discard saved progress & start fresh next time</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
