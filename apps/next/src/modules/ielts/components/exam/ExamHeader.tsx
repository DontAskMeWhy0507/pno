import { useState, useEffect, type FC } from 'react';
import { useColorMode } from '@chakra-ui/react';
import { Clock, Maximize2, Minimize2, Pause, Play, Settings, ArrowLeft, CheckCircle2, Sun, Moon } from 'lucide-react';

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
  const { colorMode, toggleColorMode } = useColorMode();

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
      onBackToHome();
    }
  };

  return (
    <header className="min-h-14 py-1.5 sm:py-0 sm:h-14 bg-white border-b-2 border-gray-200 px-2.5 sm:px-4 flex items-center justify-between gap-2 shadow-xs select-none shrink-0">
      {/* Left side: Back to Home & Logo & Title */}
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
        <button
          onClick={handleHomeClick}
          className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-900 px-2 sm:px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition font-semibold shrink-0"
          title="Return to Home (Progress is auto-saved)"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Home</span>
        </button>

        {/* PNO Badge */}
        <div className="hidden xs:flex sm:flex px-2 sm:px-2.5 h-7 sm:h-8 rounded-xl bg-blue-600 items-center justify-center text-white font-extrabold text-[11px] sm:text-xs shadow-xs tracking-wider shrink-0">
          PNO
        </div>
        <div className="flex flex-col min-w-0">
          <h1 className="text-xs sm:text-sm font-bold tracking-tight text-gray-900 uppercase truncate">
            {examTitle}
          </h1>
          {/* Timer display */}
          <div className="flex items-center space-x-2">
            <span
              className={`text-[11px] sm:text-xs font-semibold flex items-center gap-1 whitespace-nowrap ${
                isTimeCritical ? 'text-red-600 animate-pulse font-bold' : 'text-gray-600'
              }`}
            >
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>
                {minutes}m {seconds < 10 ? `0${seconds}` : seconds}s
                <span className="hidden sm:inline"> left</span>
              </span>
            </span>
            <button
              onClick={onTogglePause}
              title={isPaused ? 'Resume' : 'Pause timer'}
              className="text-gray-400 hover:text-gray-700 transition p-0.5"
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-amber-600" /> : <Pause className="w-3.5 h-3.5" />}
            </button>

            {/* Live Autosave Indicator */}
            <span
              className="hidden md:inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"
              title="All answers and time are saved automatically in your browser"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Auto-saved</span>
            </span>
          </div>
        </div>
      </div>

      {/* Right side: Tools & Navigation */}
      <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
        {/* Compact font size cycle button on < sm */}
        <button
          onClick={() =>
            onChangeFontSize(
              fontSize === 'sm' ? 'base' : fontSize === 'base' ? 'lg' : 'sm'
            )
          }
          className="sm:hidden px-2 py-1 rounded-xl bg-gray-100 border border-gray-200 text-xs font-bold text-gray-700"
          title="Cycle text size"
        >
          {fontSize === 'sm' ? 'A-' : fontSize === 'lg' ? 'A+' : 'A'}
        </button>

        {/* Font size picker (Desktop / Tablet) */}
        <div className="hidden sm:flex items-center bg-gray-100 rounded-xl p-0.5 border border-gray-200 text-xs">
          <button
            onClick={() => onChangeFontSize('sm')}
            className={`px-1.5 sm:px-2 py-0.5 rounded-lg ${fontSize === 'sm' ? 'bg-white shadow-xs font-bold text-gray-900' : 'text-gray-500'}`}
            title="Small text"
          >
            A-
          </button>
          <button
            onClick={() => onChangeFontSize('base')}
            className={`px-1.5 sm:px-2 py-0.5 rounded-lg ${fontSize === 'base' ? 'bg-white shadow-xs font-bold text-gray-900' : 'text-gray-500'}`}
            title="Normal text"
          >
            A
          </button>
          <button
            onClick={() => onChangeFontSize('lg')}
            className={`px-1.5 sm:px-2 py-0.5 rounded-lg ${fontSize === 'lg' ? 'bg-white shadow-xs font-bold text-gray-900' : 'text-gray-500'}`}
            title="Large text"
          >
            A+
          </button>
        </div>

        {/* Light / Dark Mode Switcher */}
        <button
          onClick={toggleColorMode}
          className="p-1.5 rounded-xl text-gray-600 hover:bg-gray-100 transition"
          title={colorMode === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
        >
          {colorMode === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Fullscreen Button (Desktop) */}
        <button
          onClick={toggleFullscreen}
          className="hidden md:inline-flex p-1.5 rounded-xl text-gray-600 hover:bg-gray-100 transition"
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Test Library / Admin Button */}
        <button
          onClick={onOpenTestManager}
          className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl border border-gray-300 transition"
          title="Manage and create tests"
        >
          <Settings className="w-3.5 h-3.5 text-gray-600" />
          <span className="hidden sm:inline">Test Bank</span>
        </button>
      </div>
    </header>
  );
};
