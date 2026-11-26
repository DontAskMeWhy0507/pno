import React from "react";

import { outfit } from "@pno/lib/chakra-theme";

import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Icon,
  IconButton,
  Input,
  Radio,
  RadioGroup,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Tooltip,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";

import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowUp,
  IconBold,
  IconBook,
  IconCheck,
  IconChecklist,
  IconCode,
  IconDeviceFloppy,
  IconEye,
  IconHeading,
  IconPhoto,
  IconPlus,
  IconSparkles,
  IconTable,
  IconTrash,
} from "@tabler/icons-react";

import type {
  CourseChapter,
  CourseDetail,
  CourseLesson,
  CourseTrack,
  LessonType,
  QuizQuestion,
} from "../types";
import {
  extractHeadingsFromHtml,
  markdownToHtml,
  parseAiQuizText,
  parseTableText,
  slugifyCourseId,
  uploadCourseImage,
} from "../utils/importers";
import { normalizeCourseDetail } from "../utils/storage";
import { SanitizedHtml } from "./SanitizedHtml";

interface CourseEditorProps {
  initialCourse: CourseDetail;
  isNew: boolean;
  onCancel: () => void;
  onSave: (course: CourseDetail) => Promise<void> | void;
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

export const CourseEditor: React.FC<CourseEditorProps> = ({
  initialCourse,
  isNew,
  onCancel,
  onSave,
}) => {
  const toast = useToast();
  const [course, setCourse] = React.useState<CourseDetail>(() =>
    normalizeCourseDetail(initialCourse),
  );
  const [activeLessonId, setActiveLessonId] = React.useState<string>(() => {
    const first = initialCourse.chapters[0]?.lessons[0]?.id;
    return first ?? "";
  });

  const [viewMode, setViewMode] = React.useState<"write" | "split" | "preview">(
    "split",
  );
  const [useRawHtml, setUseRawHtml] = React.useState(false);
  const [isUploadingImg, setIsUploadingImg] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [aiQuizPaste, setAiQuizPaste] = React.useState("");
  const [showAiQuizBox, setShowAiQuizBox] = React.useState(false);
  const [sqlTablePaste, setSqlTablePaste] = React.useState("");
  const [sqlTableName, setSqlTableName] = React.useState("orders");

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const theoryTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  const cardBg = useColorModeValue("white", "gray.800");
  const cardBorder = useColorModeValue("gray.200", "gray.700");
  const subText = useColorModeValue("gray.600", "gray.400");
  const activeBg = useColorModeValue("blue.50", "rgba(75, 131, 255, 0.18)");
  const codeBg = useColorModeValue("gray.50", "gray.900");

  // Locate active chapter & lesson
  const activeLoc = React.useMemo(() => {
    for (let ci = 0; ci < course.chapters.length; ci++) {
      const ch = course.chapters[ci]!;
      for (let li = 0; li < ch.lessons.length; li++) {
        if (ch.lessons[li]!.id === activeLessonId) {
          return { ci, li, chapter: ch, lesson: ch.lessons[li]! };
        }
      }
    }
    return null;
  }, [course.chapters, activeLessonId]);

  React.useEffect(() => {
    if (!activeLoc?.lesson) return;
    if (activeLoc.lesson.type === "theory") {
      // Default to raw HTML mode only if existing HTML has no markdown source
      setUseRawHtml(
        !activeLoc.lesson.theory?.markdown &&
          Boolean(activeLoc.lesson.theory?.contentHtml),
      );
    }
  }, [activeLessonId, activeLoc?.lesson]);

  const updateActiveLesson = (
    updater: (lesson: CourseLesson) => CourseLesson,
  ) => {
    if (!activeLoc) return;
    setCourse((prev) => {
      const nextChapters = prev.chapters.map((ch, ci) => {
        if (ci !== activeLoc.ci) return ch;
        return {
          ...ch,
          lessons: ch.lessons.map((l, li) =>
            li === activeLoc.li ? updater(l) : l,
          ),
        };
      });
      return normalizeCourseDetail({ ...prev, chapters: nextChapters });
    });
  };

  const addChapter = () => {
    const num = course.chapters.length + 1;
    const newCh: CourseChapter = {
      id: `ch-${Date.now()}`,
      number: num,
      title: `Chapter ${num}`,
      lessons: [],
    };
    setCourse((prev) =>
      normalizeCourseDetail({ ...prev, chapters: [...prev.chapters, newCh] }),
    );
  };

  const renameChapter = (ci: number, title: string) => {
    setCourse((prev) => {
      const next = prev.chapters.map((ch, idx) =>
        idx === ci ? { ...ch, title } : ch,
      );
      return normalizeCourseDetail({ ...prev, chapters: next });
    });
  };

  const deleteChapter = (ci: number) => {
    setCourse((prev) => {
      const next = prev.chapters.filter((_, idx) => idx !== ci);
      return normalizeCourseDetail({ ...prev, chapters: next });
    });
  };

  const addLesson = (ci: number, type: LessonType) => {
    const id = `lesson-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const baseTitle =
      type === "quiz"
        ? "New Quiz"
        : type === "practice"
          ? "New Practice"
          : "New Theory Lesson";

    const newLesson: CourseLesson = {
      id,
      index: 1,
      globalIndex: 1,
      title: baseTitle,
      rawTitle: baseTitle,
      type,
      ...(type === "theory"
        ? {
            theory: {
              markdown: `## Overview\n\nWrite your lesson content here, or paste Markdown from AI.\n`,
              contentHtml: markdownToHtml(
                `## Overview\n\nWrite your lesson content here, or paste Markdown from AI.\n`,
              ),
              headings: [{ id: "overview", text: "Overview", level: 2 }],
            },
          }
        : type === "quiz"
          ? {
              questions: [
                {
                  id: "q-1",
                  number: 1,
                  prompt: "Sample question?",
                  options: [
                    { label: "A", text: "Option A" },
                    { label: "B", text: "Option B" },
                    { label: "C", text: "Option C" },
                    { label: "D", text: "Option D" },
                  ],
                  correctIndex: 0,
                  explanation: "",
                },
              ],
            }
          : {
              practice: {
                difficulty: course.level || "Beginner",
                title: baseTitle,
                summaryHtml: "<p>Describe the exercise goal here.</p>",
                sections: [
                  {
                    title: "Requirements",
                    html: "<ul><li>Step 1</li></ul>",
                  },
                ],
                starterCode:
                  course.track === "SQL"
                    ? "-- Write your SQL query here\nSELECT 1;"
                    : course.track === "JavaScript"
                      ? "console.log('Hello!');"
                      : "# Write your solution here\n",
                sqlTables: [],
                expectedTable: null,
                expectedText: "",
              },
            }),
    };

    setCourse((prev) => {
      const next = prev.chapters.map((ch, idx) =>
        idx === ci ? { ...ch, lessons: [...ch.lessons, newLesson] } : ch,
      );
      return normalizeCourseDetail({ ...prev, chapters: next });
    });
    setActiveLessonId(id);
  };

  const moveLesson = (ci: number, li: number, dir: -1 | 1) => {
    setCourse((prev) => {
      const ch = prev.chapters[ci];
      if (!ch) return prev;
      const target = li + dir;
      if (target < 0 || target >= ch.lessons.length) return prev;
      const copy = [...ch.lessons];
      const [item] = copy.splice(li, 1);
      copy.splice(target, 0, item!);
      const nextChapters = prev.chapters.map((c, idx) =>
        idx === ci ? { ...c, lessons: copy } : c,
      );
      return normalizeCourseDetail({ ...prev, chapters: nextChapters });
    });
  };

  const deleteLesson = (ci: number, li: number) => {
    setCourse((prev) => {
      const ch = prev.chapters[ci];
      if (!ch) return prev;
      const removed = ch.lessons[li];
      const nextLessons = ch.lessons.filter((_, idx) => idx !== li);
      const nextChapters = prev.chapters.map((c, idx) =>
        idx === ci ? { ...c, lessons: nextLessons } : c,
      );
      if (removed?.id === activeLessonId) {
        setActiveLessonId(nextLessons[0]?.id ?? "");
      }
      return normalizeCourseDetail({ ...prev, chapters: nextChapters });
    });
  };

  const insertAtCursor = (snippet: string) => {
    const ta = theoryTextareaRef.current;
    if (!activeLoc || activeLoc.lesson.type !== "theory") return;
    const currentText = useRawHtml
      ? activeLoc.lesson.theory?.contentHtml ?? ""
      : activeLoc.lesson.theory?.markdown ?? "";

    const start = ta ? ta.selectionStart : currentText.length;
    const end = ta ? ta.selectionEnd : currentText.length;
    const nextText =
      currentText.slice(0, start) + snippet + currentText.slice(end);

    updateActiveLesson((l) => {
      if (useRawHtml) {
        return {
          ...l,
          theory: {
            ...l.theory,
            contentHtml: nextText,
            headings: extractHeadingsFromHtml(nextText),
          },
        };
      }
      const html = markdownToHtml(nextText);
      return {
        ...l,
        theory: {
          markdown: nextText,
          contentHtml: html,
          headings: extractHeadingsFromHtml(html),
        },
      };
    });
  };

  const handleImageFile = async (file: File) => {
    setIsUploadingImg(true);
    try {
      const cdnUrl = await uploadCourseImage(file, course.id);
      const snippet = useRawHtml
        ? `\n<img src="${cdnUrl}" alt="${file.name}" />\n`
        : `\n![${file.name}](${cdnUrl})\n`;
      insertAtCursor(snippet);
      toast({
        title: "Image uploaded to CDN",
        description: "Inserted lightweight CDN URL.",
        status: "success",
        duration: 2500,
      });
    } catch (err) {
      toast({
        title: "Image upload failed",
        description:
          err instanceof Error ? err.message : "Make sure you are signed in.",
        status: "error",
        duration: 4000,
      });
    } finally {
      setIsUploadingImg(false);
    }
  };

  const handleTheoryPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imgItem = items.find((it) => it.type.startsWith("image/"));
    if (imgItem) {
      const file = imgItem.getAsFile();
      if (file) {
        e.preventDefault();
        void handleImageFile(file);
      }
    }
  };

  const handleSaveCourse = async () => {
    if (!course.title.trim()) {
      toast({ title: "Course title is required", status: "warning" });
      return;
    }
    setIsSaving(true);
    try {
      const finalId = isNew ? slugifyCourseId(course.title) : course.id;
      const prepared = normalizeCourseDetail({
        ...course,
        id: finalId,
        isCustom: isNew ? true : course.isCustom,
        isEdited: isNew ? false : true,
        updatedAt: Date.now(),
      });
      await onSave(prepared);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Container maxW="1400px" py={{ base: 3, md: 5 }}>
      <Stack spacing={5}>
        {/* Top Bar + Course Metadata */}
        <Box
          bg={cardBg}
          borderWidth="2px"
          borderColor={cardBorder}
          rounded="2xl"
          p={{ base: 4, md: 5 }}
          shadow="sm"
        >
          <Flex
            justify="space-between"
            align="center"
            mb={4}
            flexWrap="wrap"
            gap={3}
          >
            <HStack spacing={3}>
              <Button
                size="sm"
                variant="outline"
                rounded="xl"
                leftIcon={<IconArrowLeft size={16} />}
                onClick={onCancel}
              >
                Back
              </Button>
              <Heading size="md" fontFamily={outfit.style.fontFamily}>
                {isNew ? "Create New Course" : `Editing: ${course.title}`}
              </Heading>
            </HStack>

            <Button
              size="sm"
              colorScheme="blue"
              rounded="xl"
              isLoading={isSaving}
              loadingText="Saving..."
              leftIcon={<IconDeviceFloppy size={16} />}
              onClick={() => void handleSaveCourse()}
            >
              Save Course
            </Button>
          </Flex>

          <SimpleGrid columns={{ base: 1, md: 4 }} spacing={3}>
            <FormControl isRequired>
              <FormLabel fontSize="xs" fontWeight={700}>
                Course Title
              </FormLabel>
              <Input
                size="sm"
                rounded="lg"
                value={course.title}
                onChange={(e) =>
                  setCourse((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="xs" fontWeight={700}>
                Track
              </FormLabel>
              <Select
                size="sm"
                rounded="lg"
                value={course.track}
                onChange={(e) =>
                  setCourse((prev) => ({
                    ...prev,
                    track: e.target.value as CourseTrack,
                  }))
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
                value={course.level}
                onChange={(e) =>
                  setCourse((prev) => ({ ...prev, level: e.target.value }))
                }
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="xs" fontWeight={700}>
                Estimated Hours
              </FormLabel>
              <Input
                size="sm"
                type="number"
                min={1}
                rounded="lg"
                value={course.estimatedHours}
                onChange={(e) =>
                  setCourse((prev) => ({
                    ...prev,
                    estimatedHours: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
              />
            </FormControl>
          </SimpleGrid>

          <FormControl mt={3}>
            <FormLabel fontSize="xs" fontWeight={700}>
              Short Description
            </FormLabel>
            <Input
              size="sm"
              rounded="lg"
              value={course.description}
              onChange={(e) =>
                setCourse((prev) => ({ ...prev, description: e.target.value }))
              }
            />
          </FormControl>
        </Box>

        {/* Main 2-Column Editor */}
        <Flex
          gap={5}
          align="flex-start"
          direction={{ base: "column", lg: "row" }}
        >
          {/* Left: Chapters & Lessons Manager */}
          <Box
            w={{ base: "full", lg: "340px" }}
            flexShrink={0}
            bg={cardBg}
            borderWidth="2px"
            borderColor={cardBorder}
            rounded="2xl"
            p={4}
            maxH={{ lg: "calc(100vh - 40px)" }}
            overflowY={{ lg: "auto" }}
            position={{ lg: "sticky" }}
            top={{ lg: "20px" }}
          >
            <Flex justify="space-between" align="center" mb={3}>
              <Text
                fontFamily={outfit.style.fontFamily}
                fontWeight={800}
                fontSize="sm"
              >
                Chapters &amp; Lessons ({course.lessonCount})
              </Text>
              <Button
                size="xs"
                colorScheme="blue"
                variant="outline"
                rounded="lg"
                leftIcon={<IconPlus size={14} />}
                onClick={addChapter}
              >
                Chapter
              </Button>
            </Flex>

            <Stack spacing={4}>
              {course.chapters.map((ch, ci) => (
                <Box
                  key={ch.id}
                  borderWidth="1px"
                  borderColor={cardBorder}
                  rounded="xl"
                  p={2.5}
                >
                  <HStack spacing={1.5} mb={2}>
                    <Input
                      size="xs"
                      fontWeight={700}
                      rounded="md"
                      value={ch.title}
                      onChange={(e) => renameChapter(ci, e.target.value)}
                    />
                    <Tooltip label="Delete chapter" hasArrow>
                      <IconButton
                        aria-label="Delete chapter"
                        icon={<IconTrash size={13} />}
                        size="xs"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => deleteChapter(ci)}
                      />
                    </Tooltip>
                  </HStack>

                  <Stack spacing={1} mb={2}>
                    {ch.lessons.map((l, li) => {
                      const isActive = l.id === activeLessonId;
                      return (
                        <Flex
                          key={l.id}
                          align="center"
                          justify="space-between"
                          px={2}
                          py={1.5}
                          rounded="lg"
                          bg={isActive ? activeBg : "transparent"}
                          gap={1}
                        >
                          <Box
                            as="button"
                            type="button"
                            flex={1}
                            textAlign="left"
                            minW={0}
                            onClick={() => setActiveLessonId(l.id)}
                          >
                            <HStack spacing={1.5}>
                              <Badge
                                fontSize="9px"
                                colorScheme={
                                  l.type === "quiz"
                                    ? "orange"
                                    : l.type === "practice"
                                      ? "green"
                                      : "blue"
                                }
                              >
                                {l.type[0]!.toUpperCase()}
                              </Badge>
                              <Text
                                fontSize="xs"
                                fontWeight={isActive ? 700 : 500}
                                noOfLines={1}
                              >
                                {l.globalIndex}. {l.title}
                              </Text>
                            </HStack>
                          </Box>

                          <HStack spacing={0.5} flexShrink={0}>
                            <IconButton
                              aria-label="Move up"
                              icon={<IconArrowUp size={12} />}
                              size="xs"
                              variant="ghost"
                              isDisabled={li === 0}
                              onClick={() => moveLesson(ci, li, -1)}
                            />
                            <IconButton
                              aria-label="Move down"
                              icon={<IconArrowDown size={12} />}
                              size="xs"
                              variant="ghost"
                              isDisabled={li === ch.lessons.length - 1}
                              onClick={() => moveLesson(ci, li, 1)}
                            />
                            <IconButton
                              aria-label="Delete lesson"
                              icon={<IconTrash size={12} />}
                              size="xs"
                              variant="ghost"
                              colorScheme="red"
                              onClick={() => deleteLesson(ci, li)}
                            />
                          </HStack>
                        </Flex>
                      );
                    })}
                  </Stack>

                  <HStack spacing={1} flexWrap="wrap">
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="blue"
                      leftIcon={<IconBook size={12} />}
                      onClick={() => addLesson(ci, "theory")}
                    >
                      + Theory
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="green"
                      leftIcon={<IconCode size={12} />}
                      onClick={() => addLesson(ci, "practice")}
                    >
                      + Practice
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="orange"
                      leftIcon={<IconChecklist size={12} />}
                      onClick={() => addLesson(ci, "quiz")}
                    >
                      + Quiz
                    </Button>
                  </HStack>
                </Box>
              ))}
            </Stack>
          </Box>

          {/* Right: Active Lesson Editor */}
          <Box
            flex={1}
            minW={0}
            w="full"
            bg={cardBg}
            borderWidth="2px"
            borderColor={cardBorder}
            rounded="2xl"
            p={{ base: 4, md: 6 }}
          >
            {!activeLoc ? (
              <Text fontSize="sm" color={subText}>
                Select or add a lesson on the left to start editing.
              </Text>
            ) : (
              <Stack spacing={5}>
                <Flex
                  justify="space-between"
                  align="center"
                  flexWrap="wrap"
                  gap={3}
                >
                  <FormControl maxW="lg">
                    <FormLabel fontSize="xs" fontWeight={700}>
                      Lesson Title ({activeLoc.lesson.type.toUpperCase()})
                    </FormLabel>
                    <Input
                      size="sm"
                      rounded="lg"
                      fontWeight={700}
                      value={activeLoc.lesson.title}
                      onChange={(e) =>
                        updateActiveLesson((l) => ({
                          ...l,
                          title: e.target.value,
                          rawTitle: e.target.value,
                        }))
                      }
                    />
                  </FormControl>

                  {activeLoc.lesson.type === "theory" && (
                    <HStack spacing={1.5} flexWrap="wrap">
                      <Button
                        size="xs"
                        rounded="lg"
                        variant={!useRawHtml ? "solid" : "outline"}
                        colorScheme={!useRawHtml ? "blue" : "gray"}
                        onClick={() => setUseRawHtml(false)}
                      >
                        Markdown
                      </Button>
                      <Button
                        size="xs"
                        rounded="lg"
                        variant={useRawHtml ? "solid" : "outline"}
                        colorScheme={useRawHtml ? "blue" : "gray"}
                        onClick={() => setUseRawHtml(true)}
                      >
                        Raw HTML
                      </Button>
                      <Button
                        size="xs"
                        rounded="lg"
                        variant={viewMode === "write" ? "solid" : "outline"}
                        onClick={() => setViewMode("write")}
                      >
                        Write
                      </Button>
                      <Button
                        size="xs"
                        rounded="lg"
                        variant={viewMode === "split" ? "solid" : "outline"}
                        onClick={() => setViewMode("split")}
                      >
                        Split
                      </Button>
                      <Button
                        size="xs"
                        rounded="lg"
                        variant={viewMode === "preview" ? "solid" : "outline"}
                        leftIcon={<IconEye size={13} />}
                        onClick={() => setViewMode("preview")}
                      >
                        Preview
                      </Button>
                    </HStack>
                  )}
                </Flex>

                {/* THEORY EDITOR */}
                {activeLoc.lesson.type === "theory" && (
                  <Stack spacing={3}>
                    <HStack spacing={1.5} flexWrap="wrap">
                      <Button
                        size="xs"
                        variant="outline"
                        rounded="lg"
                        leftIcon={<IconHeading size={13} />}
                        onClick={() => insertAtCursor("\n## Section Title\n")}
                      >
                        Heading
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        rounded="lg"
                        leftIcon={<IconBold size={13} />}
                        onClick={() => insertAtCursor("**bold text**")}
                      >
                        Bold
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        rounded="lg"
                        leftIcon={<IconCode size={13} />}
                        onClick={() =>
                          insertAtCursor("\n```python\nprint('Hello')\n```\n")
                        }
                      >
                        Code
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        rounded="lg"
                        leftIcon={<IconTable size={13} />}
                        onClick={() =>
                          insertAtCursor(
                            "\n| Column A | Column B |\n|---|---|\n| Val 1 | Val 2 |\n",
                          )
                        }
                      >
                        Table
                      </Button>
                      <Button
                        size="xs"
                        colorScheme="teal"
                        variant="outline"
                        rounded="lg"
                        isLoading={isUploadingImg}
                        loadingText="Uploading..."
                        leftIcon={<IconPhoto size={13} />}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Upload Image (CDN)
                      </Button>
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        display="none"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleImageFile(f);
                          e.target.value = "";
                        }}
                      />
                      <Text fontSize="xs" color={subText}>
                        Tip: Paste images directly (Ctrl+V) to upload to CDN!
                      </Text>
                    </HStack>

                    <SimpleGrid
                      columns={viewMode === "split" ? { base: 1, xl: 2 } : 1}
                      spacing={4}
                    >
                      {viewMode !== "preview" && (
                        <Textarea
                          ref={theoryTextareaRef}
                          value={
                            useRawHtml
                              ? activeLoc.lesson.theory?.contentHtml ?? ""
                              : activeLoc.lesson.theory?.markdown ?? ""
                          }
                          onPaste={handleTheoryPaste}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateActiveLesson((l) => {
                              if (useRawHtml) {
                                return {
                                  ...l,
                                  theory: {
                                    ...l.theory,
                                    contentHtml: val,
                                    headings: extractHeadingsFromHtml(val),
                                  },
                                };
                              }
                              const html = markdownToHtml(val);
                              return {
                                ...l,
                                theory: {
                                  markdown: val,
                                  contentHtml: html,
                                  headings: extractHeadingsFromHtml(html),
                                },
                              };
                            });
                          }}
                          minH="380px"
                          fontFamily="mono"
                          fontSize="13px"
                          bg={codeBg}
                          rounded="xl"
                          placeholder={
                            useRawHtml
                              ? "Edit HTML content..."
                              : "Write Markdown or paste text from AI here..."
                          }
                        />
                      )}

                      {viewMode !== "write" && (
                        <Box
                          borderWidth="1px"
                          borderColor={cardBorder}
                          rounded="xl"
                          p={4}
                          minH="380px"
                          maxH="560px"
                          overflowY="auto"
                        >
                          <SanitizedHtml
                            html={activeLoc.lesson.theory?.contentHtml ?? ""}
                          />
                        </Box>
                      )}
                    </SimpleGrid>
                  </Stack>
                )}

                {/* QUIZ EDITOR */}
                {activeLoc.lesson.type === "quiz" && (
                  <Stack spacing={4}>
                    <HStack justify="space-between" flexWrap="wrap" gap={2}>
                      <Button
                        size="xs"
                        colorScheme="teal"
                        variant="outline"
                        rounded="lg"
                        leftIcon={<IconSparkles size={14} />}
                        onClick={() => setShowAiQuizBox((v) => !v)}
                      >
                        Quick Paste Quiz from AI
                      </Button>
                      <Button
                        size="xs"
                        colorScheme="blue"
                        rounded="lg"
                        leftIcon={<IconPlus size={14} />}
                        onClick={() => {
                          updateActiveLesson((l) => {
                            const qs = l.questions ?? [];
                            const nextQ: QuizQuestion = {
                              id: `q-${Date.now()}`,
                              number: qs.length + 1,
                              prompt: "New question?",
                              options: [
                                { label: "A", text: "Option A" },
                                { label: "B", text: "Option B" },
                                { label: "C", text: "Option C" },
                                { label: "D", text: "Option D" },
                              ],
                              correctIndex: 0,
                              explanation: "",
                            };
                            return { ...l, questions: [...qs, nextQ] };
                          });
                        }}
                      >
                        Add Question
                      </Button>
                    </HStack>

                    {showAiQuizBox && (
                      <Box
                        borderWidth="1.5px"
                        borderColor="teal.400"
                        rounded="xl"
                        p={3.5}
                        bg={codeBg}
                      >
                        <Text fontSize="xs" fontWeight={700} mb={2}>
                          Paste AI Quiz Text (mark correct option with{" "}
                          <code>*B)</code> or add <code>Answer: B</code> +{" "}
                          <code>Explanation: ...</code>)
                        </Text>
                        <Textarea
                          size="sm"
                          minH="120px"
                          fontFamily="mono"
                          fontSize="xs"
                          value={aiQuizPaste}
                          onChange={(e) => setAiQuizPaste(e.target.value)}
                          placeholder={
                            "1. What does LEN() do in Excel?\nA) Rounds numbers\n*B) Counts characters in a string\nExplanation: LEN() returns string length."
                          }
                        />
                        <Flex justify="flex-end" mt={2} gap={2}>
                          <Button
                            size="xs"
                            colorScheme="teal"
                            rounded="lg"
                            onClick={() => {
                              const parsed = parseAiQuizText(aiQuizPaste);
                              if (!parsed.length) {
                                toast({
                                  title: "No questions detected",
                                  status: "warning",
                                });
                                return;
                              }
                              updateActiveLesson((l) => {
                                const merged = [
                                  ...(l.questions ?? []),
                                  ...parsed,
                                ].map((q, idx) => ({
                                  ...q,
                                  number: idx + 1,
                                  id: `q-${idx + 1}`,
                                }));
                                return { ...l, questions: merged };
                              });
                              setAiQuizPaste("");
                              setShowAiQuizBox(false);
                              toast({
                                title: `Added ${parsed.length} questions`,
                                status: "success",
                              });
                            }}
                          >
                            Parse &amp; Append
                          </Button>
                        </Flex>
                      </Box>
                    )}

                    {(activeLoc.lesson.questions ?? []).map((q, qi) => (
                      <Box
                        key={q.id}
                        borderWidth="1.5px"
                        borderColor={cardBorder}
                        rounded="xl"
                        p={4}
                      >
                        <Flex justify="space-between" align="center" mb={2}>
                          <Text fontSize="xs" fontWeight={800}>
                            Question {qi + 1}
                          </Text>
                          <IconButton
                            aria-label="Delete question"
                            icon={<IconTrash size={14} />}
                            size="xs"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() =>
                              updateActiveLesson((l) => ({
                                ...l,
                                questions: (l.questions ?? [])
                                  .filter((_, idx) => idx !== qi)
                                  .map((item, idx) => ({
                                    ...item,
                                    number: idx + 1,
                                  })),
                              }))
                            }
                          />
                        </Flex>

                        <Stack spacing={2.5}>
                          <Textarea
                            size="sm"
                            rounded="lg"
                            value={q.prompt}
                            onChange={(e) =>
                              updateActiveLesson((l) => ({
                                ...l,
                                questions: (l.questions ?? []).map(
                                  (item, idx) =>
                                    idx === qi
                                      ? { ...item, prompt: e.target.value }
                                      : item,
                                ),
                              }))
                            }
                          />

                          <RadioGroup
                            value={String(q.correctIndex)}
                            onChange={(val) =>
                              updateActiveLesson((l) => ({
                                ...l,
                                questions: (l.questions ?? []).map(
                                  (item, idx) =>
                                    idx === qi
                                      ? { ...item, correctIndex: Number(val) }
                                      : item,
                                ),
                              }))
                            }
                          >
                            <Stack spacing={1.5}>
                              {q.options.map((opt, oi) => (
                                <HStack key={opt.label} spacing={2}>
                                  <Radio value={String(oi)} colorScheme="green">
                                    <Text fontSize="xs" fontWeight={700}>
                                      {opt.label}
                                    </Text>
                                  </Radio>
                                  <Input
                                    size="xs"
                                    rounded="md"
                                    value={opt.text}
                                    onChange={(e) =>
                                      updateActiveLesson((l) => ({
                                        ...l,
                                        questions: (l.questions ?? []).map(
                                          (item, idx) =>
                                            idx === qi
                                              ? {
                                                  ...item,
                                                  options: item.options.map(
                                                    (o, oIdx) =>
                                                      oIdx === oi
                                                        ? {
                                                            ...o,
                                                            text: e.target
                                                              .value,
                                                          }
                                                        : o,
                                                  ),
                                                }
                                              : item,
                                        ),
                                      }))
                                    }
                                  />
                                </HStack>
                              ))}
                            </Stack>
                          </RadioGroup>

                          <Input
                            size="xs"
                            rounded="md"
                            placeholder="Explanation (optional)"
                            value={q.explanation}
                            onChange={(e) =>
                              updateActiveLesson((l) => ({
                                ...l,
                                questions: (l.questions ?? []).map(
                                  (item, idx) =>
                                    idx === qi
                                      ? { ...item, explanation: e.target.value }
                                      : item,
                                ),
                              }))
                            }
                          />
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}

                {/* PRACTICE EDITOR */}
                {activeLoc.lesson.type === "practice" &&
                  activeLoc.lesson.practice && (
                    <Stack spacing={4}>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                        <FormControl>
                          <FormLabel fontSize="xs" fontWeight={700}>
                            Difficulty
                          </FormLabel>
                          <Input
                            size="sm"
                            rounded="lg"
                            value={activeLoc.lesson.practice.difficulty}
                            onChange={(e) =>
                              updateActiveLesson((l) => ({
                                ...l,
                                practice: {
                                  ...l.practice!,
                                  difficulty: e.target.value,
                                },
                              }))
                            }
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel fontSize="xs" fontWeight={700}>
                            Prompt Title
                          </FormLabel>
                          <Input
                            size="sm"
                            rounded="lg"
                            value={activeLoc.lesson.practice.title}
                            onChange={(e) =>
                              updateActiveLesson((l) => ({
                                ...l,
                                practice: {
                                  ...l.practice!,
                                  title: e.target.value,
                                },
                              }))
                            }
                          />
                        </FormControl>
                      </SimpleGrid>

                      <FormControl>
                        <FormLabel fontSize="xs" fontWeight={700}>
                          Problem Summary (HTML or Markdown)
                        </FormLabel>
                        <Textarea
                          size="sm"
                          minH="100px"
                          fontFamily="mono"
                          fontSize="xs"
                          bg={codeBg}
                          rounded="xl"
                          value={activeLoc.lesson.practice.summaryHtml}
                          onChange={(e) =>
                            updateActiveLesson((l) => ({
                              ...l,
                              practice: {
                                ...l.practice!,
                                summaryHtml: e.target.value,
                              },
                            }))
                          }
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel fontSize="xs" fontWeight={700}>
                          Starter Code
                        </FormLabel>
                        <Textarea
                          size="sm"
                          minH="110px"
                          fontFamily="mono"
                          fontSize="xs"
                          bg={codeBg}
                          rounded="xl"
                          value={activeLoc.lesson.practice.starterCode}
                          onChange={(e) =>
                            updateActiveLesson((l) => ({
                              ...l,
                              practice: {
                                ...l.practice!,
                                starterCode: e.target.value,
                              },
                            }))
                          }
                        />
                      </FormControl>

                      {course.track === "SQL" && (
                        <Box
                          borderWidth="1px"
                          borderColor={cardBorder}
                          rounded="xl"
                          p={3.5}
                        >
                          <Text fontSize="xs" fontWeight={800} mb={2}>
                            SQL Sandbox Tables (
                            {activeLoc.lesson.practice.sqlTables.length} sample
                            tables)
                          </Text>
                          <HStack mb={2} spacing={2}>
                            <Input
                              size="xs"
                              maxW="180px"
                              rounded="md"
                              placeholder="Table name (e.g. orders)"
                              value={sqlTableName}
                              onChange={(e) => setSqlTableName(e.target.value)}
                            />
                            <Button
                              size="xs"
                              colorScheme="blue"
                              variant="outline"
                              rounded="md"
                              leftIcon={<IconCheck size={13} />}
                              onClick={() => {
                                const parsed = parseTableText(sqlTablePaste);
                                if (!parsed) {
                                  toast({
                                    title: "Could not parse table",
                                    description:
                                      "Paste Markdown | col |, CSV, or TSV lines.",
                                    status: "warning",
                                  });
                                  return;
                                }
                                updateActiveLesson((l) => ({
                                  ...l,
                                  practice: {
                                    ...l.practice!,
                                    sqlTables: [
                                      ...l.practice!.sqlTables,
                                      {
                                        name:
                                          sqlTableName.trim() || "sample_table",
                                        columns: parsed.columns,
                                        rows: parsed.rows,
                                      },
                                    ],
                                  },
                                }));
                                setSqlTablePaste("");
                                toast({
                                  title: "Sample table added",
                                  status: "success",
                                });
                              }}
                            >
                              Add Sample Table
                            </Button>
                            <Button
                              size="xs"
                              colorScheme="green"
                              variant="outline"
                              rounded="md"
                              onClick={() => {
                                const parsed = parseTableText(sqlTablePaste);
                                if (!parsed) {
                                  toast({
                                    title: "Could not parse expected table",
                                    status: "warning",
                                  });
                                  return;
                                }
                                updateActiveLesson((l) => ({
                                  ...l,
                                  practice: {
                                    ...l.practice!,
                                    expectedTable: parsed,
                                  },
                                }));
                                setSqlTablePaste("");
                                toast({
                                  title: "Expected output table updated",
                                  status: "success",
                                });
                              }}
                            >
                              Set Expected Output
                            </Button>
                          </HStack>
                          <Textarea
                            size="xs"
                            minH="90px"
                            fontFamily="mono"
                            bg={codeBg}
                            rounded="lg"
                            value={sqlTablePaste}
                            onChange={(e) => setSqlTablePaste(e.target.value)}
                            placeholder={
                              "Paste Markdown or CSV table:\nid,name,amount\n1,Alice,100\n2,Bob,250"
                            }
                          />
                          {activeLoc.lesson.practice.sqlTables.length > 0 && (
                            <HStack spacing={2} mt={2} flexWrap="wrap">
                              {activeLoc.lesson.practice.sqlTables.map(
                                (t, idx) => (
                                  <Badge
                                    key={`${t.name}-${idx}`}
                                    colorScheme="blue"
                                    px={2}
                                    py={0.5}
                                    rounded="md"
                                  >
                                    <HStack spacing={1.5}>
                                      <span>
                                        {t.name} ({t.rows.length} rows)
                                      </span>
                                      <Icon
                                        as={IconTrash}
                                        boxSize={3}
                                        cursor="pointer"
                                        onClick={() =>
                                          updateActiveLesson((l) => ({
                                            ...l,
                                            practice: {
                                              ...l.practice!,
                                              sqlTables:
                                                l.practice!.sqlTables.filter(
                                                  (_, ti) => ti !== idx,
                                                ),
                                            },
                                          }))
                                        }
                                      />
                                    </HStack>
                                  </Badge>
                                ),
                              )}
                            </HStack>
                          )}
                        </Box>
                      )}
                    </Stack>
                  )}
              </Stack>
            )}
          </Box>
        </Flex>
      </Stack>
    </Container>
  );
};
