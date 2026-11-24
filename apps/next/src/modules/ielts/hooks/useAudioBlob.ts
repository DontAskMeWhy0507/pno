import { useState, useEffect } from 'react';

const MAX_AUDIO_CACHE_ENTRIES = 5;
const audioBlobCache = new Map<string, string>();

function getCachedAudioBlob(key: string): string | undefined {
  const existing = audioBlobCache.get(key);
  if (!existing) return undefined;
  // Refresh LRU order
  audioBlobCache.delete(key);
  audioBlobCache.set(key, existing);
  return existing;
}

function setCachedAudioBlob(key: string, objectUrl: string) {
  if (audioBlobCache.has(key)) {
    audioBlobCache.delete(key);
  } else if (audioBlobCache.size >= MAX_AUDIO_CACHE_ENTRIES) {
    const oldestKey = audioBlobCache.keys().next().value;
    if (oldestKey) {
      const oldestUrl = audioBlobCache.get(oldestKey);
      audioBlobCache.delete(oldestKey);
      if (oldestUrl && oldestUrl.startsWith('blob:')) {
        URL.revokeObjectURL(oldestUrl);
      }
    }
  }
  audioBlobCache.set(key, objectUrl);
}

/**
 * useAudioBlob
 * Fetches audio via fetch with anti-IDM headers and creates an in-memory blob: URL
 * backed by a small LRU cache so switching IELTS Listening parts plays instantly.
 */
export function useAudioBlob(audioUrl?: string) {
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!audioUrl) {
      setBlobUrl('');
      setError(null);
      setIsLoading(false);
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

    if (
      normalized.startsWith('blob:') ||
      normalized.startsWith('data:') ||
      normalized.startsWith('http://') ||
      normalized.startsWith('https://')
    ) {
      setBlobUrl(normalized);
      setError(null);
      setIsLoading(false);
      return;
    }

    const cached = getCachedAudioBlob(normalized);
    if (cached) {
      setBlobUrl(cached);
      setError(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    const controller = new AbortController();

    const fetchBlob = async () => {
      setIsLoading(true);
      setError(null);

      const candidates: string[] = [];
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
              Accept: 'audio/*, video/mp4;q=0.9, */*;q=0.8',
            },
          });

          if (res.ok) {
            const blob = await res.blob();
            if (active) {
              const objectUrl = URL.createObjectURL(blob);
              setCachedAudioBlob(normalized, objectUrl);
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
        setBlobUrl(normalized);
        setError('Audio could not be preloaded. Trying the original source instead.');
      }

      if (active) {
        setIsLoading(false);
      }
    };

    void fetchBlob();

    return () => {
      active = false;
      controller.abort();
    };
  }, [audioUrl]);

  return { blobUrl, isLoading, error };
}
