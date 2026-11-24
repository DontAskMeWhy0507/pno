import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  HStack,
  Stack,
  Wrap,
  WrapItem,
  useColorModeValue,
} from "@chakra-ui/react";
import { IconPlayerPlay } from "@tabler/icons-react";
import {
  extractAnkiAudioSources,
  sanitizeAnkiHtml,
  stripFrontSidePrefix,
} from "@pno/lib/src/anki/template";
import { getAnkiFallbackMediaUrl } from "@pno/lib/src/anki/media-fallback";
import { scopeAnkiCss } from "@pno/lib/src/anki/presets";
import { AnkiAudioPlayer, stopAllAnkiAudio } from "./anki-audio-player";

export interface AnkiCardProps {
  frontHtml: string;
  backHtml: string;
  assetUrl?: string | null;
  customCss?: string | null;
  isAnswerShown: boolean;
  replaySignal?: number;
  disableAutoPlay?: boolean;
  onFlip?: () => void;
  answerRef?: React.RefObject<HTMLDivElement>;
}

export const AnkiCard: React.FC<AnkiCardProps> = ({
  frontHtml,
  backHtml,
  assetUrl,
  customCss,
  isAnswerShown,
  replaySignal = 0,
  disableAutoPlay = false,
  onFlip,
  answerRef,
}) => {
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const clozeBg = useColorModeValue("orange.100", "orange.900");
  const clozeColor = useColorModeValue("orange.800", "orange.200");

  const safeFrontHtml = useMemo(
    () => sanitizeAnkiHtml(frontHtml).html,
    [frontHtml],
  );
  const safeBackHtml = useMemo(() => {
    const cleaned = sanitizeAnkiHtml(backHtml).html;
    return stripFrontSidePrefix(safeFrontHtml, cleaned);
  }, [backHtml, safeFrontHtml]);

  const scopedCss = useMemo(
    () => (customCss ? scopeAnkiCss(customCss, ".anki-card-surface") : ""),
    [customCss],
  );

  // Extract all audio files in document order on each side
  const frontAudioSources = useMemo(
    () => extractAnkiAudioSources(safeFrontHtml),
    [safeFrontHtml],
  );
  const backAudioSources = useMemo(
    () => extractAnkiAudioSources(safeBackHtml),
    [safeBackHtml],
  );

  // Distinct back audio files (avoid re-playing front pronunciation on answer side)
  const newBackAudioSources = useMemo(() => {
    const frontSet = new Set(frontAudioSources);
    return backAudioSources.filter((src) => !frontSet.has(src));
  }, [frontAudioSources, backAudioSources]);

  const autoQueueRef = useRef<{
    side: "front" | "back";
    index: number;
  } | null>(null);
  const [triggers, setTriggers] = useState<Record<string, number>>({});

  const triggerClip = useCallback((side: "front" | "back", index: number) => {
    const key = `${side}-${index}`;
    setTriggers((prev) => ({
      ...prev,
      [key]: (prev[key] ?? 0) + 1,
    }));
  }, []);

  const startSideQueue = useCallback(
    (side: "front" | "back", sources: string[]) => {
      if (sources.length === 0) {
        autoQueueRef.current = null;
        return;
      }
      autoQueueRef.current = { side, index: 0 };
      triggerClip(side, 0);
    },
    [triggerClip],
  );

  // Stop active audio and auto-play sequential queue when card/side changes
  useEffect(() => {
    stopAllAnkiAudio();
    if (disableAutoPlay) {
      autoQueueRef.current = null;
      return () => stopAllAnkiAudio();
    }

    if (!isAnswerShown) {
      startSideQueue("front", frontAudioSources);
    } else {
      startSideQueue("back", newBackAudioSources);
    }

    return () => {
      stopAllAnkiAudio();
    };
  }, [
    frontHtml,
    isAnswerShown,
    disableAutoPlay,
    frontAudioSources,
    newBackAudioSources,
    startSideQueue,
  ]);

  // Replay active side's full audio sequence on R hotkey
  useEffect(() => {
    if (replaySignal <= 0) return;
    stopAllAnkiAudio();
    if (isAnswerShown) {
      const target =
        newBackAudioSources.length > 0
          ? newBackAudioSources
          : frontAudioSources;
      const side = newBackAudioSources.length > 0 ? "back" : "front";
      startSideQueue(side, target);
    } else {
      startSideQueue("front", frontAudioSources);
    }
  }, [
    replaySignal,
    isAnswerShown,
    frontAudioSources,
    newBackAudioSources,
    startSideQueue,
  ]);

  const handleClipEnded = useCallback(
    (side: "front" | "back", idx: number, totalCount: number) => {
      const prev = autoQueueRef.current;
      if (!prev || prev.side !== side || prev.index !== idx) {
        return;
      }
      const nextIdx = idx + 1;
      if (nextIdx < totalCount) {
        autoQueueRef.current = { side, index: nextIdx };
        triggerClip(side, nextIdx);
      } else {
        autoQueueRef.current = null;
      }
    },
    [triggerClip],
  );

  const showSeparateAsset =
    !!assetUrl &&
    !safeFrontHtml.includes(assetUrl) &&
    !safeBackHtml.includes(assetUrl);

  return (
    <Card
      bg={cardBg}
      borderWidth="2px"
      borderColor={borderColor}
      rounded="2xl"
      shadow="md"
      w="full"
      minH={{ base: "260px", md: "400px" }}
      display="flex"
      flexDirection="column"
      justifyContent="center"
      position="relative"
      p={{ base: 4, sm: 6, md: 8 }}
      onClick={!isAnswerShown ? onFlip : undefined}
      cursor={!isAnswerShown && onFlip ? "pointer" : "default"}
      userSelect={!isAnswerShown ? "none" : "text"}
      sx={{
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        ".anki-cloze": {
          bg: clozeBg,
          color: clozeColor,
          fontWeight: "bold",
          px: 1.5,
          py: 0.5,
          rounded: "md",
        },
        ".anki-img, img": {
          maxW: "100%",
          maxH: { base: "200px", md: "260px" },
          objectFit: "contain",
          mx: "auto",
          my: 2,
          rounded: "lg",
        },
      }}
    >
      {scopedCss && <style dangerouslySetInnerHTML={{ __html: scopedCss }} />}
      <CardBody
        className="anki-card-surface"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        px={{ base: 1, sm: 3 }}
        py={{ base: 2, sm: 4 }}
        onErrorCapture={(e) => {
          const target = e.target;
          if (
            target instanceof HTMLImageElement &&
            !target.dataset.fallbackApplied
          ) {
            const fallbackUrl = getAnkiFallbackMediaUrl(target.src);
            if (fallbackUrl && fallbackUrl !== target.src) {
              target.dataset.fallbackApplied = "1";
              target.src = fallbackUrl;
            }
          }
        }}
      >
        {/* Question Side */}
        <Box
          textAlign="center"
          fontSize={{ base: "lg", md: "2xl" }}
          lineHeight="1.6"
          w="full"
        >
          <div dangerouslySetInnerHTML={{ __html: safeFrontHtml }} />
          {frontAudioSources.length > 0 && (
            <Wrap justify="center" spacing={2} mt={3}>
              {frontAudioSources.map((src, i) => (
                <WrapItem key={`front-audio-${src}-${i}`}>
                  <AnkiAudioPlayer
                    src={src}
                    label={
                      frontAudioSources.length > 1
                        ? `Audio ${i + 1}`
                        : undefined
                    }
                    playTrigger={triggers[`front-${i}`] ?? 0}
                    onEnded={() =>
                      handleClipEnded("front", i, frontAudioSources.length)
                    }
                    onManualPlay={() => {
                      autoQueueRef.current = null;
                    }}
                  />
                </WrapItem>
              ))}
              {frontAudioSources.length > 1 && (
                <WrapItem>
                  <Button
                    size="sm"
                    minH="38px"
                    rounded="full"
                    variant="ghost"
                    colorScheme="gray"
                    leftIcon={<IconPlayerPlay size={15} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      startSideQueue("front", frontAudioSources);
                    }}
                  >
                    Play All
                  </Button>
                </WrapItem>
              )}
            </Wrap>
          )}
        </Box>

        {/* Answer Side */}
        {isAnswerShown && (
          <Stack
            ref={answerRef}
            spacing={4}
            w="full"
            mt={{ base: 4, md: 6 }}
            align="center"
          >
            <Divider borderColor={borderColor} />
            <Box
              textAlign="center"
              fontSize={{ base: "md", md: "xl" }}
              lineHeight="1.6"
              w="full"
            >
              <div dangerouslySetInnerHTML={{ __html: safeBackHtml }} />
              {showSeparateAsset && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={assetUrl} alt="Card visual" className="anki-img" />
              )}
              {newBackAudioSources.length > 0 && (
                <Wrap justify="center" spacing={2} mt={3}>
                  {newBackAudioSources.map((src, i) => (
                    <WrapItem key={`back-audio-${src}-${i}`}>
                      <AnkiAudioPlayer
                        src={src}
                        label={
                          newBackAudioSources.length > 1
                            ? `Audio ${i + 1}`
                            : undefined
                        }
                        playTrigger={triggers[`back-${i}`] ?? 0}
                        onEnded={() =>
                          handleClipEnded(
                            "back",
                            i,
                            newBackAudioSources.length,
                          )
                        }
                        onManualPlay={() => {
                      autoQueueRef.current = null;
                    }}
                      />
                    </WrapItem>
                  ))}
                  {newBackAudioSources.length > 1 && (
                    <WrapItem>
                      <Button
                        size="sm"
                        minH="38px"
                        rounded="full"
                        variant="ghost"
                        colorScheme="gray"
                        leftIcon={<IconPlayerPlay size={15} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          startSideQueue("back", newBackAudioSources);
                        }}
                      >
                        Play All
                      </Button>
                    </WrapItem>
                  )}
                </Wrap>
              )}
            </Box>
          </Stack>
        )}
      </CardBody>
    </Card>
  );
};

export default AnkiCard;
