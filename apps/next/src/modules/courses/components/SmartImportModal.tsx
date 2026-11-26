import React from "react";

import { outfit } from "@pno/lib/chakra-theme";

import {
  Alert,
  AlertIcon,
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
  Select,
  SimpleGrid,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  useColorModeValue,
} from "@chakra-ui/react";

import {
  IconCheck,
  IconFileCode,
  IconSparkles,
  IconUpload,
} from "@tabler/icons-react";

import type { CourseDetail, CourseTrack } from "../types";
import {
  parseAiMarkdownCourse,
  parseHtmlCourse,
  slugifyCourseId,
} from "../utils/importers";
import { normalizeCourseDetail } from "../utils/storage";

interface SmartImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCourse: (course: CourseDetail) => void;
}

const TRACKS: CourseTrack[] = [
  "Python",
  "SQL",
  "R",
  "Git",
  "JavaScript",
  "Excel",
];
const LEVELS = ["Beginner", "Intermediate", "Advanced", "Specialized"];

const SAMPLE_AI_MD = `# Chapter 1: Getting Started
## Variables and Data Types
Write **Markdown** or paste notes directly from ChatGPT / Gemini / Claude.

\`\`\`python
name = "Data Learner"
print(f"Hello, {name}!")
\`\`\`

## [Quiz] Quick Check
1. Which function outputs text to the console in Python?
A) echo()
*B) print()
C) console.log()
D) write()
Explanation: print() writes text to standard output in Python.

## [Practice] Print a Greeting
Create a variable \`language = "Python"\` and print \`"Learning Python"\`.

\`\`\`python
language = "Python"
print(f"Learning {language}")
\`\`\``;

