import { useState, useRef, useEffect, type FC } from 'react';
import {
  Play, Pause, Volume2, VolumeX, RotateCcw, SkipBack, SkipForward,
  ExternalLink, Music2, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';

interface AudioPlayerProps {
  sectionTitle: string;
  sectionSubtitle?: string;
  transcript?: string;      // Optional transcript / context notes
  audioUrl?: string;        // Optional MP3 / audio source URL
  partNumber: number;
  totalParts: number;
  fontSize: 'sm' | 'base' | 'lg';
  onGoToPart?: (partNum: number) => void;
}

export const AudioPlayer: FC<AudioPlayerProps> = ({
  sectionTitle,
  sectionSubtitle,
  transcript,
  audioUrl,
  partNumber,
  totalParts,
  fontSize,
  onGoToPart,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  // ── Playback state ────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioLoaded, setAudioLoaded] = useState(false);

  // ── URL input state ────────────────────────────────────────────────────────
  const [customUrl, setCustomUrl] = useState(audioUrl || '');
  const [activeUrl, setActiveUrl] = useState(audioUrl || '');
  const [showUrlInput, setShowUrlInput] = useState(!audioUrl);

  // ── Transcript expand state ────────────────────────────────────────────────
  const [showTranscript, setShowTranscript] = useState(true);

  useEffect(() => {
    setCustomUrl(audioUrl || '');
    setActiveUrl(audioUrl || '');
    setShowUrlInput(!audioUrl);
    setAudioError(null);
    setAudioLoaded(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [audioUrl, partNumber]);

  // ── Audio element event handlers ─────────────────────────────────────────
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setAudioLoaded(true);
      setAudioError(null);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleEnded = () => setIsPlaying(false);

  const handleAudioError = () => {
    setAudioError('Cannot load audio. Check the URL and try again.');
    setAudioLoaded(false);
    setIsPlaying(false);
  };

  // ── Controls ────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !activeUrl) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => setAudioError('Playback blocked by browser. Click play again.'));
      setIsPlaying(true);
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = parseFloat(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  };

  const rewind = (secs: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - secs);
  };

  const forward = (secs: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(duration, audio.currentTime + secs);
  };

  const restart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
  };

  const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    setIsMuted(v === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !isMuted;
    setIsMuted(next);
    audio.muted = next;
  };

  const changeRate = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  };

  const applyUrl = () => {
    const trimmed = customUrl.trim();
    if (!trimmed) return;
    setActiveUrl(trimmed);
    setAudioError(null);
    setAudioLoaded(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setShowUrlInput(false);
  };

  // ── Formatting helpers ────────────────────────────────────────────────────
  const fmt = (s: number) => {
    if (isNaN(s) || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const fontClass = { sm: 'text-[14px] leading-relaxed', base: 'text-[15px] leading-relaxed', lg: 'text-[17px] leading-[1.8]' }[fontSize];

  const paragraphs = (transcript || '').split('\n').filter(l => l.trim());

  return (
    <div className="h-full overflow-y-auto bg-[#1e2128] text-white flex flex-col select-none">

      {/* ── Section Header ─────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 border-b border-white/10 space-y-1 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
            <Music2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate">{sectionTitle}</h2>
            {sectionSubtitle && (
              <p className="text-[11px] text-white/50 truncate">{sectionSubtitle}</p>
            )}
          </div>
        </div>

        {/* Part navigation pills */}
        {totalParts > 1 && onGoToPart && (
          <div className="flex items-center gap-1 pt-1">
            {Array.from({ length: totalParts }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => onGoToPart(n)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition ${
                  n === partNumber
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                S{n}
              </button>
            ))}
            <span className="text-[10px] text-white/30 ml-1">sections</span>
          </div>
        )}
      </div>

      {/* ── Audio Player ───────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-white/10 space-y-4 shrink-0 bg-[#16181e]">

        {/* URL Input */}
        {showUrlInput ? (
          <div className="space-y-2">
            <p className="text-[11px] text-white/50 font-medium">
              Paste an audio URL (MP3 direct link) to enable the player:
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyUrl()}
                placeholder="https://example.com/audio.mp3"
                className="flex-1 text-[12px] bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/30 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={applyUrl}
                disabled={!customUrl.trim()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold rounded-lg transition disabled:opacity-40"
              >
                Load
              </button>
            </div>
            {activeUrl && !showUrlInput && (
              <button onClick={() => setShowUrlInput(true)} className="text-[11px] text-blue-400 hover:text-blue-300 underline">
                Change URL
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-white/40 truncate flex-1 mr-2">{activeUrl}</span>
            <button onClick={() => setShowUrlInput(true)} className="text-[11px] text-blue-400 hover:text-blue-300 underline shrink-0 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> Change
            </button>
          </div>
        )}

        {/* Hidden audio element */}
        {activeUrl && (
          <audio
            ref={audioRef}
            src={activeUrl}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onError={handleAudioError}
            preload="metadata"
          />
        )}

        {/* Error */}
        {audioError && (
          <div className="flex items-center gap-2 text-[11px] text-rose-300 bg-rose-900/30 border border-rose-700/40 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{audioError}</span>
          </div>
        )}

        {/* No audio notice */}
        {!activeUrl && (
          <div className="flex items-center gap-2 text-[11px] text-amber-300/80 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>No audio linked. Practice with the transcript below, or paste an MP3 URL above.</span>
          </div>
        )}

        {/* Progress bar */}
        <div className="space-y-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={seek}
            disabled={!audioLoaded}
            className="w-full h-1.5 accent-blue-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          />
          <div className="flex justify-between text-[10px] text-white/40">
            <span>{fmt(currentTime)}</span>
            <span>{audioLoaded ? fmt(duration) : '--:--'}</span>
          </div>
        </div>

        {/* Main controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={restart} className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition" title="Restart">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={() => rewind(10)} className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition" title="Rewind 10s">
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={togglePlay}
              disabled={!activeUrl}
              className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition shadow-lg"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button onClick={() => forward(10)} className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition" title="Forward 10s">
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Speed */}
          <div className="flex items-center gap-1">
            {[0.75, 1, 1.25, 1.5].map(r => (
              <button
                key={r}
                onClick={() => changeRate(r)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                  playbackRate === r ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white hover:bg-white/10'
                }`}
              >
                {r}×
              </button>
            ))}
          </div>

          {/* Volume */}
          <div className="flex items-center gap-1.5">
            <button onClick={toggleMute} className="text-white/50 hover:text-white transition">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={changeVolume}
              className="w-20 h-1 accent-blue-500 cursor-pointer"
            />
          </div>
        </div>

        {/* IELTS reminder */}
        <div className="text-[10px] text-white/25 text-center pt-0.5">
          ⚠️ In the real IELTS Listening test, audio plays once only and cannot be paused.
        </div>
      </div>

      {/* ── Transcript / Context ──────────────────────────────────────────── */}
      {paragraphs.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <button
            onClick={() => setShowTranscript(p => !p)}
            className="w-full flex items-center justify-between px-5 py-3 text-[11px] font-semibold text-white/50 hover:text-white/80 hover:bg-white/5 transition border-b border-white/10"
          >
            <span>📋 Section Notes &amp; Context</span>
            {showTranscript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showTranscript && (
            <div className={`px-5 py-4 space-y-3 text-white/70 font-mono select-text ${fontClass}`}>
              {paragraphs.map((line, i) => {
                if (line.startsWith('[')) {
                  return (
                    <p key={i} className="text-blue-400 font-semibold text-[12px] uppercase tracking-wide">
                      {line}
                    </p>
                  );
                }
                return <p key={i}>{line}</p>;
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty state when no transcript either */}
      {paragraphs.length === 0 && !activeUrl && (
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <div className="space-y-3">
            <Music2 className="w-12 h-12 text-white/10 mx-auto" />
            <p className="text-white/30 text-sm">Add an audio URL above to start this listening section.</p>
          </div>
        </div>
      )}
    </div>
  );
};
