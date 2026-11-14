import { useRouter } from "next/router";
import React from "react";

import { Modal } from "@quenti/components/modal";
import { api } from "@quenti/trpc";

import {
  Box,
  Button,
  ButtonGroup,
  Fade,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Input,
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

import { QUIZLET_IMPORT_REGEXP } from "../../../../packages/lib/constants/characters";
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
  "Generating witty dialog...",
  "Spinning the hamster...",
  "Searching for plot device...",
  "Updating the Updater...",
  "Simulating traveling salesman...",
  "Downloading the Downloader...",
  "Shovelling coal into the server...",
  "Parsing Quizlet cards...",
  "Cleaning off Quizlet's cobwebs...",
  "Feel free to spin in your chair...",
  "Twiddling thumbs...",
  "Consulting the manual...",
  "Optimizing the terms...",
  "Reheating coffee...",
];

export const ImportFromQuizletModal: React.FC<ImportFromQuizletModalProps> = ({
  isOpen,
  onClose,
  edit = false,
}) => {
  const { event } = useTelemetry();
  const router = useRouter();

  const [tabIndex, setTabIndex] = React.useState(0);
  const [_url, setUrl] = React.useState("");
  const [rawText, setRawText] = React.useState("");
  const [customTitle, setCustomTitle] = React.useState("");
  const [error, setError] = React.useState("");
  const [importStarted, setImportStarted] = React.useState<number | null>(null);

  const attemptFormat = (u: string) => {
    const parsed = u.replace(/^(https?:\/\/)?/, "");
    const segments = parsed.split("/");
    const id = segments.find((segment) => /^\d+$/.test(segment));
    if (id) {
      return `https://quizlet.com/${id}`;
    }
    return u;
  };

  const url = attemptFormat(_url);
  const urlIsShare = url
    .replace("http://", "")
    .replace("https://", "")
    .startsWith("quizlet.com/_");
  const isUrlMode = tabIndex === 0;
  const invalidUrl = isUrlMode && !!url && !QUIZLET_IMPORT_REGEXP.test(url);

  // Count detected terms in raw text
  const detectedTermsCount = React.useMemo(() => {
    if (!rawText.trim()) return 0;
    return rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0).length;
  }, [rawText]);

  const errorText = useColorModeValue("red.500", "red.200");
  const spinnerBg = useColorModeValue("gray.200", "gray.600");
  const helperBoxBg = useColorModeValue("blue.50", "blue.950");
  const helperBoxBorder = useColorModeValue("blue.200", "blue.800");

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
  const defaultMessage = "Hang on while we fetch your set...";
  const [message, setMessage] = React.useState(defaultMessage);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMessage((msg) => {
        let newMsg = msg;
        while (newMsg === msg) {
          newMsg =
            messages[Math.floor(Math.random() * (messages.length - 1))]!;
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

  const isCloudflareBlocked = error.includes("CLOUDFLARE_BLOCKED");

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered={false}>
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
        >
          <Modal.Body>
            <Modal.Heading>Import from Quizlet</Modal.Heading>

            <Tabs
              index={tabIndex}
              onChange={(idx) => {
                setTabIndex(idx);
                setError("");
              }}
              variant="soft-rounded"
              colorScheme="blue"
              size="sm"
              mb={4}
            >
              <TabList>
                <Tab fontWeight={600}>Quizlet Link</Tab>
                <Tab fontWeight={600}>Paste Export Text</Tab>
              </TabList>

              <TabPanels mt={3}>
                {/* Panel 1: URL import */}
                <TabPanel p={0}>
                  <FormControl isInvalid={!!error || invalidUrl}>
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
                        // If user pastes tabbed/multiline text into URL field, switch to text tab automatically
                        if (val.includes("\t") || val.includes("\n")) {
                          setRawText(val);
                          setTabIndex(1);
                        } else {
                          setUrl(val);
                        }
                      }}
                    />
                    {urlIsShare && (
                      <Text mt="3" fontSize="sm" color="gray.500">
                        Copy the link directly from your browser&apos;s address bar.
                      </Text>
                    )}
                    {isCloudflareBlocked ? (
                      <Box
                        mt={4}
                        p={3}
                        bg={helperBoxBg}
                        border="1px solid"
                        borderColor={helperBoxBorder}
                        rounded="lg"
                      >
                        <Text fontSize="sm" fontWeight={600} mb={2}>
                          Quizlet Cloudflare Challenge
                        </Text>
                        <Text fontSize="xs" mb={3} color="gray.600" _dark={{ color: "gray.300" }}>
                          Quizlet is currently blocking direct automated URL requests.
                          You can copy the cards in Quizlet via <strong>... &gt; Export</strong> and paste them in the &quot;Paste Export Text&quot; tab.
                        </Text>
                        <Button
                          size="xs"
                          colorScheme="blue"
                          onClick={() => {
                            setTabIndex(1);
                            setError("");
                          }}
                        >
                          Switch to Paste Export Text
                        </Button>
                      </Box>
                    ) : (
                      error && (
                        <FormErrorMessage color={errorText} fontWeight={600} mt="3">
                          {error}
                        </FormErrorMessage>
                      )
                    )}
                  </FormControl>
                </TabPanel>

                {/* Panel 2: Paste export text */}
                <TabPanel p={0}>
                  <Stack spacing={3}>
                    <Box
                      p={3}
                      bg="gray.50"
                      rounded="lg"
                      fontSize="xs"
                      color="gray.600"
                      _dark={{ bg: "gray.700", color: "gray.300" }}
                    >
                      In Quizlet: Click <strong>... &gt; Export &gt; Copy text</strong>, then paste below.
                      Terms separated by Tab and rows separated by Newline are automatically recognized.
                    </Box>

                    <FormControl>
                      <FormLabel fontSize="xs" fontWeight={600} mb={1}>
                        Set Title (optional)
                      </FormLabel>
                      <Input
                        placeholder="e.g. Spanish Vocabulary Unit 1"
                        size="sm"
                        rounded="md"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                      />
                    </FormControl>

                    <FormControl isInvalid={!!error}>
                      <FormLabel fontSize="xs" fontWeight={600} mb={1}>
                        Cards Export Data {detectedTermsCount > 0 && `(${detectedTermsCount} terms detected)`}
                      </FormLabel>
                      <Textarea
                        rows={6}
                        placeholder={"term 1\tdefinition 1\nterm 2\tdefinition 2\nterm 3\tdefinition 3"}
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
                  </Stack>
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
                        : detectedTermsCount === 0
                    }
                    onClick={async () => {
                      setError("");
                      setImportStarted(Date.now());
                      if (isUrlMode) {
                        await fromUrl.mutateAsync({
                          url,
                        });
                      } else {
                        await fromUrl.mutateAsync({
                          text: rawText,
                          title: customTitle.trim() || undefined,
                        });
                      }
                    }}
                  >
                    Import
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
