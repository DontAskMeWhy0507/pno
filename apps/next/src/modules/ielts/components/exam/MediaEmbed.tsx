import type { FC } from 'react';
import { extractMediaEmbedInfo } from '../../utils/mediaUploader';

interface MediaEmbedProps {
  imageUrl?: string;
  videoUrl?: string;
  alt?: string;
  className?: string;
}

export const MediaEmbed: FC<MediaEmbedProps> = ({
  imageUrl,
  videoUrl,
  alt = 'Exam visual reference',
  className = '',
}) => {
  const imageInfo = imageUrl ? extractMediaEmbedInfo(imageUrl, 'image') : null;
  const videoInfo = videoUrl ? extractMediaEmbedInfo(videoUrl, 'video') : null;

  if (!imageInfo && !videoInfo) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {imageInfo && (
        <div className="rounded-xl border border-gray-200 bg-slate-50 p-2.5 flex justify-center overflow-hidden">
          <img
            src={imageInfo.embedUrl}
            alt={alt}
            className="max-h-96 w-auto max-w-full object-contain rounded-lg"
            loading="lazy"
          />
        </div>
      )}

      {videoInfo && videoInfo.kind === 'youtube' && (
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-black aspect-video w-full">
          <iframe
            src={videoInfo.embedUrl}
            title={alt}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {videoInfo && videoInfo.kind !== 'youtube' && (
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-black">
          <video
            src={videoInfo.embedUrl}
            controls
            preload="metadata"
            className="w-full max-h-96"
          />
        </div>
      )}
    </div>
  );
};
