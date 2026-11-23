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
