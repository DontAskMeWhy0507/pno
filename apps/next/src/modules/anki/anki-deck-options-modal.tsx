import React, { useEffect, useState } from "react";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  Divider,
  FormControl,
  FormHelperText,
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
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import {
  DEFAULT_DECK_OPTIONS,
  formatStepsString,
  parseStepsString,
  resolveDeckOptions,
  type AnkiDeckOptions,
  type AnkiLeechAction,
  type AnkiNewGatherOrder,
  type AnkiReviewMix,
  type AnkiReviewSortOrder,
} from "@pno/lib/src/anki/srs";
import { api } from "@pno/trpc";

export interface AnkiDeckOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  studySetId: string;
  initialOptions?: Partial<AnkiDeckOptions> | null;
  dayKey?: string;
  newStudiedToday?: number;
  reviewsStudiedToday?: number;
}

export const AnkiDeckOptionsModal: React.FC<AnkiDeckOptionsModalProps> = ({
  isOpen,
  onClose,
  studySetId,
  initialOptions,
  dayKey,
  newStudiedToday = 0,
  reviewsStudiedToday = 0,
}) => {
  const toast = useToast();
  const utils = api.useUtils();
  const sectionBg = useColorModeValue("gray.50", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const mutedText = useColorModeValue("gray.600", "gray.400");

  const resolvedInit = resolveDeckOptions(initialOptions);
  const [form, setForm] = useState<AnkiDeckOptions>(resolvedInit);
  const [learnStepsText, setLearnStepsText] = useState(() =>
    formatStepsString(resolvedInit.learningStepsMinutes),
  );
  const [relearnStepsText, setRelearnStepsText] = useState(() =>
    formatStepsString(resolvedInit.relearningStepsMinutes),
  );

  // Today-only override state
  const activeTodayOverride =
    resolvedInit.todayOverride &&
    (!dayKey || resolvedInit.todayOverride.dayKey === dayKey)
      ? resolvedInit.todayOverride
      : null;
  const [todayNewText, setTodayNewText] = useState<string>(
    activeTodayOverride?.newCardsPerDay !== undefined
      ? String(activeTodayOverride.newCardsPerDay)
      : "",
  );
  const [todayReviewText, setTodayReviewText] = useState<string>(
    activeTodayOverride?.maxReviewsPerDay !== undefined
      ? String(activeTodayOverride.maxReviewsPerDay)
      : "",
  );

  useEffect(() => {
    if (!isOpen) return;
    const next = resolveDeckOptions(initialOptions);
    setForm(next);
    setLearnStepsText(formatStepsString(next.learningStepsMinutes));
    setRelearnStepsText(formatStepsString(next.relearningStepsMinutes));
    const ov =
      next.todayOverride && (!dayKey || next.todayOverride.dayKey === dayKey)
        ? next.todayOverride
        : null;
    setTodayNewText(
      ov?.newCardsPerDay !== undefined ? String(ov.newCardsPerDay) : "",
    );
    setTodayReviewText(
      ov?.maxReviewsPerDay !== undefined ? String(ov.maxReviewsPerDay) : "",
    );
  }, [isOpen, initialOptions, dayKey]);

  const updateOptionsMutation = api.anki.updateDeckOptions.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.studySets.invalidate(),
        utils.anki.getReviewQueue.invalidate({ studySetId }),
        utils.anki.getStats.invalidate({ studySetId }),
      ]);
      toast({
        title: "Deck options saved",
        status: "success",
        duration: 2000,
      });
      onClose();
    },
    onError: (err) => {
      toast({
        title: "Failed to save deck options",
        description: err.message,
        status: "error",
        duration: 3000,
      });
    },
  });

  const handleSave = () => {
    const parsedLearn = parseStepsString(learnStepsText);
    const parsedRelearn = parseStepsString(relearnStepsText);
    if (parsedLearn.length === 0) {
      toast({
        title: "Invalid learning steps",
        description: 'Use formats like "1m 10m" or "1m 10m 1d".',
        status: "warning",
        duration: 3000,
      });
      return;
    }
    if (parsedRelearn.length === 0) {
      toast({
        title: "Invalid relearning steps",
        description: 'Use formats like "10m" or "10m 1d".',
        status: "warning",
        duration: 3000,
      });
      return;
    }

    const tNewTrim = todayNewText.trim();
    const tRevTrim = todayReviewText.trim();
    const hasTodayOverride = tNewTrim !== "" || tRevTrim !== "";
    const todayOnly = hasTodayOverride
      ? {
          ...(tNewTrim !== ""
            ? {
                newCardsPerDay: Math.max(
                  0,
                  Math.min(9999, Math.round(Number(tNewTrim) || 0)),
                ),
              }
            : {}),
          ...(tRevTrim !== ""
            ? {
                maxReviewsPerDay: Math.max(
                  0,
                  Math.min(9999, Math.round(Number(tRevTrim) || 0)),
                ),
              }
            : {}),
        }
      : null;

    updateOptionsMutation.mutate({
      studySetId,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      todayOnly,
      options: {
        newCardsPerDay: form.newCardsPerDay,
        maxReviewsPerDay: form.maxReviewsPerDay,
        learningStepsMinutes: parsedLearn,
        graduatingIntervalDays: form.graduatingIntervalDays,
        easyIntervalDays: form.easyIntervalDays,
        newCardGatherOrder: form.newCardGatherOrder,
        relearningStepsMinutes: parsedRelearn,
        minimumLapseIntervalDays: form.minimumLapseIntervalDays,
        leechThreshold: form.leechThreshold,
        leechAction: form.leechAction,
        newMix: form.newMix,
        interdayLearnMix: form.interdayLearnMix,
        reviewSortOrder: form.reviewSortOrder,
        showTimer: form.showTimer,
        capAnswerTimeSecs: form.capAnswerTimeSecs,
        disableAutoplay: form.disableAutoplay,
        maxIntervalDays: form.maxIntervalDays,
        startingEaseFactor: form.startingEaseFactor,
        easyIntervalBonus: form.easyIntervalBonus,
        intervalModifier: form.intervalModifier,
        hardIntervalMultiplier: form.hardIntervalMultiplier,
        lapseNewIntervalMultiplier: form.lapseNewIntervalMultiplier,
        rolloverHour: form.rolloverHour,
        learnAheadMinutes: form.learnAheadMinutes,
      },
    });
  };

  const handleResetDefaults = () => {
    updateOptionsMutation.mutate({
      studySetId,
      resetToDefaults: true,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={{ base: "full", md: "2xl" }}
      scrollBehavior="inside"
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack justify="space-between" pr={8}>
            <Text fontWeight={800}>Deck Options (Anki V3)</Text>
            <Badge colorScheme="orange" rounded="md" fontSize="xs">
              SM-2 Scheduler
            </Badge>
          </HStack>
        </ModalHeader>
        <ModalCloseButton rounded="full" top={3.5} right={3.5} />

        <ModalBody pb={6}>
          <Stack spacing={4}>
            {/* Daily Limits (Preset vs Today Only, matching Anki's DailyLimits.svelte) */}
            <Box
              p={4}
              rounded="xl"
              bg={sectionBg}
              borderWidth="1px"
              borderColor={borderColor}
            >
              <HStack justify="space-between" mb={2} flexWrap="wrap" gap={2}>
                <Text fontWeight={700} fontSize="md">
                  Daily Limits
                </Text>
                <Text fontSize="xs" color={mutedText}>
                  Studied today: <b>{newStudiedToday}</b> new •{" "}
                  <b>{reviewsStudiedToday}</b> review
                </Text>
              </HStack>

              <Tabs size="sm" variant="soft-rounded" colorScheme="orange">
                <TabList mb={3}>
                  <Tab>This Deck (Default)</Tab>
                  <Tab>
                    Today Only
                    {(todayNewText.trim() !== "" ||
                      todayReviewText.trim() !== "") && (
                      <Badge ml={1.5} colorScheme="green" fontSize="2xs">
                        Active
                      </Badge>
                    )}
                  </Tab>
                </TabList>
                <TabPanels>
                  <TabPanel p={0}>
                    <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                      <FormControl>
                        <FormLabel fontSize="sm" fontWeight={600}>
                          New cards/day
                        </FormLabel>
                        <NumberInput
                          min={0}
                          max={9999}
                          value={form.newCardsPerDay}
                          onChange={(_, n) =>
                            setForm((p) => ({
                              ...p,
                              newCardsPerDay: Number.isFinite(n) ? n : 0,
                            }))
                          }
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                        <FormHelperText fontSize="xs">
                          Anki default: {DEFAULT_DECK_OPTIONS.newCardsPerDay}
                        </FormHelperText>
                      </FormControl>

                      <FormControl>
                        <FormLabel fontSize="sm" fontWeight={600}>
                          Maximum reviews/day
                        </FormLabel>
                        <NumberInput
                          min={0}
                          max={9999}
                          value={form.maxReviewsPerDay}
                          onChange={(_, n) =>
                            setForm((p) => ({
                              ...p,
                              maxReviewsPerDay: Number.isFinite(n) ? n : 0,
                            }))
                          }
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                        <FormHelperText fontSize="xs">
                          Anki default: {DEFAULT_DECK_OPTIONS.maxReviewsPerDay}
                        </FormHelperText>
                      </FormControl>
                    </SimpleGrid>
                  </TabPanel>

                  <TabPanel p={0}>
                    <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                      <FormControl>
                        <FormLabel fontSize="sm" fontWeight={600}>
                          New cards today only
                        </FormLabel>
                        <Input
                          type="number"
                          min={0}
                          max={9999}
                          placeholder={`Default (${form.newCardsPerDay})`}
                          value={todayNewText}
                          onChange={(e) => setTodayNewText(e.target.value)}
                        />
                        <FormHelperText fontSize="xs">
                          Leave empty to use deck default; resets at{" "}
                          {form.rolloverHour}:00 AM.
                        </FormHelperText>
                      </FormControl>

                      <FormControl>
                        <FormLabel fontSize="sm" fontWeight={600}>
                          Max reviews today only
                        </FormLabel>
                        <Input
                          type="number"
                          min={0}
                          max={9999}
                          placeholder={`Default (${form.maxReviewsPerDay})`}
                          value={todayReviewText}
                          onChange={(e) => setTodayReviewText(e.target.value)}
                        />
                        <FormHelperText fontSize="xs">
                          Overrides review limit just for today.
                        </FormHelperText>
                      </FormControl>
                    </SimpleGrid>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </Box>

            <Accordion allowMultiple defaultIndex={[0, 1]}>
              {/* New Cards */}
              <AccordionItem borderColor={borderColor}>
                <AccordionButton px={2}>
                  <Box flex="1" textAlign="left" fontWeight={700}>
                    New Cards
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel pb={4} px={2}>
                  <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                    <FormControl>
                      <FormLabel fontSize="sm">Learning steps</FormLabel>
                      <Input
                        value={learnStepsText}
                        onChange={(e) => setLearnStepsText(e.target.value)}
                        placeholder="1m 10m"
                      />
                      <FormHelperText fontSize="xs">
                        Space-separated (e.g. 1m 10m or 10m 1d).
                      </FormHelperText>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">New card gather order</FormLabel>
                      <Select
                        value={form.newCardGatherOrder}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            newCardGatherOrder: e.target
                              .value as AnkiNewGatherOrder,
                          }))
                        }
                      >
                        <option value="sequential">Sequential (Position)</option>
                        <option value="random">Random</option>
                      </Select>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">
                        Graduating interval (days)
                      </FormLabel>
                      <NumberInput
                        min={1}
                        max={36500}
                        value={form.graduatingIntervalDays}
                        onChange={(_, n) =>
                          setForm((p) => ({
                            ...p,
                            graduatingIntervalDays: Number.isFinite(n)
                              ? Math.max(1, n)
                              : 1,
                          }))
                        }
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Easy interval (days)</FormLabel>
                      <NumberInput
                        min={1}
                        max={36500}
                        value={form.easyIntervalDays}
                        onChange={(_, n) =>
                          setForm((p) => ({
                            ...p,
                            easyIntervalDays: Number.isFinite(n)
                              ? Math.max(1, n)
                              : 4,
                          }))
                        }
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>
                  </SimpleGrid>
                </AccordionPanel>
              </AccordionItem>

              {/* Lapses */}
              <AccordionItem borderColor={borderColor}>
                <AccordionButton px={2}>
                  <Box flex="1" textAlign="left" fontWeight={700}>
                    Lapses
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel pb={4} px={2}>
                  <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                    <FormControl>
                      <FormLabel fontSize="sm">Relearning steps</FormLabel>
                      <Input
                        value={relearnStepsText}
                        onChange={(e) => setRelearnStepsText(e.target.value)}
                        placeholder="10m"
                      />
                      <FormHelperText fontSize="xs">
                        Steps when you forget a Review card (default: 10m).
                      </FormHelperText>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">
                        Minimum interval (days)
                      </FormLabel>
                      <NumberInput
                        min={1}
                        max={36500}
                        value={form.minimumLapseIntervalDays}
                        onChange={(_, n) =>
                          setForm((p) => ({
                            ...p,
                            minimumLapseIntervalDays: Number.isFinite(n)
                              ? Math.max(1, n)
                              : 1,
                          }))
                        }
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Leech threshold</FormLabel>
                      <NumberInput
                        min={0}
                        max={999}
                        value={form.leechThreshold}
                        onChange={(_, n) =>
                          setForm((p) => ({
                            ...p,
                            leechThreshold: Number.isFinite(n)
                              ? Math.max(0, n)
                              : 8,
                          }))
                        }
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                      <FormHelperText fontSize="xs">
                        0 disables leech detection (default: 8 lapses).
                      </FormHelperText>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Leech action</FormLabel>
                      <Select
                        value={form.leechAction}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            leechAction: e.target.value as AnkiLeechAction,
                          }))
                        }
                      >
                        <option value="suspend">Suspend Card</option>
                        <option value="tag_only">Keep Active (Tag Only)</option>
                      </Select>
                    </FormControl>
                  </SimpleGrid>
                </AccordionPanel>
              </AccordionItem>

              {/* Display Order */}
              <AccordionItem borderColor={borderColor}>
                <AccordionButton px={2}>
                  <Box flex="1" textAlign="left" fontWeight={700}>
                    Display Order
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel pb={4} px={2}>
                  <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                    <FormControl>
                      <FormLabel fontSize="sm">New/review order</FormLabel>
                      <Select
                        value={form.newMix}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            newMix: e.target.value as AnkiReviewMix,
                          }))
                        }
                      >
                        <option value="after_reviews">Show after reviews</option>
                        <option value="mix">Mix with reviews</option>
                        <option value="before_reviews">
                          Show before reviews
                        </option>
                      </Select>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">
                        Interday learning/review order
                      </FormLabel>
                      <Select
                        value={form.interdayLearnMix}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            interdayLearnMix: e.target.value as AnkiReviewMix,
                          }))
                        }
                      >
                        <option value="mix">Mix with reviews</option>
                        <option value="after_reviews">Show after reviews</option>
                        <option value="before_reviews">
                          Show before reviews
                        </option>
                      </Select>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Review sort order</FormLabel>
                      <Select
                        value={form.reviewSortOrder}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            reviewSortOrder: e.target
                              .value as AnkiReviewSortOrder,
                          }))
                        }
                      >
                        <option value="due_asc">Due date, then order</option>
                        <option value="interval_asc">
                          Lowest intervals first
                        </option>
                        <option value="interval_desc">
                          Highest intervals first
                        </option>
                        <option value="random">Random</option>
                      </Select>
                    </FormControl>
                  </SimpleGrid>
                </AccordionPanel>
              </AccordionItem>

              {/* Timer & Audio */}
              <AccordionItem borderColor={borderColor}>
                <AccordionButton px={2}>
                  <Box flex="1" textAlign="left" fontWeight={700}>
                    Timer &amp; Audio
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel pb={4} px={2}>
                  <Stack spacing={4}>
                    <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                      <FormControl
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <FormLabel mb={0} fontSize="sm">
                          Show on-screen answer timer
                        </FormLabel>
                        <Switch
                          colorScheme="orange"
                          isChecked={form.showTimer}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              showTimer: e.target.checked,
                            }))
                          }
                        />
                      </FormControl>

                      <FormControl
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <FormLabel mb={0} fontSize="sm">
                          Disable automatic audio play
                        </FormLabel>
                        <Switch
                          colorScheme="orange"
                          isChecked={form.disableAutoplay}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              disableAutoplay: e.target.checked,
                            }))
                          }
                        />
                      </FormControl>
                    </SimpleGrid>

                    <FormControl maxW="240px">
                      <FormLabel fontSize="sm">
                        Maximum answer seconds (for Stats)
                      </FormLabel>
                      <NumberInput
                        min={5}
                        max={3600}
                        value={form.capAnswerTimeSecs}
                        onChange={(_, n) =>
                          setForm((p) => ({
                            ...p,
                            capAnswerTimeSecs: Number.isFinite(n)
                              ? Math.max(5, n)
                              : 60,
                          }))
                        }
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>
                  </Stack>
                </AccordionPanel>
              </AccordionItem>

              {/* Advanced SM-2 */}
              <AccordionItem borderColor={borderColor}>
                <AccordionButton px={2}>
                  <Box flex="1" textAlign="left" fontWeight={700}>
                    Advanced (SM-2 Multipliers &amp; Day Cutoff)
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel pb={4} px={2}>
                  <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                    <FormControl>
                      <FormLabel fontSize="sm">Starting ease (2.5 = 250%)</FormLabel>
                      <NumberInput
                        min={1.3}
                        max={5.0}
                        step={0.05}
                        precision={2}
                        value={Number((form.startingEaseFactor / 1000).toFixed(2))}
                        onChange={(_, n) =>
                          setForm((p) => ({
                            ...p,
                            startingEaseFactor: Number.isFinite(n)
                              ? Math.round(n * 1000)
                              : 2500,
                          }))
                        }
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Easy bonus (default 1.30)</FormLabel>
                      <NumberInput
                        min={1.0}
                        max={5.0}
                        step={0.05}
                        precision={2}
                        value={form.easyIntervalBonus}
                        onChange={(_, n) =>
                          setForm((p) => ({
                            ...p,
                            easyIntervalBonus: Number.isFinite(n) ? n : 1.3,
                          }))
                        }
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Interval modifier (default 1.00)</FormLabel>
                      <NumberInput
                        min={0.5}
                        max={2.5}
                        step={0.05}
                        precision={2}
                        value={form.intervalModifier}
                        onChange={(_, n) =>
                          setForm((p) => ({
                            ...p,
                            intervalModifier: Number.isFinite(n) ? n : 1.0,
                          }))
                        }
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Hard interval (default 1.20)</FormLabel>
                      <NumberInput
                        min={1.0}
                        max={2.5}
                        step={0.05}
                        precision={2}
                        value={form.hardIntervalMultiplier}
                        onChange={(_, n) =>
                          setForm((p) => ({
                            ...p,
                            hardIntervalMultiplier: Number.isFinite(n) ? n : 1.2,
                          }))
                        }
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">
                        New interval on lapse (0.00 - 1.00)
                      </FormLabel>
                      <NumberInput
                        min={0}
                        max={1.0}
                        step={0.05}
                        precision={2}
                        value={form.lapseNewIntervalMultiplier}
                        onChange={(_, n) =>
                          setForm((p) => ({
                            ...p,
                            lapseNewIntervalMultiplier: Number.isFinite(n)
                              ? n
                              : 0,
                          }))
                        }
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Maximum interval (days)</FormLabel>
                      <NumberInput
                        min={1}
                        max={36500}
                        value={form.maxIntervalDays}
                        onChange={(_, n) =>
                          setForm((p) => ({
                            ...p,
                            maxIntervalDays: Number.isFinite(n)
                              ? Math.max(1, n)
                              : 36500,
                          }))
                        }
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Next day starts at (hour)</FormLabel>
                      <NumberInput
                        min={0}
                        max={23}
                        value={form.rolloverHour}
                        onChange={(_, n) =>
                          setForm((p) => ({
                            ...p,
                            rolloverHour: Number.isFinite(n) ? n : 4,
                          }))
                        }
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Learn ahead limit (minutes)</FormLabel>
                      <NumberInput
                        min={0}
                        max={180}
                        value={form.learnAheadMinutes}
                        onChange={(_, n) =>
                          setForm((p) => ({
                            ...p,
                            learnAheadMinutes: Number.isFinite(n) ? n : 20,
                          }))
                        }
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>
                  </SimpleGrid>
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          </Stack>
        </ModalBody>

        <Divider />
        <ModalFooter justifyContent="space-between">
          <Button
            variant="ghost"
            colorScheme="red"
            size="sm"
            onClick={handleResetDefaults}
            isLoading={updateOptionsMutation.isLoading}
          >
            Reset Defaults
          </Button>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="orange"
              onClick={handleSave}
              isLoading={updateOptionsMutation.isLoading}
            >
              Save Options
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AnkiDeckOptionsModal;
