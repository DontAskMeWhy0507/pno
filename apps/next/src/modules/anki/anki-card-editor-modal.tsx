import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  type AnkiDeckTemplate,
  getAnkiPreset,
  parseAnkiCardFields,
} from "@quenti/lib/src/anki/presets";
import {
  extractAnkiAudioSources,
  renderAnkiCard,
  sanitizeAnkiHtml,
  stripFrontSidePrefix,
} from "@quenti/lib/src/anki/template";
import { outfit } from "@quenti/lib/chakra-theme";
import { api } from "@quenti/trpc";

import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormLabel,
  HStack,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  Tooltip,
  Wrap,
  WrapItem,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import {
  IconArrowDown,
  IconArrowUp,
  IconBold,
  IconBraces,
  IconCode,
  IconItalic,
  IconLink,
  IconPhoto,
  IconPlus,
  IconTrash,
  IconUpload,
  IconVolume,
} from "@tabler/icons-react";

import { uploadMediaFile } from "../ielts/utils/mediaUploader";
import { AnkiAudioPlayer } from "./anki-audio-player";
import { AnkiCard } from "./anki-card";

export interface EditableAnkiCard {
  termId: string;
  word: string;
  definition: string;
  wordRichText?: unknown;
  assetUrl?: string | null;
}

export interface AnkiCardEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  studySetId: string;
  deckTemplate?: AnkiDeckTemplate | null;
  card?: EditableAnkiCard | null;
  onSaved?: (savedCard: {
    id: string;
    rank: number;
    word: string;
    definition: string;
    wordRichText: unknown;
    assetUrl: string | null;
    studySetId: string;
  }) => void;
}

const isAudioFieldName = (name: string) =>
  /audio|sound|pronun|voice/i.test(name);
const isImageFieldName = (name: string) =>
  /image|img|pic|photo|visual/i.test(name);

