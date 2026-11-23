import React, { useState, useRef, useCallback, useEffect } from 'react';
import { BookOpen, ListChecks } from 'lucide-react';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftPercent?: number;
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  left,
  right,
  defaultLeftPercent = 50,
}) => {
  const [leftPercent, setLeftPercent] = useState<number>(defaultLeftPercent);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'passage' | 'questions'>('passage');
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handleChange = () => setIsDesktop(mq.matches);
    handleChange();
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const newPercent = (offsetX / rect.width) * 100;
      if (newPercent >= 25 && newPercent <= 75) {
        setLeftPercent(newPercent);
      }
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="flex-1 flex flex-col w-full h-full overflow-hidden">
      {/* Mobile Tab Switcher (< 768px) */}
      {!isDesktop && (
        <div className="flex items-center bg-slate-100 border-b border-gray-200 px-2 py-1.5 gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab('passage')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition ${
              mobileTab === 'passage'
                ? 'bg-white text-blue-700 shadow-xs border border-blue-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Bài đọc (Passage)</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('questions')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition ${
              mobileTab === 'questions'
                ? 'bg-white text-blue-700 shadow-xs border border-blue-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            <span>Câu hỏi (Questions)</span>
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className={`flex-1 flex w-full h-full overflow-hidden ${
          isDragging ? 'cursor-col-resize select-none' : ''
        }`}
      >
        {/* Left Pane: Passage */}
        <div
          style={isDesktop ? { width: `${leftPercent}%` } : undefined}
          className={`${
            isDesktop
              ? 'h-full overflow-hidden border-r border-gray-200'
              : mobileTab === 'passage'
              ? 'w-full h-full overflow-hidden'
              : 'hidden'
          }`}
        >
          {left}
        </div>

        {/* Resizer bar (Desktop only) */}
        {isDesktop && (
          <div
            onMouseDown={handleMouseDown}
            onDoubleClick={() => setLeftPercent(50)}
            title="Kéo sang hai bên để chỉnh độ rộng. Nháy đúp để cân bằng 50/50"
            className={`split-divider ${isDragging ? 'dragging' : ''}`}
          />
        )}

        {/* Right Pane: Questions */}
        <div
          style={isDesktop ? { width: `${100 - leftPercent}%` } : undefined}
          className={`${
            isDesktop
              ? 'h-full overflow-y-auto px-6 py-6 bg-white font-sans text-gray-900'
              : mobileTab === 'questions'
              ? 'w-full h-full overflow-y-auto px-4 py-4 bg-white font-sans text-gray-900'
              : 'hidden'
          }`}
        >
          {right}
        </div>
      </div>
    </div>
  );
};
