import { useState, useRef, useEffect, type FC } from 'react';
import { Play, Pause, Volume2, VolumeX, Link as LinkIcon, Upload, Loader2, Check, AlertCircle } from 'lucide-react';
import { uploadMediaFile } from '../../utils/mediaUploader';
import { useAudioBlob } from '../../hooks/useAudioBlob';

interface ListeningAudioBarProps {
  audioUrl?: string;
  sectionTitle: string;
  partNumber: number;
  testId?: string;
  onAudioChange?: (newUrl: string) => void;
}

export const ListeningAudioBar: FC<ListeningAudioBarProps> = ({
  audioUrl,
  sectionTitle,
  partNumber: _partNumber,
  testId,
  onAudioChange,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Load via in-memory blob to completely prevent IDM (Internet Download Manager) interception
  const { blobUrl: safeAudioSrc, isLoading: isPreloadingAudio, error: preloadError } = useAudioBlob(audioUrl);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [customUrl, setCustomUrl] = useState(audioUrl || '');
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Normalize audio URL to ensure leading slash for local paths
  const normalizeUrl = (url?: string) => {
    if (!url) return '';
    const trimmed = url.trim();
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('/')
    ) {
      return trimmed;
    }
    return '/' + trimmed;
  };

  const prevAudioUrlRef = useRef<string | undefined>(safeAudioSrc);

  useEffect(() => {
    setCustomUrl(audioUrl || '');
    if (prevAudioUrlRef.current !== safeAudioSrc) {
      prevAudioUrlRef.current = safeAudioSrc;
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setAudioError(preloadError);
    }
  }, [safeAudioSrc, audioUrl, preloadError]);

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setAudioError(null);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  const handleAudioError = () => {
    setIsPlaying(false);
    setAudioError('Audio file could not be loaded. Please click the link icon to check path or upload audio.');
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      const p = audio.play();
      if (p !== undefined) {
        p.then(() => {
          setIsPlaying(true);
          setAudioError(null);
        }).catch((err) => {
          console.warn('Audio playback rejected:', err);
          setIsPlaying(false);
          if (err.name === 'NotAllowedError') {
            setAudioError('Browser blocked autoplay. Click play to listen.');
          } else {
            setAudioError('Audio playback failed. Please check audio file.');
          }
        });
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = parseFloat(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 0.75];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx] ?? 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) audioRef.current.playbackRate = nextRate;
  };

  const fmt = (s: number) => {
    if (isNaN(s) || !isFinite(s)) return '00:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const handleSaveCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrl.trim() && onAudioChange) {
      onAudioChange(normalizeUrl(customUrl.trim()));
    }
    setShowUrlModal(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadSuccess(null);
    setAudioError(null);

    try {
      const result = await uploadMediaFile(file, 'listening', testId || 'listening-test');
      setCustomUrl(result.url);
      if (onAudioChange) {
        onAudioChange(result.url);
      }
      setUploadSuccess(`Saved to web folder: ${result.url}`);
      setTimeout(() => {
        setUploadSuccess(null);
        setShowUrlModal(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to upload audio:', err);
      setAudioError('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-12 py-2 sm:py-0 sm:h-12 bg-white border-t-2 border-gray-200 px-3 sm:px-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-y-1.5 gap-x-2 text-gray-800 text-xs select-none z-20 shrink-0 shadow-xs relative">
      {/* HTML5 Audio Element (Uses in-memory blob to prevent IDM interception) */}
      {safeAudioSrc && (
        <audio
          ref={audioRef}
          src={safeAudioSrc}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={handleAudioError}
          preload="auto"
        />
      )}

      {/* Left side: Play/Pause Button + Section Title */}
      <div className="flex items-center gap-2.5 shrink-0 sm:mr-2 max-w-full">
        <button
          onClick={togglePlay}
          disabled={isPreloadingAudio}
          className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition shadow-2xs shrink-0 ${
            isPlaying
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-800'
          } ${isPreloadingAudio ? 'opacity-70 cursor-wait' : ''}`}
          title={isPreloadingAudio ? 'Loading audio into memory...' : isPlaying ? 'Pause Audio' : 'Play Audio'}
        >
          {isPreloadingAudio ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
          ) : isPlaying ? (
            <Pause className="w-3.5 h-3.5 fill-white" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-gray-800 ml-0.5" />
          )}
        </button>

        <span className="font-bold text-xs sm:text-[13px] text-gray-800 tracking-tight truncate max-w-[140px] sm:max-w-[200px]">
          {sectionTitle}
        </span>

        {audioError && (
          <span
            onClick={() => setShowUrlModal(true)}
            className="text-[10px] text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg cursor-pointer hover:bg-rose-100 flex items-center gap-1 shrink-0 font-semibold"
            title={audioError}
          >
            <AlertCircle className="w-3 h-3 text-rose-500" />
            <span className="hidden sm:inline">Audio Error — Click to fix</span>
            <span className="sm:hidden">Fix</span>
          </span>
        )}
      </div>

      {/* Center: Timeline Progress Scrubber */}
      <div className="order-3 sm:order-2 w-full sm:w-auto sm:flex-1 sm:mx-2 flex items-center">
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-2 sm:h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>

      {/* Right side: Time, Volume, Speed, URL Link */}
      <div className="order-2 sm:order-3 flex items-center gap-2 sm:gap-3 shrink-0 sm:ml-2">
        {/* Time format: 00:10 / 06:08 */}
        <span className="font-mono text-[11px] text-gray-600 font-bold min-w-[70px] sm:min-w-[75px] text-right">
          {fmt(currentTime)} / {fmt(duration)}
        </span>

        {/* Volume (hide slider on small phones which use hardware volume buttons) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleMute}
            className="text-gray-600 hover:text-gray-900 transition p-1 rounded-lg hover:bg-gray-100"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="hidden sm:block w-14 h-1.5 rounded-lg accent-blue-600 cursor-pointer bg-gray-200"
          />
        </div>

        {/* Playback speed pill */}
        <button
          onClick={cyclePlaybackRate}
          className="px-2 py-1 rounded-lg border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 text-[11px] font-bold text-gray-700 transition"
          title="Change playback speed"
        >
          {playbackRate}x
        </button>

        {/* Change / Inspect Audio URL */}
        <button
          onClick={() => setShowUrlModal(true)}
          className="text-gray-500 hover:text-gray-800 transition p-1 rounded-lg hover:bg-gray-100"
          title="Audio Source URL & Upload"
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* URL Edit & Upload Modal */}
      {showUrlModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-5 max-w-md w-full border border-gray-200 animate-in fade-in zoom-in-95">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Audio Source Configuration</h3>
            <p className="text-xs text-gray-500 mb-3">
              Direct audio URL or upload an audio file to the website folder:
            </p>

            <form onSubmit={handleSaveCustomUrl} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Audio Path / Web URL:</label>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="/audio/vol9/test1.mp3 or /tests/listening/.../audio/..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {/* Upload to web folder button */}
              <div>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="audio/*,video/mp4"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span>Saving to Web Folder...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 text-slate-600" />
                      <span>Upload Audio File from Computer</span>
                    </>
                  )}
                </button>
              </div>

              {uploadSuccess && (
                <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUrlModal(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold"
                >
                  Save URL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
