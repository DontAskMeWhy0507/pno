import React from "react";

import { outfit } from "@pno/lib/chakra-theme";

import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Stack,
  Text,
  Tooltip,
  useColorModeValue,
} from "@chakra-ui/react";

import {
  IconDownload,
  IconEdit,
  IconExternalLink,
  IconPlus,
  IconRotateClockwise,
  IconSearch,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";

import type { CourseSummary } from "../types";

interface CourseManageTabProps {
  courses: CourseSummary[];
  builtinIds: Set<string>;
  hasDeletedBuiltins: boolean;
  onCreateNew: () => void;
  onOpenSmartImport: () => void;
  onEditCourse: (courseId: string) => void;
  onOpenCourse: (courseId: string) => void;
  onExportCourse: (courseId: string) => void;
  onDeleteCourse: (courseId: string, title: string, isBuiltin: boolean) => void;
  onRestoreDefaults: () => void;
}

export const CourseManageTab: React.FC<CourseManageTabProps> = ({
  courses,
  builtinIds,
  hasDeletedBuiltins,
  onCreateNew,
  onOpenSmartImport,
  onEditCourse,
  onOpenCourse,
  onExportCourse,
  onDeleteCourse,
  onRestoreDefaults,
}) => {
  const [filterText, setFilterText] = React.useState("");

  const cardBg = useColorModeValue("white", "gray.800");
  const cardBorder = useColorModeValue("gray.200", "gray.700");
  const rowHover = useColorModeValue("gray.50", "gray.750");
  const subText = useColorModeValue("gray.600", "gray.400");

  const filtered = React.useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.track.toLowerCase().includes(q) ||
        c.level.toLowerCase().includes(q),
    );
  }, [courses, filterText]);

  return (
    <Stack spacing={5}>
      {/* Action Bar */}
      <Box
        bg={cardBg}
        borderWidth="2px"
        borderColor={cardBorder}
        rounded="2xl"
        p={{ base: 4, md: 5 }}
      >
        <Flex
          justify="space-between"
          align={{ base: "stretch", md: "center" }}
          direction={{ base: "column", md: "row" }}
          gap={4}
        >
          <Stack spacing={1}>
            <Heading size="md" fontFamily={outfit.style.fontFamily}>
              Manage Courses ({courses.length})
            </Heading>
            <Text fontSize="xs" color={subText}>
              Create courses from Markdown/AI text, paste images directly to
              CDN, or edit any existing course.
            </Text>
          </Stack>

          <HStack spacing={2.5} flexWrap="wrap">
            <Button
              size="sm"
              colorScheme="blue"
              rounded="xl"
              leftIcon={<IconPlus size={16} />}
              onClick={onCreateNew}
            >
              New Course
            </Button>
            <Button
              size="sm"
              colorScheme="teal"
              variant="outline"
              rounded="xl"
              leftIcon={<IconSparkles size={16} />}
              onClick={onOpenSmartImport}
            >
              Smart Import (AI / HTML / JSON)
            </Button>
            {hasDeletedBuiltins && (
              <Button
                size="sm"
                variant="outline"
                colorScheme="orange"
                rounded="xl"
                leftIcon={<IconRotateClockwise size={16} />}
                onClick={onRestoreDefaults}
              >
                Restore Defaults
              </Button>
            )}
          </HStack>
        </Flex>
      </Box>

      {/* Search + Courses List */}
      <Box
        bg={cardBg}
        borderWidth="2px"
        borderColor={cardBorder}
        rounded="2xl"
        overflow="hidden"
      >
        <Box p={4} borderBottomWidth="1px" borderColor={cardBorder}>
          <InputGroup size="sm" maxW="340px">
            <InputLeftElement pointerEvents="none" color="gray.400">
              <IconSearch size={15} />
            </InputLeftElement>
            <Input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter courses by title, track, or level..."
              rounded="xl"
              borderWidth="2px"
              borderColor={cardBorder}
            />
          </InputGroup>
        </Box>

        <Stack
          spacing={0}
          divider={<Box borderBottomWidth="1px" borderColor={cardBorder} />}
        >
          {filtered.length === 0 ? (
            <Box p={8} textAlign="center">
              <Text fontSize="sm" color={subText}>
                No courses match your filter.
              </Text>
            </Box>
          ) : (
            filtered.map((course) => {
              const isBuiltin = builtinIds.has(course.id);
              const statusLabel = course.isEdited
                ? "Edited"
                : isBuiltin
                  ? "Built-in"
                  : "Custom";
              const statusColor = course.isEdited
                ? "purple"
                : isBuiltin
                  ? "gray"
                  : "green";

              return (
                <Flex
                  key={course.id}
                  px={{ base: 4, md: 5 }}
                  py={3.5}
                  justify="space-between"
                  align={{ base: "flex-start", sm: "center" }}
                  direction={{ base: "column", sm: "row" }}
                  gap={3}
                  _hover={{ bg: rowHover }}
                  transition="background-color 0.12s ease"
                >
                  <Stack spacing={1} minW={0} flex={1}>
                    <HStack spacing={2} flexWrap="wrap">
                      <Text
                        fontFamily={outfit.style.fontFamily}
                        fontWeight={700}
                        fontSize="md"
                      >
                        {course.title}
                      </Text>
                      <Badge
                        colorScheme="blue"
                        variant="subtle"
                        rounded="md"
                        fontSize="xs"
                      >
                        {course.track}
                      </Badge>
                      <Badge
                        colorScheme="teal"
                        variant="outline"
                        rounded="md"
                        fontSize="xs"
                      >
                        {course.level}
                      </Badge>
                      <Badge
                        colorScheme={statusColor}
                        rounded="md"
                        fontSize="xs"
                      >
                        {statusLabel}
                      </Badge>
                    </HStack>
                    <Text fontSize="xs" color={subText} noOfLines={1}>
                      {course.chapterCount} chapters · {course.lessonCount}{" "}
                      lessons · {course.stats.theory} theory ·{" "}
                      {course.stats.practice} practice · {course.stats.quiz}{" "}
                      quiz
                    </Text>
                  </Stack>

                  <HStack spacing={1.5} flexShrink={0}>
                    <Button
                      size="xs"
                      colorScheme="blue"
                      variant="outline"
                      rounded="lg"
                      leftIcon={<IconEdit size={14} />}
                      onClick={() => onEditCourse(course.id)}
                    >
                      Edit
                    </Button>
                    <Tooltip label="Open course" hasArrow>
                      <IconButton
                        aria-label="Open course"
                        icon={<IconExternalLink size={15} />}
                        size="xs"
                        variant="ghost"
                        rounded="lg"
                        onClick={() => onOpenCourse(course.id)}
                      />
                    </Tooltip>
                    <Tooltip label="Export JSON" hasArrow>
                      <IconButton
                        aria-label="Export JSON"
                        icon={<IconDownload size={15} />}
                        size="xs"
                        variant="ghost"
                        rounded="lg"
                        onClick={() => onExportCourse(course.id)}
                      />
                    </Tooltip>
                    <Tooltip
                      label={
                        isBuiltin
                          ? "Hide built-in course"
                          : "Delete custom course"
                      }
                      hasArrow
                    >
                      <IconButton
                        aria-label="Delete course"
                        icon={<IconTrash size={15} />}
                        size="xs"
                        variant="ghost"
                        colorScheme="red"
                        rounded="lg"
                        onClick={() =>
                          onDeleteCourse(course.id, course.title, isBuiltin)
                        }
                      />
                    </Tooltip>
                  </HStack>
                </Flex>
              );
            })
          )}
        </Stack>
      </Box>
    </Stack>
  );
};