function stripAudioAndExtract(html: string): {
  cleanHtml: string;
  audios: string[];
} {
  const audios = extractAnkiAudioSources(html);
  const cleanHtml = html
    .replace(/<div[^>]*class=["'][^"']*anki-audio[^"']*["'][^>]*>(?:<\/div>)?/gi, "")
    .replace(/<audio\b[^>]*>[\s\S]*?<\/audio>/gi, "")
    .replace(/\[sound:[^\]]+\]/gi, "")
    .trim();
  return { cleanHtml, audios };
}

function extractFirstImageUrl(html: string, fallbackAsset?: string | null): string {
  const match = html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  return match?.[1] ?? fallbackAsset ?? "";
}

function stripImagesFromHtml(html: string): string {
  return html.replace(/<img\b[^>]*\/?>/gi, "").trim();
}

function appendAudiosToHtml(baseHtml: string, audios: string[]): string {
  const trimmed = baseHtml.trim();
  if (audios.length === 0) return trimmed;
  const soundTags = audios.map((url) => `[sound:${url}]`).join(" ");
  return trimmed ? `${trimmed}\n${soundTags}` : soundTags;
}

function insertAroundSelection(
  el: HTMLTextAreaElement | null,
  currentValue: string,
  before: string,
  after: string,
  onChange: (next: string) => void,
) {
  if (!el) {
    onChange(`${currentValue}${before}${after}`);
    return;
  }
  const start = el.selectionStart ?? currentValue.length;
  const end = el.selectionEnd ?? currentValue.length;
  const selected = currentValue.slice(start, end);
  const next =
    currentValue.slice(0, start) +
    before +
    selected +
    after +
    currentValue.slice(end);
  onChange(next);
}

interface MediaAudioListProps {
  studySetId: string;
  audios: string[];
  onChange: (next: string[]) => void;
  title?: string;
}

const MediaAudioList: React.FC<MediaAudioListProps> = ({
  studySetId,
  audios,
  onChange,
  title = "Audio Clips",
}) => {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const chipBg = useColorModeValue("gray.100", "gray.750");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadMediaFile(file, "listening", studySetId);
      onChange([...audios, res.url]);
      toast({ title: "Audio added", status: "success", duration: 1800 });
    } catch (err) {
      toast({
        title: "Audio upload failed",
        description: err instanceof Error ? err.message : "Try again.",
        status: "error",
        duration: 3000,
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= audios.length) return;
    const copy = [...audios];
    const [item] = copy.splice(idx, 1);
    if (item !== undefined) {
      copy.splice(target, 0, item);
      onChange(copy);
    }
  };

  return (
    <Stack spacing={2}>
      <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
        <HStack spacing={1.5}>
          <IconVolume size={15} />
          <Text fontSize="xs" fontWeight={700} textTransform="uppercase">
            {title} ({audios.length})
          </Text>
        </HStack>
        <HStack spacing={1.5}>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,video/mp4"
            hidden
            onChange={handleUpload}
          />
          <Button
            size="xs"
            leftIcon={<IconUpload size={13} />}
            variant="outline"
            isLoading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            Upload Audio
          </Button>
          <Button
            size="xs"
            leftIcon={<IconLink size={13} />}
            variant="ghost"
            onClick={() => setShowUrlInput((s) => !s)}
          >
            URL
          </Button>
        </HStack>
      </Flex>

      {showUrlInput && (
        <HStack>
          <Input
            size="sm"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://... or /audio/..."
          />
          <Button
            size="sm"
            colorScheme="blue"
            onClick={() => {
              const trimmed = urlInput.trim();
              if (!trimmed) return;
              onChange([...audios, trimmed]);
              setUrlInput("");
              setShowUrlInput(false);
            }}
          >
            Add
          </Button>
        </HStack>
      )}

      {audios.length > 0 && (
        <Stack spacing={1.5}>
          {audios.map((src, idx) => (
            <HStack
              key={`${src}-${idx}`}
              bg={chipBg}
              borderWidth="1px"
              borderColor={borderColor}
              px={2.5}
              py={1.5}
              rounded="xl"
              justify="space-between"
            >
              <HStack spacing={2} minW={0} flex="1">
                <AnkiAudioPlayer src={src} label={`Audio ${idx + 1}`} compact />
                <Text fontSize="xs" color="gray.500" noOfLines={1} flex="1">
                  {src.split("/").pop()}
                </Text>
              </HStack>
              <HStack spacing={0.5} flexShrink={0}>
                {audios.length > 1 && (
                  <>
                    <IconButton
                      aria-label="Move audio up"
                      icon={<IconArrowUp size={13} />}
                      size="xs"
                      variant="ghost"
                      isDisabled={idx === 0}
                      onClick={() => move(idx, -1)}
                    />
                    <IconButton
                      aria-label="Move audio down"
                      icon={<IconArrowDown size={13} />}
                      size="xs"
                      variant="ghost"
                      isDisabled={idx === audios.length - 1}
                      onClick={() => move(idx, 1)}
                    />
                  </>
                )}
                <IconButton
                  aria-label="Remove audio"
                  icon={<IconTrash size={13} />}
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => onChange(audios.filter((_, i) => i !== idx))}
                />
              </HStack>
            </HStack>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

interface MediaImageSlotProps {
  studySetId: string;
  imageUrl: string;
  onChange: (nextUrl: string) => void;
}

const MediaImageSlot: React.FC<MediaImageSlotProps> = ({
  studySetId,
  imageUrl,
  onChange,
}) => {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadMediaFile(file, "writing", studySetId);
      onChange(res.url);
      toast({ title: "Image uploaded", status: "success", duration: 1800 });
    } catch (err) {
      toast({
        title: "Image upload failed",
        description: err instanceof Error ? err.message : "Try again.",
        status: "error",
        duration: 3000,
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Stack spacing={2}>
      <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
        <HStack spacing={1.5}>
          <IconPhoto size={15} />
          <Text fontSize="xs" fontWeight={700} textTransform="uppercase">
            Image
          </Text>
        </HStack>
        <HStack spacing={1.5}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleUpload}
          />
          <Button
            size="xs"
            leftIcon={<IconUpload size={13} />}
            variant="outline"
            isLoading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            Upload Image
          </Button>
          <Button
            size="xs"
            leftIcon={<IconLink size={13} />}
            variant="ghost"
            onClick={() => setShowUrlInput((s) => !s)}
          >
            URL
          </Button>
          {imageUrl && (
            <Button
              size="xs"
              colorScheme="red"
              variant="ghost"
              onClick={() => onChange("")}
            >
              Remove
            </Button>
          )}
        </HStack>
      </Flex>

      {showUrlInput && (
        <Input
          size="sm"
          value={imageUrl}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... or /tests/..."
        />
      )}

      {imageUrl && (
        <Box
          p={2}
          borderWidth="1px"
          rounded="xl"
          display="flex"
          justifyContent="center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Card image preview"
            style={{ maxHeight: "140px", objectFit: "contain", borderRadius: "8px" }}
          />
        </Box>
      )}
    </Stack>
  );
};

export const AnkiCardEditorModal: React.FC<AnkiCardEditorModalProps> = ({
  isOpen,
  onClose,
  studySetId,
  deckTemplate,
  card,
  onSaved,
}) => {
  const toast = useToast();
  const utils = api.useUtils();
  const isEditing = Boolean(card);
  const resolvedTemplate = useMemo(
    () => deckTemplate ?? getAnkiPreset("vocab_pro"),
    [deckTemplate],
  );

  const [editorMode, setEditorMode] = useState<"fields" | "html">("fields");
  const [fieldsState, setFieldsState] = useState<Record<string, string>>({});
  const [frontText, setFrontText] = useState("");
  const [frontAudios, setFrontAudios] = useState<string[]>([]);
  const [backText, setBackText] = useState("");
  const [backAudios, setBackAudios] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [clozeOrdinal, setClozeOrdinal] = useState<number | undefined>(
    undefined,
  );

  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    if (!isOpen) return;

    if (!card) {
      // New card in fields mode
      const initFields: Record<string, string> = {};
      for (const f of resolvedTemplate.fields) {
        initFields[f] = "";
      }
      setFieldsState(initFields);
      setFrontText("");
      setFrontAudios([]);
      setBackText("");
      setBackAudios([]);
      setImageUrl("");
      setClozeOrdinal(resolvedTemplate.isCloze ? 1 : undefined);
      setEditorMode("fields");
      return;
    }

    const parsedRich = parseAnkiCardFields(card.wordRichText);
    if (parsedRich && deckTemplate) {
      const nextFields: Record<string, string> = {};
      for (const f of deckTemplate.fields) {
        nextFields[f] = parsedRich.ankiFields[f] ?? "";
      }
      for (const [k, v] of Object.entries(parsedRich.ankiFields)) {
        if (!(k in nextFields)) nextFields[k] = v;
      }
      setFieldsState(nextFields);
      setClozeOrdinal(parsedRich.clozeOrdinal);
      setEditorMode("fields");
    } else {
      const frontClean = stripAudioAndExtract(card.word);
      const backWithoutFront = stripFrontSidePrefix(card.word, card.definition);
      const backClean = stripAudioAndExtract(backWithoutFront);
      const extractedImg = extractFirstImageUrl(backClean.cleanHtml, card.assetUrl);

      setFrontText(frontClean.cleanHtml);
      setFrontAudios(frontClean.audios);
      setBackText(
        extractedImg ? stripImagesFromHtml(backClean.cleanHtml) : backClean.cleanHtml,
      );
      setBackAudios(backClean.audios);
      setImageUrl(extractedImg);
      setEditorMode("html");
    }
  }, [isOpen, card, deckTemplate, resolvedTemplate]);

  const addMutation = api.anki.addCard.useMutation({
    onSuccess: async (created) => {
      await Promise.all([
        utils.studySets.invalidate(),
        utils.anki.getReviewQueue.invalidate({ studySetId }),
      ]);
      toast({ title: "Card added", status: "success", duration: 1800 });
      onSaved?.(created);
      onClose();
    },
    onError: (err) => {
      toast({
        title: "Failed to add card",
        description: err.message,
        status: "error",
        duration: 3500,
      });
    },
  });

  const updateMutation = api.anki.updateCard.useMutation({
    onSuccess: async (updated) => {
      await Promise.all([
        utils.studySets.invalidate(),
        utils.anki.getReviewQueue.invalidate({ studySetId }),
      ]);
      toast({ title: "Card updated", status: "success", duration: 1800 });
      onSaved?.(updated);
      onClose();
    },
    onError: (err) => {
      toast({
        title: "Failed to update card",
        description: err.message,
        status: "error",
        duration: 3500,
      });
    },
  });

  const previewHtml = useMemo(() => {
    if (editorMode === "fields") {
      const rendered = renderAnkiCard({
        qfmt: resolvedTemplate.qfmt,
        afmt: resolvedTemplate.afmt,
        fields: fieldsState,
        clozeOrdinal,
      });
      return {
        front: rendered.questionHtml,
        back: stripFrontSidePrefix(rendered.questionHtml, rendered.answerHtml),
        assetUrl: null as string | null,
      };
    }

    const frontHtml = sanitizeAnkiHtml(
      appendAudiosToHtml(frontText, frontAudios),
    ).html;
    const rawBackWithImg = imageUrl
      ? `${imageUrl ? `<img src="${imageUrl}" class="anki-img" />\n` : ""}${backText}`
      : backText;
    const backHtml = sanitizeAnkiHtml(
      appendAudiosToHtml(rawBackWithImg, backAudios),
    ).html;

    return {
      front: frontHtml,
      back: backHtml,
      assetUrl: imageUrl || null,
    };
  }, [
    editorMode,
    resolvedTemplate,
    fieldsState,
    clozeOrdinal,
    frontText,
    frontAudios,
    backText,
    backAudios,
    imageUrl,
  ]);

  const handleSave = () => {
    if (editorMode === "fields") {
      if (isEditing && card) {
        updateMutation.mutate({
          studySetId,
          termId: card.termId,
          ankiFields: fieldsState,
          clozeOrdinal,
        });
      } else {
        addMutation.mutate({
          studySetId,
          ankiFields: fieldsState,
          clozeOrdinal,
        });
      }
      return;
    }

    const frontHtml = appendAudiosToHtml(frontText, frontAudios);
    const backBody = imageUrl
      ? `<img src="${imageUrl}" class="anki-img" />${backText ? `<br>${backText}` : ""}`
      : backText;
    const backHtml = appendAudiosToHtml(backBody, backAudios);

    if (isEditing && card) {
      updateMutation.mutate({
        studySetId,
        termId: card.termId,
        frontHtml,
        backHtml,
        assetUrl: imageUrl ? imageUrl.slice(0, 255) : null,
      });
    } else {
      addMutation.mutate({
        studySetId,
        frontHtml,
        backHtml,
        assetUrl: imageUrl ? imageUrl.slice(0, 255) : null,
      });
    }
  };

  const borderColor = useColorModeValue("gray.200", "gray.700");
  const panelBg = useColorModeValue("gray.50", "gray.800");
  const isSaving = addMutation.isLoading || updateMutation.isLoading;

  const renderFormatToolbar = (
    refKey: string,
    val: string,
    onChange: (next: string) => void,
  ) => (
    <HStack spacing={1} mb={1}>
      <Tooltip label="Bold">
        <IconButton
          aria-label="Bold"
          icon={<IconBold size={14} />}
          size="xs"
          variant="ghost"
          onClick={() =>
            insertAroundSelection(
              textareaRefs.current[refKey] ?? null,
              val,
              "<b>",
              "</b>",
              onChange,
            )
          }
        />
      </Tooltip>
      <Tooltip label="Italic">
        <IconButton
          aria-label="Italic"
          icon={<IconItalic size={14} />}
          size="xs"
          variant="ghost"
          onClick={() =>
            insertAroundSelection(
              textareaRefs.current[refKey] ?? null,
              val,
              "<i>",
              "</i>",
              onChange,
            )
          }
        />
      </Tooltip>
      <Tooltip label="Cloze {{c1::...}}">
        <IconButton
          aria-label="Cloze"
          icon={<IconBraces size={14} />}
          size="xs"
          variant="ghost"
          onClick={() =>
            insertAroundSelection(
              textareaRefs.current[refKey] ?? null,
              val,
              "{{c1::",
              "}}",
              onChange,
            )
          }
        />
      </Tooltip>
      <Button
        size="xs"
        variant="ghost"
        fontSize="xs"
        onClick={() =>
          insertAroundSelection(
            textareaRefs.current[refKey] ?? null,
            val,
            "<br>",
            "",
            onChange,
          )
        }
      >
        &lt;br&gt;
      </Button>
    </HStack>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={{ base: "full", md: "3xl" }}
      scrollBehavior="inside"
      isCentered
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader pb={2}>
          <HStack justify="space-between" pr={8} flexWrap="wrap" gap={2}>
            <Text fontFamily={outfit.style.fontFamily} fontWeight={800}>
              {isEditing ? "Edit Anki Card" : "Add Anki Card"}
            </Text>
            {editorMode === "html" && (
              <Badge colorScheme="purple" fontSize="xs" rounded="md">
                HTML &amp; Multi-Audio Editor
              </Badge>
            )}
          </HStack>
        </ModalHeader>
        <ModalCloseButton rounded="full" top={4} right={4} />

        <ModalBody px={{ base: 4, md: 6 }} py={2}>
          <Tabs colorScheme="blue" variant="soft-rounded" size="sm">
            <TabList mb={4}>
              <Tab fontWeight={700}>Fields &amp; Media</Tab>
              <Tab fontWeight={700}>Live Preview</Tab>
            </TabList>

            <TabPanels>
              <TabPanel px={0} py={0}>
                {editorMode === "fields" ? (
                  <Stack spacing={4}>
                    {resolvedTemplate.fields.map((fieldName) => {
                      const val = fieldsState[fieldName] ?? "";

                      if (isAudioFieldName(fieldName)) {
                        const audios = extractAnkiAudioSources(
                          sanitizeAnkiHtml(val).html,
                        );
                        return (
                          <Box
                            key={fieldName}
                            p={3.5}
                            rounded="xl"
                            bg={panelBg}
                            borderWidth="1px"
                            borderColor={borderColor}
                          >
                            <MediaAudioList
                              studySetId={studySetId}
                              audios={audios}
                              title={fieldName}
                              onChange={(nextAudios) =>
                                setFieldsState((prev) => ({
                                  ...prev,
                                  [fieldName]: nextAudios
                                    .map((u) => `[sound:${u}]`)
                                    .join(" "),
                                }))
                              }
                            />
                          </Box>
                        );
                      }

                      if (isImageFieldName(fieldName)) {
                        const currentImg = extractFirstImageUrl(val);
                        return (
                          <Box
                            key={fieldName}
                            p={3.5}
                            rounded="xl"
                            bg={panelBg}
                            borderWidth="1px"
                            borderColor={borderColor}
                          >
                            <MediaImageSlot
                              studySetId={studySetId}
                              imageUrl={currentImg}
                              onChange={(nextUrl) =>
                                setFieldsState((prev) => ({
                                  ...prev,
                                  [fieldName]: nextUrl
                                    ? `<img src="${nextUrl}" class="anki-img" />`
                                    : "",
                                }))
                              }
                            />
                          </Box>
                        );
                      }

                      return (
                        <Box
                          key={fieldName}
                          p={3.5}
                          rounded="xl"
                          bg={panelBg}
                          borderWidth="1px"
                          borderColor={borderColor}
                        >
                          <Flex justify="space-between" align="center" mb={1}>
                            <FormLabel mb={0} fontWeight={700} fontSize="sm">
                              {fieldName}
                            </FormLabel>
                            {renderFormatToolbar(fieldName, val, (next) =>
                              setFieldsState((prev) => ({
                                ...prev,
                                [fieldName]: next,
                              })),
                            )}
                          </Flex>
                          <Textarea
                            ref={(el) => {
                              textareaRefs.current[fieldName] = el;
                            }}
                            value={val}
                            onChange={(e) =>
                              setFieldsState((prev) => ({
                                ...prev,
                                [fieldName]: e.target.value,
                              }))
                            }
                            placeholder={`Enter ${fieldName}...`}
                            rows={/example|meaning|back|text|extra/i.test(fieldName) ? 3 : 2}
                            fontSize="md"
                          />
                        </Box>
                      );
                    })}
                  </Stack>
                ) : (
                  <Stack spacing={5}>
                    <Box
                      p={3.5}
                      rounded="xl"
                      bg={panelBg}
                      borderWidth="1px"
                      borderColor={borderColor}
                    >
                      <Flex justify="space-between" align="center" mb={1.5}>
                        <HStack spacing={1.5}>
                          <IconCode size={15} />
                          <FormLabel mb={0} fontWeight={700} fontSize="sm">
                            Front (Question / Word &amp; IPA)
                          </FormLabel>
                        </HStack>
                        {renderFormatToolbar("front", frontText, setFrontText)}
                      </Flex>
                      <Textarea
                        ref={(el) => {
                          textareaRefs.current.front = el;
                        }}
                        value={frontText}
                        onChange={(e) => setFrontText(e.target.value)}
                        rows={3}
                        fontSize="md"
                        placeholder="Front HTML or text..."
                      />
                      <Box mt={3}>
                        <MediaAudioList
                          studySetId={studySetId}
                          audios={frontAudios}
                          onChange={setFrontAudios}
                          title="Front Audio"
                        />
                      </Box>
                    </Box>

                    <Box
                      p={3.5}
                      rounded="xl"
                      bg={panelBg}
                      borderWidth="1px"
                      borderColor={borderColor}
                    >
                      <Flex justify="space-between" align="center" mb={1.5}>
                        <HStack spacing={1.5}>
                          <IconCode size={15} />
                          <FormLabel mb={0} fontWeight={700} fontSize="sm">
                            Back (Example &amp; Meaning)
                          </FormLabel>
                        </HStack>
                        {renderFormatToolbar("back", backText, setBackText)}
                      </Flex>
                      <Textarea
                        ref={(el) => {
                          textareaRefs.current.back = el;
                        }}
                        value={backText}
                        onChange={(e) => setBackText(e.target.value)}
                        rows={4}
                        fontSize="md"
                        placeholder="Back HTML or text..."
                      />
                      <Divider my={3} />
                      <MediaImageSlot
                        studySetId={studySetId}
                        imageUrl={imageUrl}
                        onChange={setImageUrl}
                      />
                      <Divider my={3} />
                      <MediaAudioList
                        studySetId={studySetId}
                        audios={backAudios}
                        onChange={setBackAudios}
                        title="Back Audios"
                      />
                    </Box>
                  </Stack>
                )}
              </TabPanel>

              <TabPanel px={0} py={0}>
                <AnkiCard
                  frontHtml={previewHtml.front || "<i>(Empty front)</i>"}
                  backHtml={previewHtml.back || "<i>(Empty back)</i>"}
                  assetUrl={previewHtml.assetUrl}
                  customCss={resolvedTemplate.css}
                  isAnswerShown
                  disableAutoPlay
                />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>

        <ModalFooter
          gap={3}
          borderTopWidth="1px"
          borderColor={borderColor}
          px={{ base: 4, md: 6 }}
        >
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="orange"
            leftIcon={!isEditing ? <IconPlus size={16} /> : undefined}
            isLoading={isSaving}
            onClick={handleSave}
          >
            {isEditing ? "Save Changes" : "Add Card"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AnkiCardEditorModal;
