/**
 * Media Uploader Utility
 * Uploads media files (audio/images) directly into the website's folder structure
 * under `public/tests/[skill]/[testId]/[audio|pic]/[filename]` without temporary session warnings.
 */

export interface UploadMediaResult {
  url: string;
  filename: string;
  size: number;
  source: 'server' | 'base64';
}

export interface MediaEmbedInfo {
  kind: 'youtube' | 'video' | 'audio' | 'image';
  embedUrl: string;
}

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Normalizes image, audio, direct video, or YouTube URLs into safe embed metadata.
 * Only permits relative paths (`/`) or `http:` / `https:` / `data:image/` URLs.
 */
export function extractMediaEmbedInfo(
  rawUrl: string,
  hint?: 'image' | 'video' | 'audio'
): MediaEmbedInfo | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data:image/')) {
    return { kind: 'image', embedUrl: trimmed };
  }
  if (trimmed.startsWith('data:video/')) {
    return { kind: 'video', embedUrl: trimmed };
  }
  if (trimmed.startsWith('data:audio/')) {
    return { kind: 'audio', embedUrl: trimmed };
  }

  const isRelative = trimmed.startsWith('/');
  if (!isRelative) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'youtube.com' || host === 'm.youtube.com') {
        if (parsed.pathname === '/watch') {
          const id = parsed.searchParams.get('v') || '';
          if (YOUTUBE_ID_RE.test(id)) {
            return { kind: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}` };
          }
        }
        const embedMatch = parsed.pathname.match(/^\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
        if (embedMatch?.[1]) {
          return { kind: 'youtube', embedUrl: `https://www.youtube.com/embed/${embedMatch[1]}` };
        }
      } else if (host === 'youtu.be') {
        const id = parsed.pathname.slice(1).split('/')[0] || '';
        if (YOUTUBE_ID_RE.test(id)) {
          return { kind: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}` };
        }
      } else if (host === 'youtube-nocookie.com') {
        const embedMatch = parsed.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/);
        if (embedMatch?.[1]) {
          return { kind: 'youtube', embedUrl: `https://www.youtube.com/embed/${embedMatch[1]}` };
        }
      }
    } catch {
      return null;
    }
  }

  const lower = trimmed.split('?')[0]?.toLowerCase() || '';
  if (hint === 'video' || /\.(mp4|webm|mov|m4v)$/.test(lower)) {
    return { kind: 'video', embedUrl: trimmed };
  }
  if (hint === 'audio' || /\.(mp3|wav|m4a|ogg)$/.test(lower)) {
    return { kind: 'audio', embedUrl: trimmed };
  }
  return { kind: hint || 'image', embedUrl: trimmed };
}

const MAX_LOCAL_MEDIA_BYTES = 1024 * 1024;

export async function uploadMediaFile(
  file: File,
  skill: 'listening' | 'reading' | 'writing' | 'speaking' = 'listening',
  testId: string = 'custom-test'
): Promise<UploadMediaResult> {
  if (!file.size) {
    throw new Error('The selected file is empty.');
  }

  const sanitizedTestId = (testId || 'custom-test').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const filename = (file.name || `audio_${Date.now()}.mp3`).replace(/[^a-zA-Z0-9_.-]/g, '_');
  const endpoint = '/api/upload-media';

  // Try saving directly to website folder via server middleware
  try {
    const query = new URLSearchParams({
      skill,
      testId: sanitizedTestId,
      filename,
    });

    const res = await fetch(`${endpoint}?${query.toString()}`, {
      method: 'POST',
      body: file,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.url) {
        return {
          url: data.url,
          filename: data.filename || filename,
          size: data.size || file.size,
          source: 'server',
        };
      }
    }
  } catch (err) {
    console.warn('Direct web folder upload endpoint not reachable, falling back to base64 storage:', err);
  }

  if (file.size > MAX_LOCAL_MEDIA_BYTES) {
    throw new Error('Upload service is unavailable. Files over 1 MB cannot be stored safely in this browser.');
  }

  // Small files can be retained locally when a deployment has no upload service.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        url: reader.result as string,
        filename,
        size: file.size,
        source: 'base64',
      });
    };
    reader.onerror = () => reject(new Error('Failed to read media file.'));
    reader.readAsDataURL(file);
  });
}
