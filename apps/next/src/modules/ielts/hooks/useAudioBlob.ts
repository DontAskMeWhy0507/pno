import { useState, useEffect } from 'react';

/**
 * useAudioBlob
 * Fetches audio via XMLHttpRequest / fetch with anti-IDM headers,
 * and creates an in-memory blob: URL.
 * 
 * WHY:
 * Internet Download Manager (IDM) on Windows intercepts direct HTTP requests
 * for files ending in .mp3 or .mp4, popping up a download modal and breaking
 * in-browser audio playback.
 * 
 * By fetching the audio as a Blob with `X-Requested-With: XMLHttpRequest`,
 * IDM ignores the request, and the resulting `blob:http://...` URL is played
 * from browser memory where IDM cannot intercept it.
 */
export function useAudioBlob(audioUrl?: string) {
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!audioUrl) {
      setBlobUrl('');
      setError(null);
      return;
    }

    const trimmed = audioUrl.trim();
    const normalized =
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('/')
        ? trimmed
        : '/' + trimmed;

    // If already blob or data URL, no fetch needed
    if (normalized.startsWith('blob:') || normalized.startsWith('data:')) {
      setBlobUrl(normalized);
      setError(null);
      return;
    }

    let active = true;
    let objectUrl = '';
    const controller = new AbortController();

    const fetchBlob = async () => {
      setIsLoading(true);
      setError(null);

      // Candidates: try .mp3 first if mp4 (faster, pure audio), then original
      const candidates = [];
      if (normalized.endsWith('.mp4')) {
        candidates.push(normalized.replace(/\.mp4$/, '.mp3'));
      }
      candidates.push(normalized);

      let success = false;
      for (const candidate of candidates) {
        try {
          const res = await fetch(candidate, {
            signal: controller.signal,
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              'Accept': 'audio/*, video/mp4;q=0.9, */*;q=0.8',
            },
          });

          if (res.ok) {
            const blob = await res.blob();
            if (active) {
              objectUrl = URL.createObjectURL(blob);
              setBlobUrl(objectUrl);
              success = true;
              break;
            }
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
          console.warn(`Failed fetching audio candidate ${candidate}:`, err);
        }
      }

      if (!success && active) {
        // Fallback to direct URL if fetch failed (e.g. CORS on external URL)
        setBlobUrl(normalized);
        setError('Audio could not be preloaded. Trying the original source instead.');
      }

      if (active) {
        setIsLoading(false);
      }
    };

    fetchBlob();

    return () => {
      active = false;
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [audioUrl]);

  return { blobUrl, isLoading, error };
}
