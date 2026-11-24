import React, { useEffect, useRef, useState } from "react";
import { Button, HStack, IconButton, Tooltip } from "@chakra-ui/react";
import { IconPlayerPause, IconVolume } from "@tabler/icons-react";
import { getAnkiFallbackMediaUrl } from "@quenti/lib/src/anki/media-fallback";

export interface AnkiAudioPlayerProps {
  src: string;
  label?: string;
  autoPlay?: boolean;
  playTrigger?: number;
  onEnded?: () => void;
  onManualPlay?: () => void;
  compact?: boolean;
}

// Global reference to ensure only ONE audio plays at any time (Singleton Audio Manager)
let currentPlayingAudio: HTMLAudioElement | null = null;

export const stopAllAnkiAudio = () => {
  if (currentPlayingAudio) {
    currentPlayingAudio.pause();
    currentPlayingAudio.currentTime = 0;
    currentPlayingAudio = null;
  }
};

export const AnkiAudioPlayer: React.FC<AnkiAudioPlayerProps> = ({
  src,
  label,
  autoPlay = false,
  playTrigger = 0,
  onEnded,
  onManualPlay,
  compact = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSrc, setActiveSrc] = useState(src);
  const [triedFallback, setTriedFallback] = useState(false);
  const shouldResumeRef = useRef(false);

  useEffect(() => {
    setActiveSrc(src);
    setTriedFallback(false);
    shouldResumeRef.current = false;
  }, [src]);

  const playAudio = () => {
    const el = audioRef.current;
    if (!el) return;

    if (isPlaying && currentPlayingAudio === el) {
      el.pause();
      el.currentTime = 0;
      currentPlayingAudio = null;
      return;
    }

    if (currentPlayingAudio && currentPlayingAudio !== el) {
      currentPlayingAudio.pause();
      currentPlayingAudio.currentTime = 0;
    }

    shouldResumeRef.current = true;
    currentPlayingAudio = el;
    el.currentTime = 0;
    el.play().catch(() => {
      setIsPlaying(false);
    });
  };

  const forcePlay = () => {
    const el = audioRef.current;
    if (!el) return;

    if (currentPlayingAudio && currentPlayingAudio !== el) {
      currentPlayingAudio.pause();
      currentPlayingAudio.currentTime = 0;
    }

    shouldResumeRef.current = true;
    currentPlayingAudio = el;
    el.currentTime = 0;
    el.play().catch(() => {
      setIsPlaying(false);
    });
  };

  useEffect(() => {
    if (autoPlay) {
      const timeout = setTimeout(forcePlay, 120);
      return () => clearTimeout(timeout);
    }
  }, [activeSrc, autoPlay]);

  useEffect(() => {
    if (playTrigger > 0) {
      const timeout = setTimeout(forcePlay, 60);
      return () => clearTimeout(timeout);
    }
  }, [playTrigger, activeSrc]);

  useEffect(() => {
    return () => {
      if (currentPlayingAudio && currentPlayingAudio === audioRef.current) {
        currentPlayingAudio.pause();
        currentPlayingAudio = null;
      }
    };
  }, []);

  return (
    <HStack
      display="inline-flex"
      my={0.5}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <audio
        ref={audioRef}
        src={activeSrc}
        preload="auto"
        onCanPlay={() => {
          if (shouldResumeRef.current && triedFallback && audioRef.current) {
            shouldResumeRef.current = false;
            audioRef.current.play().catch(() => {
              setIsPlaying(false);
            });
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          shouldResumeRef.current = false;
          setIsPlaying(false);
          if (currentPlayingAudio === audioRef.current) {
            currentPlayingAudio = null;
          }
          onEnded?.();
        }}
        onError={() => {
          if (!triedFallback) {
            const fallbackUrl = getAnkiFallbackMediaUrl(activeSrc);
            if (fallbackUrl && fallbackUrl !== activeSrc) {
              setTriedFallback(true);
              setActiveSrc(fallbackUrl);
              return;
            }
          }
          shouldResumeRef.current = false;
          setIsPlaying(false);
          if (currentPlayingAudio === audioRef.current) {
            currentPlayingAudio = null;
          }
          onEnded?.();
        }}
      />
      {label ? (
        <Button
          size={compact ? "xs" : "sm"}
          minH={compact ? "32px" : "38px"}
          px={compact ? 2.5 : 3.5}
          rounded="full"
          variant={isPlaying ? "solid" : "outline"}
          colorScheme="orange"
          leftIcon={
            isPlaying ? (
              <IconPlayerPause size={compact ? 14 : 16} />
            ) : (
              <IconVolume size={compact ? 14 : 16} />
            )
          }
          fontWeight={700}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onManualPlay?.();
            playAudio();
          }}
        >
          {label}
        </Button>
      ) : (
        <Tooltip label={isPlaying ? "Stop audio" : "Play audio"} placement="top" hasArrow>
          <IconButton
            aria-label={isPlaying ? "Stop audio" : "Play audio"}
            icon={
              isPlaying ? (
                <IconPlayerPause size={compact ? 16 : 20} />
              ) : (
                <IconVolume size={compact ? 16 : 20} />
              )
            }
            size={compact ? "sm" : "md"}
            minW={compact ? "36px" : "42px"}
            minH={compact ? "36px" : "42px"}
            rounded="full"
            variant={isPlaying ? "solid" : "ghost"}
            colorScheme="orange"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onManualPlay?.();
              playAudio();
            }}
          />
        </Tooltip>
      )}
    </HStack>
  );
};

export default AnkiAudioPlayer;
