import React, { useState, useRef, useCallback, useEffect } from 'react';

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
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div
      ref={containerRef}
      className={`flex-1 flex w-full h-full overflow-hidden ${
        isDragging ? 'cursor-col-resize select-none' : ''
      }`}
    >
      {/* Left Pane: Passage */}
      <div
        style={{ width: `${leftPercent}%` }}
        className="h-full overflow-hidden border-r border-gray-200"
      >
        {left}
      </div>

      {/* Resizer bar */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={() => setLeftPercent(50)}
        title="Kéo sang hai bên để chỉnh độ rộng. Nháy đúp để cân bằng 50/50"
        className={`split-divider ${isDragging ? 'dragging' : ''}`}
      />

      {/* Right Pane: Questions */}
      <div
        style={{ width: `${100 - leftPercent}%` }}
        className="h-full overflow-y-auto px-6 py-6 bg-white font-sans text-gray-900"
      >
        {right}
      </div>
    </div>
  );
};
