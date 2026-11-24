import { useRouter } from "next/router";
import React from "react";

import { Modal } from "@pno/components/modal";
import { parseQuizletExportText } from "@pno/lib/src/quizlet/parser";
import { api } from "@pno/trpc";

import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Fade,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Input,
  Radio,
  RadioGroup,
  ScaleFade,
  SlideFade,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  keyframes,
  useColorModeValue,
} from "@chakra-ui/react";

import { QUIZLET_IMPORT_REGEXP } from "@pno/lib/constants/characters";
import { effectChannel } from "../events/effects";
import { queryEventChannel } from "../events/query";
import { useTelemetry } from "../lib/telemetry";
import styles from "./glow-wrapper.module.css";

export interface ImportFromQuizletModalProps {
  isOpen: boolean;
  onClose: () => void;
  edit?: boolean;
}

const spin = keyframes({
  "0%": {
    transform: "rotate(0deg)",
  },
  "80%": {
    color: "#ffbf7d",
  },
  "100%": {
    transform: "rotate(360deg)",
  },
});

const messages = [
  "Parsing Quizlet cards...",
  "Formatting terms and definitions...",
  "Applying study set tags...",
  "Organizing flashcard deck...",
  "Creating cards in database...",
  "Optimizing for active recall...",
];

export const ImportFromQuizletModal: React.FC<ImportFromQuizletModalProps> = ({
  isOpen,
  onClose,
  edit = false,
}) => {
  const { event } = useTelemetry();
  const router = useRouter();

  // Mode: 0 for "Paste Export Text", 1 for "Quizlet Link"
  const [tabIndex, setTabIndex] = React.useState(0);
  const [_url, setUrl] = React.useState("");
  const [rawText, setRawText] = React.useState("");
  const [customTitle, setCustomTitle] = React.useState("");
  const [error, setError] = React.useState("");
  const [importStarted, setImportStarted] = React.useState<number | null>(null);

  // Delimiter controls (matching Quizlet's export/import format)
  const [termDelimType, setTermDelimType] = React.useState<string>("auto");
  const [customTermDelim, setCustomTermDelim] = React.useState<string>("@");
  const [rowDelimType, setRowDelimType] = React.useState<string>("auto");
  const [customRowDelim, setCustomRowDelim] = React.useState<string>("\\n\\n");

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const attemptFormat = (u: string) => {
    const trimmed = u.trim();
    if (!trimmed) return "";
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    try {
      const parsed = new URL(withProtocol);
      if (
        parsed.hostname === "quizlet.com" ||
        parsed.hostname === "www.quizlet.com"
      ) {
        parsed.protocol = "https:";
        parsed.hash = "";
        parsed.search = "";
        return parsed.toString().replace(/\/$/, "");
      }
    } catch {
      // Fallback
    }
    return trimmed;
  };

  const handleUploadTextFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(text) as
          | { word?: string; term?: string; definition?: string }[]
          | { terms?: { word?: string; term?: string; definition?: string }[]; title?: string };
        const items = Array.isArray(parsed) ? parsed : parsed.terms || [];
        if (!Array.isArray(parsed) && parsed.title && !customTitle) {
          setCustomTitle(parsed.title);
        }
        const formatted = items
          .map((item) => `${item.word || item.term || ""}\t${item.definition || ""}`)
          .filter((l) => l.trim().length > 0)
          .join("\n");
        setTermDelimType("tab");
        setRowDelimType("newline");
        setRawText(formatted);
      } else {
        setRawText(text);
        if (!customTitle) {
          setCustomTitle(file.name.replace(/\.(txt|csv|tsv)$/i, ""));
        }
      }
    } catch {
      setError("Could not read the selected file.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const url = attemptFormat(_url);
  const isUrlMode = tabIndex === 1;
  const invalidUrl = isUrlMode && !!url && !QUIZLET_IMPORT_REGEXP.test(url);

  // Real-time live preview of parsed cards using the selected delimiters
  const previewTerms = React.useMemo(() => {
    if (!rawText.trim()) return [];
    try {
      return parseQuizletExportText(rawText, {
        termDelimiter: termDelimType,
        customTermDelimiter: customTermDelim,
        rowDelimiter: rowDelimType,
        customRowDelimiter: customRowDelim,
      });
    } catch {
      return [];
    }
  }, [rawText, termDelimType, customTermDelim, rowDelimType, customRowDelim]);

  const errorText = useColorModeValue("red.500", "red.200");
  const spinnerBg = useColorModeValue("gray.200", "gray.600");
  const cardBorder = useColorModeValue("gray.200", "gray.700");
  const cardBg = useColorModeValue("gray.50", "gray.750");
  const subtleText = useColorModeValue("gray.600", "gray.400");
  const optionBoxBg = useColorModeValue("gray.50", "gray.700");

  const fromUrl = api.import.fromUrl.useMutation({
    onSuccess: async (data) => {
      if (data) {
        const finished = Date.now();
        const elapsed = importStarted ? finished - importStarted : 0;

        void event("import_completed", {
          setId: data.createdSetId,
          title: data.title,
          terms: data.terms,
          origin: isUrlMode ? url : "export_text",
          source: "quizlet",
          elapsed,
        });

        await router.push(
          !edit ? `/${data.createdSetId}` : `/${data.createdSetId}/edit`,
        );

        onClose();
        requestAnimationFrame(() => {
          setUrl("");
          setRawText("");
          setCustomTitle("");
          setError("");
        });

        if (!edit) {
          effectChannel.emit("prepareConfetti");
          const handler = () => {
            effectChannel.emit("confetti");
            queryEventChannel.off("setQueryRefetched", handler);
          };
          queryEventChannel.on("setQueryRefetched", handler);
        }
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const isLoading = fromUrl.isLoading;
  const defaultMessage = "Hang on while we import your set...";
  const [message, setMessage] = React.useState(defaultMessage);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMessage((msg) => {
        let newMsg = msg;
        while (newMsg === msg) {
          newMsg = messages[Math.floor(Math.random() * messages.length)]!;
        }
        return newMsg;
      });
    }, 4000);

    if (!isLoading) {
      clearInterval(interval);
      setMessage(defaultMessage);
    }

    return () => {
      clearInterval(interval);
    };
  }, [isLoading]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isLoading) {
          setError("");
          onClose();
        }
      }}
      size="2xl"
      isCentered={false}
    >
      <Modal.Overlay />
      <Modal.Content
        className={styles.card}
        _before={{
          opacity: isLoading ? 1 : 0,
        }}
        _after={{
          opacity: isLoading ? 1 : 0,
        }}
      >
        <Stack
          bg="white"
          _dark={{
            bg: "gray.800",
          }}
          rounded="xl"
          spacing={0}
        >
          <Modal.Body pb={2}>
            <Modal.Heading mb={3}>Import from Quizlet</Modal.Heading>

            <Tabs
              index={tabIndex}
              onChange={(idx) => {
                setTabIndex(idx);
                setError("");
              }}
              variant="soft-rounded"
              colorScheme="blue"
              size="sm"
              mb={3}
            >
              <TabList>
                <Tab fontWeight={700}>Paste Export Text</Tab>
                <Tab fontWeight={700}>Quizlet Link</Tab>
              </TabList>

              <TabPanels mt={3}>
                {/* Panel 0: Paste Export Text (matching Quizlet's exact export popup) */}
                <TabPanel p={0}>
                  <Stack spacing={3}>
                    {/* Delimiter controls matching Quizlet */}
                    <Box
                      p={3}
                      bg={optionBoxBg}
                      rounded="lg"
                      border="1px solid"
                      borderColor={cardBorder}
                    >
                      <Flex direction={{ base: "column", md: "row" }} gap={4}>
                        {/* Between term and definition */}
                        <Box flex="1">
                          <Text fontSize="xs" fontWeight={700} mb={2}>
                            Between term and definition
                          </Text>
                          <RadioGroup
                            size="sm"
                            value={termDelimType}
                            onChange={(val) => setTermDelimType(val)}
                          >
                            <Stack spacing={1}>
                              <Radio value="auto">Auto-detect</Radio>
                              <Radio value="tab">Tab</Radio>
                              <Radio value="comma">Comma</Radio>
                              <HStack spacing={2} align="center">
                                <Radio value="custom">Custom</Radio>
                                {termDelimType === "custom" && (
                                  <Input
                                    size="xs"
                                    w="60px"
                                    value={customTermDelim}
                                    onChange={(e) =>
                                      setCustomTermDelim(e.target.value)
                                    }
                                    placeholder="@"
                                    fontFamily="monospace"
                                  />
                                )}
                              </HStack>
                            </Stack>
                          </RadioGroup>
                        </Box>

                        {/* Between rows */}
                        <Box flex="1">
                          <Text fontSize="xs" fontWeight={700} mb={2}>
                            Between rows (cards)
                          </Text>
                          <RadioGroup
                            size="sm"
                            value={rowDelimType}
                            onChange={(val) => setRowDelimType(val)}
                          >
                            <Stack spacing={1}>
                              <Radio value="auto">Auto-detect</Radio>
                              <Radio value="newline">New line</Radio>
                              <Radio value="semicolon">Semicolon</Radio>
                              <HStack spacing={2} align="center">
                                <Radio value="custom">Custom</Radio>
                                {rowDelimType === "custom" && (
                                  <Input
                                    size="xs"
                                    w="70px"
                                    value={customRowDelim}
                                    onChange={(e) =>
                                      setCustomRowDelim(e.target.value)
                                    }
                                    placeholder="\n\n"
                                    fontFamily="monospace"
                                  />
                                )}
                              </HStack>
                            </Stack>
                          </RadioGroup>
                        </Box>
                      </Flex>
                    </Box>

                    {/* Title */}
                    <FormControl>
                      <FormLabel fontSize="xs" fontWeight={700} mb={1}>
                        Set Title (optional)
                      </FormLabel>
                      <Input
                        placeholder="e.g. Vocabulary Unit 1"
                        size="sm"
                        rounded="md"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                      />
                    </FormControl>

                    {/* Textarea for pasted cards */}
                    <FormControl isInvalid={!!error}>
                      <Flex justify="space-between" align="center" mb={1} wrap="wrap" gap={2}>
                        <FormLabel fontSize="xs" fontWeight={700} m={0}>
                          Copy &amp; paste text from Quizlet Export
                        </FormLabel>
                        <HStack spacing={2}>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".txt,.csv,.tsv,.json"
                            style={{ display: "none" }}
                            onChange={handleUploadTextFile}
                          />
                          <Button
                            size="xs"
                            variant="outline"
                            colorScheme="blue"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            Upload .txt / .csv / .json
                          </Button>
                          <Badge
                            colorScheme={previewTerms.length > 0 ? "green" : "gray"}
                            fontSize="xs"
                            px={2}
                            py={0.5}
                            rounded="full"
                          >
                            {previewTerms.length} card
                            {previewTerms.length !== 1 ? "s" : ""} detected
                          </Badge>
                        </HStack>
                      </Flex>
                      <Textarea
                        rows={5}
                        placeholder={
                          'escalate @to become or make something become greater or more serious.\n"His financial problems escalated after he became unemployed."\nv. / to increase rapidly\n\ndestructive @causing, or able to cause, damage.'
                        }
                        fontFamily="monospace"
                        fontSize="xs"
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                      />
                      {error && (
                        <FormErrorMessage color={errorText} fontWeight={600} mt="2">
                          {error}
                        </FormErrorMessage>
                      )}
                    </FormControl>

                    {/* Live Preview List */}
                    {previewTerms.length > 0 && (
                      <Box>
                        <Text fontSize="xs" fontWeight={700} mb={1} color={subtleText}>
                          Preview first {Math.min(previewTerms.length, 5)} of{" "}
                          {previewTerms.length} cards:
                        </Text>
                        <Stack spacing={2} maxH="130px" overflowY="auto" pr={1}>
                          {previewTerms.slice(0, 5).map((term, i) => (
                            <Box
                              key={i}
                              p={2}
                              bg={cardBg}
                              border="1px solid"
                              borderColor={cardBorder}
                              rounded="md"
                              fontSize="xs"
                            >
                              <HStack align="start" spacing={3}>
                                <Badge colorScheme="blue" fontSize="9px">
                                  #{i + 1}
                                </Badge>
                                <Box flex="1">
                                  <Text fontWeight={700} color="blue.500">
                                    {term.word || "(Empty Term)"}
                                  </Text>
                                  <Text
                                    whiteSpace="pre-wrap"
                                    color={subtleText}
                                    mt={0.5}
                                  >
                                    {term.definition || "(Empty Definition)"}
                                  </Text>
                                </Box>
                              </HStack>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                </TabPanel>

                {/* Panel 1: Quizlet Link */}
                <TabPanel p={0}>
                  <FormControl isInvalid={!!error || invalidUrl}>
                    <Text fontSize="xs" color={subtleText} mb={2}>
                      Enter a public Quizlet study set link:
                    </Text>
                    <Input
                      placeholder="https://quizlet.com/123456789/set-title"
                      variant="flushed"
                      isInvalid={invalidUrl}
                      rounded="lg"
                      fontWeight={600}
                      bg="gray.100"
                      px="14px"
                      _dark={{
                        bg: "gray.700",
                      }}
                      value={_url}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.includes("\t") || val.includes("\n") || val.includes("@")) {
                          setRawText(val);
                          setTabIndex(0);
                        } else {
                          setUrl(val);
                        }
                      }}
                    />
                    {error && (
                      <FormErrorMessage color={errorText} fontWeight={600} mt="3">
                        {error}
                      </FormErrorMessage>
                    )}
                  </FormControl>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Modal.Body>

          <Modal.Divider />
          <Modal.Footer>
            <HStack justifyContent="space-between" w="full">
              <HStack spacing="3">
                <ScaleFade
                  in={isLoading}
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Spinner
                    size="sm"
                    color="blue.300"
                    animation={`${spin} 1.25s cubic-bezier(.54,-0.18,.39,.97) infinite`}
                    style={{
                      animationDelay: "0.8s",
                    }}
                    emptyColor={spinnerBg}
                  />
                </ScaleFade>
                <SlideFade in={isLoading}>
                  <Text fontSize="sm" fontWeight={600}>
                    {message}
                  </Text>
                </SlideFade>
              </HStack>

              <Fade in={!isLoading}>
                <ButtonGroup gap={2} isDisabled={isLoading}>
                  <Button variant="ghost" colorScheme="gray" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    isLoading={fromUrl.isLoading}
                    isDisabled={
                      isUrlMode
                        ? !url || invalidUrl
                        : previewTerms.length === 0
                    }
                    onClick={() => {
                      setError("");
                      setImportStarted(Date.now());
                      if (isUrlMode) {
                        fromUrl.mutate({
                          url,
                        });
                      } else {
                        fromUrl.mutate({
                          text: rawText,
                          title: customTitle.trim() || undefined,
                          termDelimiter: termDelimType,
                          customTermDelimiter: customTermDelim,
                          rowDelimiter: rowDelimType,
                          customRowDelimiter: customRowDelim,
                        });
                      }
                    }}
                  >
                    Import {!isUrlMode && previewTerms.length > 0 && `(${previewTerms.length})`}
                  </Button>
                </ButtonGroup>
              </Fade>
            </HStack>
          </Modal.Footer>
        </Stack>
      </Modal.Content>
    </Modal>
  );
};

export default ImportFromQuizletModal;
