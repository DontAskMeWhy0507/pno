import { useState, useEffect, type FC } from 'react';
import { Clock, Maximize2, Minimize2, Pause, Play, Settings, ArrowLeft, CheckCircle2 } from 'lucide-react';

interface ExamHeaderProps {
  examTitle: string;
  durationMinutes: number;
  timeRemaining: number;
  isPaused: boolean;
  onTogglePause: () => void;
  onOpenTestManager: () => void;
  onBackToHome: () => void;
  onOpenLeaveModal?: () => void;
  fontSize: 'sm' | 'base' | 'lg';
  onChangeFontSize: (size: 'sm' | 'base' | 'lg') => void;
}

export const ExamHeader: FC<ExamHeaderProps> = ({
  examTitle,
  timeRemaining,
  isPaused,
  onTogglePause,
  onOpenTestManager,
  onBackToHome,
  onOpenLeaveModal,
  fontSize,
  onChangeFontSize,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const isTimeCritical = timeRemaining <= 300; // Under 5 minutes

  const handleHomeClick = () => {
    if (onOpenLeaveModal) {
      onOpenLeaveModal();
    } else {
      if (window.confirm('Return to Home? Your exam progress is automatically saved and you can resume anytime.')) {
        onBackToHome();
      }
    }
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between shadow-xs select-none">
      {/* Left side: Back to Home & Logo & Title */}
      <div className="flex items-center space-x-3">
        <button
          onClick={handleHomeClick}
          className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition font-semibold"
          title="Return to Home (Progress is auto-saved)"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Home</span>
        </button>

        {/* PNO Badge */}
        <div className="px-2.5 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-extrabold text-xs shadow-xs tracking-wider">
          PNO
        </div>
        <div className="flex flex-col">
          <h1 className="text-sm font-bold tracking-tight text-gray-900 uppercase">
            {examTitle}
          </h1>
          {/* Timer display */}
          <div className="flex items-center space-x-2">
            <span
              className={`text-xs font-semibold flex items-center gap-1 ${
                isTimeCritical ? 'text-red-600 animate-pulse font-bold' : 'text-gray-600'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>
                {minutes}m {seconds < 10 ? `0${seconds}` : seconds}s left
              </span>
            </span>
            <button
              onClick={onTogglePause}
              title={isPaused ? 'Resume' : 'Pause timer'}
              className="text-gray-400 hover:text-gray-700 transition"
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-amber-600" /> : <Pause className="w-3.5 h-3.5" />}
            </button>

            {/* Live Autosave Indicator */}
            <span
              className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"
              title="All answers and time are saved automatically in your browser"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Auto-saved</span>
            </span>
          </div>
        </div>
      </div>

      {/* Right side: Tools & Navigation */}
      <div className="flex items-center space-x-2">
        {/* Font size picker */}
        <div className="flex items-center bg-gray-100 rounded-md p-0.5 border border-gray-200 text-xs">
          <button
            onClick={() => onChangeFontSize('sm')}
            className={`px-2 py-0.5 rounded ${fontSize === 'sm' ? 'bg-white shadow-xs font-bold text-gray-900' : 'text-gray-500'}`}
            title="Small text"
          >
            A-
          </button>
          <button
            onClick={() => onChangeFontSize('base')}
            className={`px-2 py-0.5 rounded ${fontSize === 'base' ? 'bg-white shadow-xs font-bold text-gray-900' : 'text-gray-500'}`}
            title="Normal text"
          >
            A
          </button>
          <button
            onClick={() => onChangeFontSize('lg')}
            className={`px-2 py-0.5 rounded ${fontSize === 'lg' ? 'bg-white shadow-xs font-bold text-gray-900' : 'text-gray-500'}`}
            title="Large text"
          >
            A+
          </button>
        </div>

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded text-gray-600 hover:bg-gray-100 transition"
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Test Library / Admin Button */}
        <button
          onClick={onOpenTestManager}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition"
          title="Manage and create tests"
        >
          <Settings className="w-3.5 h-3.5 text-gray-600" />
          <span>Test Bank</span>
        </button>
      </div>
    </header>
  );
};
