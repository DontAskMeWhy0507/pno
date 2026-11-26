import React from "react";

import { outfit } from "@pno/lib/chakra-theme";

import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Flex,
  HStack,
  Icon,
  SimpleGrid,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from "@chakra-ui/react";

import {
  IconCheck,
  IconCode,
  IconDatabase,
  IconPlayerPlay,
  IconRefresh,
  IconTerminal2,
} from "@tabler/icons-react";

import type { CourseTrack, PracticeData } from "../types";
import {
  type ScriptRunResult,
  type SqlRunResult,
  compareTableResults,
  runJsInBrowser,
  runPythonInBrowser,
  runSqlInBrowser,
} from "../utils/runners";
import { SanitizedHtml } from "./SanitizedHtml";

interface PracticeWorkbenchProps {
  track: CourseTrack;
  practice: PracticeData;
  draftCode?: string;
  isCompleted: boolean;
  onSaveDraft: (code: string) => void;
  onToggleComplete: () => void;
}

export const PracticeWorkbench: React.FC<PracticeWorkbenchProps> = ({
  track,
  practice,
  draftCode,
  isCompleted,
  onSaveDraft,
  onToggleComplete,
}) => {
  const initialCode =
    draftCode !== undefined ? draftCode : practice.starterCode;
  const [code, setCode] = React.useState(initialCode);
  const [isRunning, setIsRunning] = React.useState(false);
  const [sqlResult, setSqlResult] = React.useState<SqlRunResult | null>(null);
  const [scriptResult, setScriptResult] =
    React.useState<ScriptRunResult | null>(null);
  const [showExpected, setShowExpected] = React.useState(true);
  const [checkedSteps, setCheckedSteps] = React.useState<
    Record<number, boolean>
  >({});

  React.useEffect(() => {
    setCode(draftCode !== undefined ? draftCode : practice.starterCode);
    setSqlResult(null);
    setScriptResult(null);
    setCheckedSteps({});
  }, [practice, draftCode]);

  const cardBg = useColorModeValue("white", "gray.800");
  const cardBorder = useColorModeValue("gray.200", "gray.700");
  const subText = useColorModeValue("gray.600", "gray.400");
  const editorBg = useColorModeValue("gray.50", "gray.900");
  const headerBg = useColorModeValue("gray.100", "gray.750");

  const isSqlRunnable = track === "SQL" && practice.sqlTables.length > 0;
  const isJsRunnable = track === "JavaScript";
  const isPythonRunnable = track === "Python";
  const isInteractiveRunner = isSqlRunnable || isJsRunnable || isPythonRunnable;

  const handleCodeChange = (val: string) => {
    setCode(val);
    onSaveDraft(val);
  };

  const handleRun = async () => {
    setIsRunning(true);
    try {
      if (isSqlRunnable) {
        const res = await runSqlInBrowser(practice.sqlTables, code);
        setSqlResult(res);
        if (
          !res.error &&
          practice.expectedTable &&
          compareTableResults(res, practice.expectedTable).matched &&
          !isCompleted
        ) {
          onToggleComplete();
        }
      } else if (isJsRunnable) {
        const res = await runJsInBrowser(code);
        setScriptResult(res);
      } else if (isPythonRunnable) {
        const res = await runPythonInBrowser(code);
        setScriptResult(res);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && isInteractiveRunner) {
      e.preventDefault();
      void handleRun();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = code.slice(0, start) + "  " + code.slice(end);
      handleCodeChange(next);
      window.requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  };

  const sqlMatch = React.useMemo(() => {
    if (!sqlResult || sqlResult.error || !practice.expectedTable) return null;
    return compareTableResults(sqlResult, practice.expectedTable);
  }, [sqlResult, practice.expectedTable]);

  // Extract checklist items from Requirements/Steps sections for self-check
  const requirementItems = React.useMemo(() => {
    const items: string[] = [];
    for (const sec of practice.sections) {
      if (/requirement|step|checks/i.test(sec.title)) {
        const doc = new DOMParser().parseFromString(sec.html, "text/html");
        doc.querySelectorAll("li").forEach((li) => {
          const t = li.textContent?.trim();
          if (t) items.push(t);
        });
      }
    }
    return items.slice(0, 8);
  }, [practice.sections]);

  return (
    <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={6} alignItems="start">
      {/* Left Pane: Problem Description, Schema, Sample Data, Expected Output */}
      <Stack spacing={4}>
        <Box
          bg={cardBg}
          borderWidth="2px"
          borderColor={cardBorder}
          rounded="2xl"
          p={{ base: 4, md: 6 }}
        >
          <HStack spacing={2} mb={2} flexWrap="wrap">
            <Badge colorScheme="green" rounded="md" px={2} py={0.5}>
              {practice.difficulty || "Practice"}
            </Badge>
            <Badge
              colorScheme="blue"
              variant="subtle"
              rounded="md"
              px={2}
              py={0.5}
            >
              {track}
            </Badge>
          </HStack>

          {practice.title && (
            <Text
              fontFamily={outfit.style.fontFamily}
              fontWeight={700}
              fontSize="xl"
              mb={3}
            >
              {practice.title}
            </Text>
          )}

          {practice.summaryHtml && (
            <SanitizedHtml
              html={practice.summaryHtml}
              enableCopyButtons={false}
            />
          )}

          <Stack spacing={4} mt={4}>
            {practice.sections.map((sec, idx) => {
              const isExpectedSec = /expected/i.test(sec.title);
              if (isExpectedSec && !showExpected) {
                return (
                  <Box
                    key={`${sec.title}-${idx}`}
                    borderWidth="1px"
                    borderColor={cardBorder}
                    rounded="xl"
                    p={3}
                  >
                    <Flex justify="space-between" align="center">
                      <Text fontWeight={700} fontSize="sm">
                        {sec.title}
                      </Text>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => setShowExpected(true)}
                      >
                        Show expected output
                      </Button>
                    </Flex>
                  </Box>
                );
              }
              return (
                <Box
                  key={`${sec.title}-${idx}`}
                  borderTopWidth="1px"
                  borderColor={cardBorder}
                  pt={4}
                >
                  <Flex justify="space-between" align="center" mb={2}>
                    <Text
                      fontFamily={outfit.style.fontFamily}
                      fontWeight={700}
                      fontSize="md"
                    >
                      {sec.title}
                    </Text>
                    {isExpectedSec && (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setShowExpected(false)}
                      >
                        Hide
                      </Button>
                    )}
                  </Flex>
                  <SanitizedHtml html={sec.html} />
                </Box>
              );
            })}
          </Stack>
        </Box>
      </Stack>

      {/* Right Pane: Interactive Lab / Code Runner / Scratchpad */}
      <Stack spacing={4} position={{ xl: "sticky" }} top={{ xl: "20px" }}>
        <Box
          bg={cardBg}
          borderWidth="2px"
          borderColor={cardBorder}
          rounded="2xl"
          overflow="hidden"
          shadow="md"
        >
          <Flex
            px={4}
            py={3}
            bg={headerBg}
            borderBottomWidth="1px"
            borderColor={cardBorder}
            justify="space-between"
            align="center"
            flexWrap="wrap"
            gap={2}
          >
            <HStack spacing={2}>
              <Icon
                as={
                  isSqlRunnable
                    ? IconDatabase
                    : isInteractiveRunner
                      ? IconCode
                      : IconTerminal2
                }
                boxSize={4}
                color="blue.500"
              />
              <Text
                fontFamily={outfit.style.fontFamily}
                fontWeight={700}
                fontSize="sm"
              >
                {isSqlRunnable
                  ? "SQL Sandbox (In-browser SQLite)"
                  : isJsRunnable
                    ? "JavaScript Runner"
                    : isPythonRunnable
                      ? "Python Sandbox (Pyodide)"
                      : `${track} Practice Scratchpad`}
              </Text>
            </HStack>

            <HStack spacing={2}>
              <Button
                size="xs"
                variant="ghost"
                rounded="lg"
                onClick={() => {
                  handleCodeChange(practice.starterCode);
                  setSqlResult(null);
                  setScriptResult(null);
                }}
                leftIcon={<IconRefresh size={14} />}
              >
                Reset
              </Button>
              {isInteractiveRunner && (
                <Button
                  size="sm"
                  colorScheme="blue"
                  rounded="xl"
                  isLoading={isRunning}
                  loadingText={
                    isPythonRunnable ? "Loading Python..." : "Running..."
                  }
                  onClick={() => void handleRun()}
                  leftIcon={<IconPlayerPlay size={15} />}
                >
                  Run (Ctrl+Enter)
                </Button>
              )}
            </HStack>
          </Flex>

          {/* SQL Table Quick Chips */}
          {isSqlRunnable && (
            <Box
              px={4}
              py={2.5}
              borderBottomWidth="1px"
              borderColor={cardBorder}
            >
              <HStack spacing={2} flexWrap="wrap">
                <Text fontSize="xs" fontWeight={700} color={subText}>
                  Available tables:
                </Text>
                {practice.sqlTables.map((t) => (
                  <Button
                    key={t.name}
                    size="xs"
                    variant="outline"
                    colorScheme="blue"
                    rounded="md"
                    fontFamily="mono"
                    onClick={() =>
                      handleCodeChange(`SELECT *\nFROM ${t.name}\nLIMIT 10;`)
                    }
                  >
                    {t.name} ({t.rows.length} rows)
                  </Button>
                ))}
              </HStack>
            </Box>
          )}

          <Box p={4}>
            <Textarea
              aria-label="Practice code editor"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              onKeyDown={handleKeyDown}
              fontFamily='ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace'
              fontSize="13.5px"
              lineHeight="1.6"
              minH="220px"
              bg={editorBg}
              borderWidth="1.5px"
              borderColor={cardBorder}
              rounded="xl"
              p={3.5}
              spellCheck={false}
              placeholder={
                isSqlRunnable
                  ? "Write your SQL query (e.g. SELECT * FROM ...)"
                  : `Write your ${track} solution or notes here...`
              }
            />
            {isPythonRunnable && (
              <Text fontSize="xs" color={subText} mt={2}>
                Tip: Press <strong>Run (Ctrl+Enter)</strong> to execute Python
                directly via WebAssembly (Pyodide; requires internet on first
                load).
              </Text>
            )}
            {!isInteractiveRunner && (
              <Text fontSize="xs" color={subText} mt={2}>
                Your draft is automatically saved locally in this browser.
              </Text>
            )}
          </Box>

          {/* SQL Result Output */}
          {sqlResult && (
            <Box px={4} pb={4}>
              <Divider mb={3} />
              {sqlResult.error ? (
                <Alert status="error" rounded="xl" fontSize="sm">
                  <AlertIcon />
                  <Text fontFamily="mono" fontSize="xs">
                    {sqlResult.error}
                  </Text>
                </Alert>
              ) : (
                <Stack spacing={3}>
                  <Flex
                    justify="space-between"
                    align="center"
                    flexWrap="wrap"
                    gap={2}
                  >
                    <HStack spacing={2}>
                      <Badge colorScheme="gray" rounded="md">
                        {sqlResult.rows.length} rows · {sqlResult.executionMs}{" "}
                        ms
                      </Badge>
                      {sqlMatch && (
                        <Badge
                          colorScheme={sqlMatch.matched ? "green" : "orange"}
                          rounded="md"
                          px={2}
                        >
                          {sqlMatch.matched
                            ? "Matched Expected Output"
                            : "Does not match Expected Output yet"}
                        </Badge>
                      )}
                    </HStack>
                  </Flex>

                  {sqlMatch && !sqlMatch.matched && sqlMatch.reason && (
                    <Text fontSize="xs" color="orange.500" fontWeight={600}>
                      {sqlMatch.reason}
                    </Text>
                  )}

                  {sqlResult.columns.length > 0 ? (
                    <Box
                      overflowX="auto"
                      borderWidth="1px"
                      borderColor={cardBorder}
                      rounded="xl"
                      maxH="300px"
                      overflowY="auto"
                    >
                      <Table size="sm" variant="simple">
                        <Thead bg={headerBg}>
                          <Tr>
                            {sqlResult.columns.map((col, idx) => (
                              <Th
                                key={`${col}-${idx}`}
                                textTransform="none"
                                fontFamily="mono"
                              >
                                {col}
                              </Th>
                            ))}
                          </Tr>
                        </Thead>
                        <Tbody>
                          {sqlResult.rows.map((row, rIdx) => (
                            <Tr key={rIdx}>
                              {row.map((cell, cIdx) => (
                                <Td key={cIdx} fontFamily="mono" fontSize="xs">
                                  {cell === "NULL" ? (
                                    <Text
                                      as="span"
                                      color={subText}
                                      fontStyle="italic"
                                    >
                                      NULL
                                    </Text>
                                  ) : (
                                    cell
                                  )}
                                </Td>
                              ))}
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </Box>
                  ) : (
                    <Text fontSize="xs" color={subText}>
                      Query ran successfully (0 rows returned).
                    </Text>
                  )}
                </Stack>
              )}
            </Box>
          )}

          {/* JS / Python Result Output */}
          {scriptResult && (
            <Box px={4} pb={4}>
              <Divider mb={3} />
              <HStack justify="space-between" mb={2}>
                <Text
                  fontSize="xs"
                  fontWeight={700}
                  textTransform="uppercase"
                  color={subText}
                >
                  Output ({scriptResult.executionMs} ms)
                </Text>
              </HStack>
              {scriptResult.error ? (
                <Alert status="error" rounded="xl" fontSize="xs">
                  <AlertIcon />
                  <Text fontFamily="mono" whiteSpace="pre-wrap">
                    {scriptResult.error}
                  </Text>
                </Alert>
              ) : (
                <Box
                  bg={editorBg}
                  borderWidth="1px"
                  borderColor={cardBorder}
                  rounded="xl"
                  p={3}
                  fontFamily="mono"
                  fontSize="xs"
                  whiteSpace="pre-wrap"
                  maxH="260px"
                  overflowY="auto"
                >
                  {scriptResult.logs.length > 0
                    ? scriptResult.logs.join("\n")
                    : scriptResult.returnValue !== undefined
                      ? `=> ${scriptResult.returnValue}`
                      : "(No console output)"}
                </Box>
              )}
            </Box>
          )}

          {/* Self-Check Checklist + Mark Complete Footer */}
          <Box
            px={4}
            py={3.5}
            borderTopWidth="1px"
            borderColor={cardBorder}
            bg={headerBg}
          >
            {requirementItems.length > 0 && (
              <Stack spacing={1.5} mb={3}>
                <Text fontSize="xs" fontWeight={700} color={subText}>
                  Self-check checklist:
                </Text>
                {requirementItems.map((item, idx) => (
                  <Checkbox
                    key={idx}
                    size="sm"
                    isChecked={Boolean(checkedSteps[idx])}
                    onChange={(e) =>
                      setCheckedSteps((prev) => ({
                        ...prev,
                        [idx]: e.target.checked,
                      }))
                    }
                  >
                    <Text fontSize="xs">{item}</Text>
                  </Checkbox>
                ))}
              </Stack>
            )}

            <Flex justify="space-between" align="center" gap={3}>
              <Text fontSize="xs" color={subText}>
                {isCompleted
                  ? "This practice lesson is marked complete."
                  : "Complete the exercise and mark your progress."}
              </Text>
              <Button
                size="sm"
                colorScheme={isCompleted ? "green" : "blue"}
                variant={isCompleted ? "solid" : "outline"}
                rounded="xl"
                onClick={onToggleComplete}
                leftIcon={<IconCheck size={15} />}
                flexShrink={0}
              >
                {isCompleted ? "Completed" : "Mark complete"}
              </Button>
            </Flex>
          </Box>
        </Box>
      </Stack>
    </SimpleGrid>
  );
};
