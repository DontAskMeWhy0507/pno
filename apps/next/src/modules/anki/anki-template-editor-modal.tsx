import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  ANKI_DECK_PRESETS,
  type AnkiDeckTemplate,
  getAnkiPreset,
  parseAnkiCardFields,
} from "@quenti/lib/src/anki/presets";
import {
  renderAnkiCard,
  stripFrontSidePrefix,
} from "@quenti/lib/src/anki/template";
import { outfit } from "@quenti/lib/chakra-theme";
import { api } from "@quenti/trpc";

import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  TagCloseButton,
  TagLabel,
  Text,
  Textarea,
  Wrap,
  WrapItem,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import { IconCode, IconPlus } from "@tabler/icons-react";

import { AnkiCard } from "./anki-card";

export interface AnkiTemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  studySetId: string;
  currentTemplate?: AnkiDeckTemplate | null;
  sampleCardWordRichText?: unknown;
}

export const AnkiTemplateEditorModal: React.FC<AnkiTemplateEditorModalProps> = ({
  isOpen,
  onClose,
  studySetId,
  currentTemplate,
  sampleCardWordRichText,
}) => {
  const toast = useToast();
  const utils = api.useUtils();

  const [fields, setFields] = useState<string[]>([]);
  const [newFieldName, setNewFieldName] = useState("");
  const [qfmt, setQfmt] = useState("");
  const [afmt, setAfmt] = useState("");
  const [css, setCss] = useState("");
  const [isCloze, setIsCloze] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState(0);

  const qfmtRef = useRef<HTMLTextAreaElement>(null);
  const afmtRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const base = currentTemplate ?? getAnkiPreset("vocab_pro");
    setFields([...base.fields]);
    setQfmt(base.qfmt);
    setAfmt(base.afmt);
    setCss(base.css);
    setIsCloze(Boolean(base.isCloze || base.qfmt.includes("{{cloze:")));
    setNewFieldName("");
  }, [isOpen, currentTemplate]);

  const updateTemplateMutation = api.anki.updateTemplate.useMutation({
    onSuccess: async (res) => {
      await Promise.all([
        utils.studySets.invalidate(),
        utils.anki.getReviewQueue.invalidate({ studySetId }),
      ]);
      toast({
        title: "Card template saved",
        description:
          res.updatedCardsCount > 0
            ? `Updated layout across ${res.updatedCardsCount} cards.`
            : "Template updated for new cards.",
        status: "success",
        duration: 2800,
      });
      onClose();
    },
    onError: (err) => {
      toast({
        title: "Could not save template",
        description: err.message,
        status: "error",
        duration: 3500,
      });
    },
  });

  const sampleFields = useMemo(() => {
    const existing = parseAnkiCardFields(sampleCardWordRichText)?.ankiFields;
    if (existing && Object.keys(existing).length > 0) return existing;

    const fallback: Record<string, string> = {};
    for (const f of fields) {
      if (/ipa|phonetic/i.test(f)) fallback[f] = "/krʌst/";
      else if (/word|front/i.test(f)) fallback[f] = "crust";
      else if (/example/i.test(f) && !/audio/i.test(f))
        fallback[f] = "The little boy never ate the <b>crust</b> of his pizza.";
      else if (/meaning|back|extra/i.test(f) && !/audio/i.test(f))
        fallback[f] = "<i>Crust</i> is the tough outer part of a loaf of bread.";
      else if (/text/i.test(f))
        fallback[f] = "Canberra is the capital of {{c1::Australia::country}}.";
      else if (/audio|sound/i.test(f)) fallback[f] = "";
      else if (/image|img/i.test(f)) fallback[f] = "";
      else fallback[f] = `Sample ${f}`;
    }
    return fallback;
  }, [sampleCardWordRichText, fields]);

  const renderedPreview = useMemo(() => {
    const rendered = renderAnkiCard({
      qfmt,
      afmt,
      fields: sampleFields,
      clozeOrdinal: 1,
    });
    return {
      front: rendered.questionHtml,
      back: stripFrontSidePrefix(rendered.questionHtml, rendered.answerHtml),
    };
  }, [qfmt, afmt, sampleFields]);

  const insertToken = (token: string) => {
    const isFront = activeCodeTab === 0;
    const isBack = activeCodeTab === 1;
    if (!isFront && !isBack) return;

    const targetRef = isFront ? qfmtRef.current : afmtRef.current;
    const setter = isFront ? setQfmt : setAfmt;
    const val = isFront ? qfmt : afmt;

    if (!targetRef) {
      setter(`${val}${token}`);
      return;
    }
    const start = targetRef.selectionStart ?? val.length;
    const end = targetRef.selectionEnd ?? val.length;
    setter(val.slice(0, start) + token + val.slice(end));
  };

  const handleAddField = () => {
    const clean = newFieldName.trim();
    if (!clean || fields.includes(clean)) return;
    setFields([...fields, clean]);
    setNewFieldName("");
  };

  const borderColor = useColorModeValue("gray.200", "gray.700");
  const panelBg = useColorModeValue("gray.50", "gray.800");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={{ base: "full", md: "4xl" }}
      scrollBehavior="inside"
      isCentered
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader pb={2}>
          <HStack spacing={2}>
            <IconCode size={20} />
            <Text fontFamily={outfit.style.fontFamily} fontWeight={800}>
              Anki Fields &amp; Card Template (HTML / CSS)
            </Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton rounded="full" top={4} right={4} />

        <ModalBody px={{ base: 4, md: 6 }} py={3}>
          <Stack spacing={5}>
            {/* Presets quick switch */}
            <HStack spacing={2} flexWrap="wrap">
              <Text fontSize="xs" fontWeight={700} color="gray.500">
                Load Preset:
              </Text>
              {ANKI_DECK_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    setFields([...p.fields]);
                    setQfmt(p.qfmt);
                    setAfmt(p.afmt);
                    setCss(p.css);
                    setIsCloze(Boolean(p.isCloze));
                  }}
                >
                  {p.name}
                </Button>
              ))}
            </HStack>

            {/* Fields Manager */}
            <Box
              p={3.5}
              rounded="xl"
              bg={panelBg}
              borderWidth="1px"
              borderColor={borderColor}
            >
              <FormLabel fontSize="sm" fontWeight={700} mb={2}>
                Fields ({fields.length}) — Click a field below to insert into HTML
              </FormLabel>
              <Wrap spacing={2} mb={3}>
                {fields.map((f) => (
                  <WrapItem key={f}>
                    <Tag
                      size="md"
                      rounded="lg"
                      colorScheme="blue"
                      variant="subtle"
                      cursor="pointer"
                      onClick={() =>
                        insertToken(
                          isCloze && f.toLowerCase() === "text"
                            ? `{{cloze:${f}}}`
                            : `{{${f}}}`,
                        )
                      }
                    >
                      <TagLabel fontWeight={600}>{f}</TagLabel>
                      {fields.length > 1 && (
                        <TagCloseButton
                          onClick={(e) => {
                            e.stopPropagation();
                            setFields(fields.filter((x) => x !== f));
                          }}
                        />
                      )}
                    </Tag>
                  </WrapItem>
                ))}
              </Wrap>
              <HStack maxW="360px">
                <Input
                  size="sm"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="New field name (e.g. Synonyms)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddField();
                    }
                  }}
                />
                <Button
                  size="sm"
                  leftIcon={<IconPlus size={14} />}
                  onClick={handleAddField}
                >
                  Add Field
                </Button>
              </HStack>
            </Box>

            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
              {/* Left: Template Code Tabs */}
              <Box>
                <Tabs
                  index={activeCodeTab}
                  onChange={setActiveCodeTab}
                  colorScheme="blue"
                  size="sm"
                  variant="soft-rounded"
                >
                  <TabList mb={3} flexWrap="wrap">
                    <Tab fontWeight={700}>Front HTML</Tab>
                    <Tab fontWeight={700}>Back HTML</Tab>
                    <Tab fontWeight={700}>Styling CSS</Tab>
                  </TabList>

                  <TabPanels>
                    <TabPanel px={0} py={0}>
                      <FormControl>
                        <Textarea
                          ref={qfmtRef}
                          value={qfmt}
                          onChange={(e) => setQfmt(e.target.value)}
                          fontFamily="mono"
                          fontSize="xs"
                          rows={12}
                        />
                      </FormControl>
                    </TabPanel>
                    <TabPanel px={0} py={0}>
                      <FormControl>
                        <Textarea
                          ref={afmtRef}
                          value={afmt}
                          onChange={(e) => setAfmt(e.target.value)}
                          fontFamily="mono"
                          fontSize="xs"
                          rows={12}
                        />
                      </FormControl>
                    </TabPanel>
                    <TabPanel px={0} py={0}>
                      <FormControl>
                        <Textarea
                          value={css}
                          onChange={(e) => setCss(e.target.value)}
                          fontFamily="mono"
                          fontSize="xs"
                          rows={12}
                        />
                      </FormControl>
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              </Box>

              {/* Right: Live Preview */}
              <Stack spacing={2}>
                <HStack justify="space-between">
                  <Text fontSize="xs" fontWeight={700} textTransform="uppercase">
                    Live Card Preview
                  </Text>
                  <Badge colorScheme="green" fontSize="2xs">
                    Scoped CSS
                  </Badge>
                </HStack>
                <AnkiCard
                  frontHtml={renderedPreview.front}
                  backHtml={renderedPreview.back}
                  customCss={css}
                  isAnswerShown
                  disableAutoPlay
                />
              </Stack>
            </SimpleGrid>
          </Stack>
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
            colorScheme="blue"
            isLoading={updateTemplateMutation.isLoading}
            onClick={() =>
              updateTemplateMutation.mutate({
                studySetId,
                template: {
                  presetId: "custom",
                  fields,
                  qfmt,
                  afmt,
                  css,
                  isCloze: isCloze || qfmt.includes("{{cloze:"),
                },
              })
            }
          >
            Save &amp; Apply to Deck
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AnkiTemplateEditorModal;
