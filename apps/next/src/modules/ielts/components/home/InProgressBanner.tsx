import type { FC } from 'react';
import type { Exam } from '../../types/exam';
import type { WritingExam } from '../../types/writing';
import { Play, Trash2 } from 'lucide-react';

export interface InProgressItem {
  id: string;
  title: string;
  skill: 'reading' | 'listening' | 'writing';
  collection?: string;
  answeredCount: number;
  totalQuestions: number;
  timeRemaining: number;
  lastSavedAt: number;
  activePartNumber?: number;
  currentQuestionNumber?: number;
  task1Words?: number;
  task2Words?: number;
  rawExam?: Exam;
  rawWritingExam?: WritingExam;
}

interface InProgressBannerProps {
  items: InProgressItem[];
  onResumeExam: (exam: Exam) => void;
  onResumeWriting: (exam: WritingExam) => void;
  onDiscardExam: (id: string, title: string) => void;
  onDiscardWriting: (id: string, title: string) => void;
}

export const InProgressBanner: FC<InProgressBannerProps> = ({
  items,
  onResumeExam,
  onResumeWriting,
  onDiscardExam,
  onDiscardWriting,
}) => {
  if (items.length === 0) return null;

  return (
    <aside
      aria-label="In-progress tests"
      className="space-y-1.5 animate-in fade-in duration-150"
    >
      {items.map((item) => {
        const isWriting = item.skill === 'writing';
        const mins = Math.floor(item.timeRemaining / 60);

        return (
          <div
            key={`${item.skill}-${item.id}`}
            className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 bg-emerald-50/70 border border-emerald-200/90 rounded-xl shadow-2xs hover:bg-emerald-50 transition"
          >
            {/* Left: Indicator & Compact Test Info */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" aria-hidden="true" />
              
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white text-emerald-800 border border-emerald-300 shrink-0">
                {item.skill}
              </span>

              <span className="text-xs font-semibold text-slate-800 truncate" title={item.title}>
                {item.title}
              </span>

              <span className="hidden sm:inline-flex items-center text-[11px] text-slate-500 shrink-0">
                • {isWriting
                  ? `Draft: ${(item.task1Words || 0) + (item.task2Words || 0)} words`
                  : `${item.answeredCount}/${item.totalQuestions} answered`} ({mins}m left)
              </span>
            </div>

            {/* Right: Symmetrical Compact Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (isWriting && item.rawWritingExam) {
                    onResumeWriting(item.rawWritingExam);
                  } else if (item.rawExam) {
                    onResumeExam(item.rawExam);
                  }
                }}
                className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-2xs transition flex items-center gap-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
                aria-label={`Resume ${item.title}`}
              >
                <Play className="w-3 h-3 fill-white" aria-hidden="true" />
                <span>Resume</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isWriting) {
                    onDiscardWriting(item.id, item.title);
                  } else {
                    onDiscardExam(item.id, item.title);
                  }
                }}
                className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 hover:border-rose-200 transition flex items-center gap-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
                title="Discard saved progress"
                aria-label={`Discard progress for ${item.title}`}
              >
                <Trash2 className="w-3 h-3 text-rose-500" aria-hidden="true" />
                <span>Discard</span>
              </button>
            </div>
          </div>
        );
      })}
    </aside>
  );
};