export const SmartImportModal: React.FC<SmartImportModalProps> = ({
  isOpen,
  onClose,
  onImportCourse,
}) => {
  const [tabIndex, setTabIndex] = React.useState(0);
  const [title, setTitle] = React.useState("");
  const [track, setTrack] = React.useState<CourseTrack>("Python");
  const [level, setLevel] = React.useState("Beginner");
  const [description, setDescription] = React.useState("");
  const [markdownText, setMarkdownText] = React.useState("");
  const [htmlText, setHtmlText] = React.useState("");
  const [jsonText, setJsonText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const codeBg = useColorModeValue("gray.50", "gray.900");
  const subText = useColorModeValue("gray.600", "gray.400");

  React.useEffect(() => {
    if (isOpen) setError(null);
  }, [isOpen]);

  const mdPreview = React.useMemo(() => {
    if (!markdownText.trim()) return null;
    return parseAiMarkdownCourse(markdownText, {
      title: title || "New AI Course",
      track,
      level,
      description,
    });
  }, [markdownText, title, track, level, description]);

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: "html" | "json",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      if (kind === "html") {
        setHtmlText(content);
        if (!title) {
          setTitle(
            file.name
              .replace(/\.html?$/i, "")
              .replace(/^00\s*-\s*\[.*?\]\s*/i, ""),
          );
        }
      } else {
        setJsonText(content);
      }
      setError(null);
    };
    reader.readAsText(file, "utf-8");
  };

  const handleImport = () => {
    setError(null);
    try {
      if (tabIndex === 0) {
        if (!title.trim()) {
          setError("Please enter a course title.");
          return;
        }
        if (!markdownText.trim()) {
          setError("Please paste Markdown / AI text content.");
          return;
        }
        const parsed = parseAiMarkdownCourse(markdownText, {
          title: title.trim(),
          track,
          level,
          description: description.trim(),
        });
        if (parsed.lessonCount === 0) {
          setError(
            "Could not detect any lessons. Use `## Lesson Title` headings.",
          );
          return;
        }
        onImportCourse(parsed);
        onClose();
        return;
      }

      if (tabIndex === 1) {
        if (!htmlText.trim()) {
          setError("Please upload or paste HTML content.");
          return;
        }
        const parsed = parseHtmlCourse(htmlText, title, track, level);
        if (parsed.lessonCount === 0) {
          setError("No lessons found in HTML.");
          return;
        }
        onImportCourse(parsed);
        onClose();
        return;
      }

      // Tab 2: JSON
      if (!jsonText.trim()) {
        setError("Please upload or paste JSON content.");
        return;
      }
      const rawObj = JSON.parse(jsonText) as CourseDetail;
      if (!rawObj || !rawObj.title || !Array.isArray(rawObj.chapters)) {
        setError(
          "Invalid course JSON format (requires title and chapters array).",
        );
        return;
      }
      const normalized = normalizeCourseDetail({
        ...rawObj,
        id: rawObj.id || slugifyCourseId(rawObj.title),
        isCustom: true,
        updatedAt: Date.now(),
      });
      onImportCourse(normalized);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={{ base: "full", md: "4xl" }}
      scrollBehavior="inside"
    >
      <ModalOverlay />
      <ModalContent rounded="2xl">
        <ModalHeader fontFamily={outfit.style.fontFamily}>
          Smart Course Import
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <Stack spacing={4}>
            {error && (
              <Alert status="error" rounded="xl" fontSize="sm">
                <AlertIcon />
                {error}
              </Alert>
            )}

            <Tabs
              index={tabIndex}
              onChange={(i) => {
                setTabIndex(i);
                setError(null);
              }}
              colorScheme="blue"
              variant="soft-rounded"
            >
              <TabList gap={2} flexWrap="wrap">
                <Tab rounded="xl" fontWeight={700} fontSize="sm">
                  <HStack spacing={1.5}>
                    <IconSparkles size={16} />
                    <span>Paste AI Text / Markdown</span>
                  </HStack>
                </Tab>
                <Tab rounded="xl" fontWeight={700} fontSize="sm">
                  <HStack spacing={1.5}>
                    <IconFileCode size={16} />
                    <span>Upload HTML</span>
                  </HStack>
                </Tab>
                <Tab rounded="xl" fontWeight={700} fontSize="sm">
                  <HStack spacing={1.5}>
                    <IconUpload size={16} />
                    <span>Import JSON</span>
                  </HStack>
                </Tab>
              </TabList>

              <TabPanels mt={3}>
                {/* Tab 0: Markdown / AI Paste */}
                <TabPanel px={0}>
                  <Stack spacing={4}>
                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                      <FormControl isRequired>
                        <FormLabel fontSize="xs" fontWeight={700}>
                          Course Title
                        </FormLabel>
                        <Input
                          size="sm"
                          rounded="lg"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g. Python Data Cleaning"
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs" fontWeight={700}>
                          Track
                        </FormLabel>
                        <Select
                          size="sm"
                          rounded="lg"
                          value={track}
                          onChange={(e) =>
                            setTrack(e.target.value as CourseTrack)
                          }
                        >
                          {TRACKS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs" fontWeight={700}>
                          Level
                        </FormLabel>
                        <Select
                          size="sm"
                          rounded="lg"
                          value={level}
                          onChange={(e) => setLevel(e.target.value)}
                        >
                          {LEVELS.map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                    </SimpleGrid>

                    <FormControl>
                      <FormLabel fontSize="xs" fontWeight={700}>
                        Short Description
                      </FormLabel>
                      <Input
                        size="sm"
                        rounded="lg"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief 1-sentence summary shown on the course card"
                      />
                    </FormControl>

                    <Box>
                      <HStack justify="space-between" mb={1.5}>
                        <Text fontSize="xs" fontWeight={700}>
                          Course Content (<code># Chapter</code>,{" "}
                          <code>## Lesson</code>, <code>## [Quiz] Title</code>,{" "}
                          <code>## [Practice] Title</code>)
                        </Text>
                        <Button
                          size="xs"
                          variant="ghost"
                          colorScheme="blue"
                          onClick={() => {
                            if (!title) setTitle("Sample AI Course");
                            setMarkdownText(SAMPLE_AI_MD);
                          }}
                        >
                          Insert Example
                        </Button>
                      </HStack>
                      <Textarea
                        value={markdownText}
                        onChange={(e) => setMarkdownText(e.target.value)}
                        placeholder="Paste Markdown or plain text from ChatGPT, Gemini, or Claude..."
                        minH="240px"
                        fontFamily="mono"
                        fontSize="xs"
                        bg={codeBg}
                        rounded="xl"
                      />
                    </Box>

                    {mdPreview && (
                      <HStack spacing={2} flexWrap="wrap">
                        <Badge colorScheme="green" rounded="md" px={2} py={0.5}>
                          Detected: {mdPreview.chapterCount} chapters ·{" "}
                          {mdPreview.lessonCount} lessons
                        </Badge>
                        <Badge colorScheme="blue" variant="subtle" rounded="md">
                          {mdPreview.stats.theory} Theory
                        </Badge>
                        <Badge colorScheme="teal" variant="subtle" rounded="md">
                          {mdPreview.stats.practice} Practice
                        </Badge>
                        <Badge
                          colorScheme="orange"
                          variant="subtle"
                          rounded="md"
                        >
                          {mdPreview.stats.quiz} Quiz (
                          {mdPreview.stats.quizQuestions} Qs)
                        </Badge>
                      </HStack>
                    )}
                  </Stack>
                </TabPanel>

                {/* Tab 1: Upload HTML */}
                <TabPanel px={0}>
                  <Stack spacing={4}>
                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                      <FormControl>
                        <FormLabel fontSize="xs" fontWeight={700}>
                          Course Title (optional)
                        </FormLabel>
                        <Input
                          size="sm"
                          rounded="lg"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Auto-detected from HTML if empty"
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs" fontWeight={700}>
                          Track
                        </FormLabel>
                        <Select
                          size="sm"
                          rounded="lg"
                          value={track}
                          onChange={(e) =>
                            setTrack(e.target.value as CourseTrack)
                          }
                        >
                          {TRACKS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs" fontWeight={700}>
                          Level
                        </FormLabel>
                        <Select
                          size="sm"
                          rounded="lg"
                          value={level}
                          onChange={(e) => setLevel(e.target.value)}
                        >
                          {LEVELS.map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                    </SimpleGrid>

                    <FormControl>
                      <FormLabel fontSize="xs" fontWeight={700}>
                        Select <code>.html</code> file (XómData export or any
                        HTML page)
                      </FormLabel>
                      <Input
                        type="file"
                        accept=".html,.htm"
                        p={1}
                        size="sm"
                        rounded="lg"
                        onChange={(e) => handleFileUpload(e, "html")}
                      />
                    </FormControl>

                    <Textarea
                      value={htmlText}
                      onChange={(e) => setHtmlText(e.target.value)}
                      placeholder="Or paste raw HTML here..."
                      minH="180px"
                      fontFamily="mono"
                      fontSize="xs"
                      bg={codeBg}
                      rounded="xl"
                    />
                  </Stack>
                </TabPanel>

                {/* Tab 2: Import JSON */}
                <TabPanel px={0}>
                  <Stack spacing={4}>
                    <Text fontSize="xs" color={subText}>
                      Import a course JSON previously exported from PNO Data
                      Courses.
                    </Text>
                    <Input
                      type="file"
                      accept=".json"
                      p={1}
                      size="sm"
                      rounded="lg"
                      onChange={(e) => handleFileUpload(e, "json")}
                    />
                    <Textarea
                      value={jsonText}
                      onChange={(e) => setJsonText(e.target.value)}
                      placeholder='Paste CourseDetail JSON here: { "id": "...", "title": "...", "chapters": [...] }'
                      minH="200px"
                      fontFamily="mono"
                      fontSize="xs"
                      bg={codeBg}
                      rounded="xl"
                    />
                  </Stack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Stack>
        </ModalBody>

        <ModalFooter gap={2}>
          <Button variant="ghost" rounded="xl" onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            rounded="xl"
            leftIcon={<IconCheck size={16} />}
            onClick={handleImport}
          >
            Import Course
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
