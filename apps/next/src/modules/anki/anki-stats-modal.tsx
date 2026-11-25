import React, { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  Divider,
  Flex,
  HStack,
  Heading,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Spinner,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import { api } from "@pno/trpc";

export interface AnkiStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  studySetId: string;
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

export const AnkiStatsModal: React.FC<AnkiStatsModalProps> = ({
  isOpen,
  onClose,
  studySetId,
}) => {
  const toast = useToast();
  const utils = api.useUtils();
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [reviewsMode, setReviewsMode] = useState<"count" | "time">("count");

  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const mutedText = useColorModeValue("gray.600", "gray.400");
  const barTrackBg = useColorModeValue("gray.100", "gray.700");

  const timezoneOffsetMinutes = useMemo(
    () => new Date().getTimezoneOffset(),
    [],
  );

  const statsQuery = api.anki.getStats.useQuery(
    { studySetId, rangeDays, timezoneOffsetMinutes },
    { enabled: isOpen },
  );

  const setSuspendedMutation = api.anki.setCardSuspended.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.anki.getStats.invalidate({ studySetId }),
        utils.anki.getReviewQueue.invalidate({ studySetId }),
      ]);
      toast({ title: "Card unsuspended", status: "success", duration: 1800 });
    },
  });

  const stats = statsQuery.data?.stats;
  const suspendedCards = statsQuery.data?.suspendedCards ?? [];

  const maxFuture = useMemo(() => {
    if (!stats) return 1;
    return Math.max(1, ...stats.futureDue.days.map((d) => d.count));
  }, [stats]);

  const maxReviewsDay = useMemo(() => {
    if (!stats) return 1;
    return Math.max(
      1,
      ...stats.reviews.days.map((d) =>
        reviewsMode === "count"
          ? d.learn + d.relearn + d.young + d.mature
          : Math.round((d.learnMs + d.relearnMs + d.youngMs + d.matureMs) / 60000),
      ),
    );
  }, [stats, reviewsMode]);

  const maxHourTotal = useMemo(() => {
    if (!stats) return 1;
    return Math.max(1, ...stats.hours.map((h) => h.total));
  }, [stats]);

  const maxIntervalBucket = useMemo(() => {
    if (!stats) return 1;
    return Math.max(1, ...stats.intervals.buckets.map((b) => b.count));
  }, [stats]);

  const maxEaseBucket = useMemo(() => {
    if (!stats) return 1;
    return Math.max(1, ...stats.eases.buckets.map((b) => b.count));
  }, [stats]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={{ base: "full", md: "6xl" }}
      scrollBehavior="inside"
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Flex
            justify="space-between"
            align="center"
            flexWrap="wrap"
            gap={3}
            pr={8}
          >
            <Stack spacing={0}>
              <Text fontWeight={800}>Anki Statistics</Text>
              {statsQuery.data?.deckTitle && (
                <Text fontSize="xs" color={mutedText} fontWeight={500}>
                  {statsQuery.data.deckTitle}
                </Text>
              )}
            </Stack>
            <ButtonGroup size="xs" isAttached variant="outline">
              {[
                { label: "1 month", value: 30 },
                { label: "3 months", value: 90 },
                { label: "1 year", value: 365 },
                { label: "All time", value: 0 },
              ].map((opt) => (
                <Button
                  key={opt.value}
                  colorScheme={rangeDays === opt.value ? "orange" : "gray"}
                  variant={rangeDays === opt.value ? "solid" : "outline"}
                  onClick={() => setRangeDays(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </ButtonGroup>
          </Flex>
        </ModalHeader>
        <ModalCloseButton rounded="full" top={3.5} right={3.5} />

        <ModalBody pb={8}>
          {statsQuery.isLoading || !stats ? (
            <Flex justify="center" py={16} align="center" gap={3}>
              <Spinner color="orange.400" />
              <Text color={mutedText}>Calculating Anki statistics...</Text>
            </Flex>
          ) : (
            <Stack spacing={5}>
              {/* Row 1: Today + Card Counts */}
              <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
                {/* Today */}
                <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} rounded="xl">
                  <CardBody>
                    <Heading size="sm" mb={2}>
                      Today
                    </Heading>
                    {stats.today.answerCount === 0 ? (
                      <Text fontSize="sm" color={mutedText}>
                        No cards studied today yet.
                      </Text>
                    ) : (
                      <Stack spacing={2} fontSize="sm">
                        <Text>
                          Studied <b>{stats.today.answerCount}</b> cards in{" "}
                          <b>{formatDuration(stats.today.answerMillis)}</b> today (
                          <b>{stats.today.avgSecs}s</b>/card)
                        </Text>
                        <Text color={mutedText}>
                          Again: <b>{stats.today.answerCount - stats.today.correctCount}</b>{" "}
                          • Correct:{" "}
                          <b>
                            {stats.today.correctCount}/{stats.today.answerCount} (
                            {stats.today.correctPct ?? 0}%)
                          </b>
                        </Text>
                        <HStack spacing={2} flexWrap="wrap">
                          <Badge colorScheme="red">Learn: {stats.today.learnCount}</Badge>
                          <Badge colorScheme="green">Review: {stats.today.reviewCount}</Badge>
                          <Badge colorScheme="orange">
                            Relearn: {stats.today.relearnCount}
                          </Badge>
                          {stats.today.matureCount > 0 && (
                            <Badge colorScheme="teal">
                              Mature: {stats.today.matureCorrect}/{stats.today.matureCount}
                            </Badge>
                          )}
                        </HStack>
                      </Stack>
                    )}
                  </CardBody>
                </Card>

                {/* Card Counts */}
                <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} rounded="xl">
                  <CardBody>
                    <HStack justify="space-between" mb={2}>
                      <Heading size="sm">Card Counts</Heading>
                      <Text fontSize="xs" color={mutedText}>
                        Total: <b>{stats.cardCounts.total}</b>
                      </Text>
                    </HStack>
                    {stats.cardCounts.total > 0 && (
                      <Flex h="14px" rounded="full" overflow="hidden" bg={barTrackBg} mb={3}>
                        {[
                          { v: stats.cardCounts.newCards, c: "#3182CE" },
                          { v: stats.cardCounts.learn, c: "#E53E3E" },
                          { v: stats.cardCounts.relearn, c: "#DD6B20" },
                          { v: stats.cardCounts.young, c: "#48BB78" },
                          { v: stats.cardCounts.mature, c: "#276749" },
                          { v: stats.cardCounts.suspended, c: "#ECC94B" },
                        ].map((seg, i) =>
                          seg.v > 0 ? (
                            <Box
                              key={i}
                              w={`${(seg.v / stats.cardCounts.total) * 100}%`}
                              bg={seg.c}
                            />
                          ) : null,
                        )}
                      </Flex>
                    )}
                    <SimpleGrid columns={{ base: 2, sm: 3 }} spacing={2} fontSize="xs">
                      <HStack>
                        <Box w={2.5} h={2.5} rounded="sm" bg="#3182CE" />
                        <Text>New: <b>{stats.cardCounts.newCards}</b></Text>
                      </HStack>
                      <HStack>
                        <Box w={2.5} h={2.5} rounded="sm" bg="#E53E3E" />
                        <Text>Learning: <b>{stats.cardCounts.learn}</b></Text>
                      </HStack>
                      <HStack>
                        <Box w={2.5} h={2.5} rounded="sm" bg="#DD6B20" />
                        <Text>Relearning: <b>{stats.cardCounts.relearn}</b></Text>
                      </HStack>
                      <HStack>
                        <Box w={2.5} h={2.5} rounded="sm" bg="#48BB78" />
                        <Text>Young: <b>{stats.cardCounts.young}</b></Text>
                      </HStack>
                      <HStack>
                        <Box w={2.5} h={2.5} rounded="sm" bg="#276749" />
                        <Text>Mature: <b>{stats.cardCounts.mature}</b></Text>
                      </HStack>
                      <HStack>
                        <Box w={2.5} h={2.5} rounded="sm" bg="#ECC94B" />
                        <Text>Suspended: <b>{stats.cardCounts.suspended}</b></Text>
                      </HStack>
                    </SimpleGrid>
                  </CardBody>
                </Card>
              </SimpleGrid>

              {/* Row 2: Calendar Heatmap */}
              <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} rounded="xl">
                <CardBody>
                  <Flex justify="space-between" align="center" flexWrap="wrap" gap={2} mb={3}>
                    <Heading size="sm">Calendar (Last 26 Weeks)</Heading>
                    <HStack spacing={4} fontSize="xs" color={mutedText} flexWrap="wrap">
                      <Text>
                        Days studied:{" "}
                        <b>
                          {Math.round(
                            (stats.calendar.daysStudied /
                              Math.max(1, stats.calendar.totalDays)) *
                              100,
                          )}
                          %
                        </b>{" "}
                        ({stats.calendar.daysStudied}/{stats.calendar.totalDays})
                      </Text>
                      <Text>
                        Daily average: <b>{stats.calendar.dailyAverage}</b>
                      </Text>
                      <Text>
                        Streak: <b>{stats.calendar.currentStreak}d</b> (Best:{" "}
                        {stats.calendar.longestStreak}d)
                      </Text>
                    </HStack>
                  </Flex>

                  <Box overflowX="auto" pb={1}>
                    <Box
                      display="grid"
                      gridTemplateRows="repeat(7, 12px)"
                      gridAutoFlow="column"
                      gap="3px"
                      w="max-content"
                    >
                      {stats.calendar.days.map((d) => {
                        const colors = [
                          "var(--chakra-colors-blackAlpha-100)",
                          "#9ae6b4",
                          "#48bb78",
                          "#2f855a",
                          "#22543d",
                        ];
                        return (
                          <Tooltip
                            key={d.dateKey}
                            label={`${d.dateKey}: ${d.count} reviews`}
                            fontSize="xs"
                          >
                            <Box
                              w="12px"
                              h="12px"
                              rounded="2px"
                              bg={colors[d.level]}
                              _dark={{
                                bg:
                                  d.level === 0
                                    ? "whiteAlpha.100"
                                    : colors[d.level],
                              }}
                            />
                          </Tooltip>
                        );
                      })}
                    </Box>
                  </Box>
                </CardBody>
              </Card>

              {/* Row 3: Future Due + Reviews */}
              <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
                {/* Future Due */}
                <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} rounded="xl">
                  <CardBody>
                    <Flex justify="space-between" align="center" mb={2} flexWrap="wrap" gap={2}>
                      <Heading size="sm">Future Due</Heading>
                      <HStack spacing={2} fontSize="xs" color={mutedText}>
                        {stats.futureDue.backlog > 0 && (
                          <Badge colorScheme="red">
                            Backlog: {stats.futureDue.backlog}
                          </Badge>
                        )}
                        <Text>
                          Avg: <b>{stats.futureDue.averageDue}</b>/day • Load:{" "}
                          <b>{stats.futureDue.dailyLoad}</b>
                        </Text>
                      </HStack>
                    </Flex>

                    <Flex
                      align="flex-end"
                      h="130px"
                      gap="2px"
                      pt={2}
                      borderBottomWidth="1px"
                      borderColor={borderColor}
                    >
                      {stats.futureDue.days.slice(0, 60).map((d) => {
                        const pct = (d.count / maxFuture) * 100;
                        return (
                          <Tooltip
                            key={d.dayOffset}
                            label={`+${d.dayOffset}d: ${d.count} due (${d.young} young, ${d.mature} mature)`}
                            fontSize="xs"
                          >
                            <Flex
                              flex="1"
                              direction="column"
                              justify="flex-end"
                              h="full"
                              minW="3px"
                            >
                              {d.count > 0 && (
                                <Box
                                  h={`${Math.max(4, pct)}%`}
                                  w="full"
                                  bg="#38a169"
                                  roundedTop="2px"
                                />
                              )}
                            </Flex>
                          </Tooltip>
                        );
                      })}
                    </Flex>
                    <HStack justify="space-between" fontSize="2xs" color={mutedText} mt={1}>
                      <Text>Today</Text>
                      <Text>
                        +{Math.min(60, stats.futureDue.days.length)} days
                      </Text>
                    </HStack>
                  </CardBody>
                </Card>

                {/* Reviews */}
                <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} rounded="xl">
                  <CardBody>
                    <Flex justify="space-between" align="center" mb={2} flexWrap="wrap" gap={2}>
                      <Heading size="sm">Reviews</Heading>
                      <HStack spacing={2}>
                        <Text fontSize="xs" color={mutedText}>
                          Total: <b>{stats.reviews.totalReviews}</b> (
                          {formatDuration(stats.reviews.totalMillis)})
                        </Text>
                        <ButtonGroup size="xs" isAttached variant="outline">
                          <Button
                            colorScheme={reviewsMode === "count" ? "orange" : "gray"}
                            variant={reviewsMode === "count" ? "solid" : "outline"}
                            onClick={() => setReviewsMode("count")}
                          >
                            Count
                          </Button>
                          <Button
                            colorScheme={reviewsMode === "time" ? "orange" : "gray"}
                            variant={reviewsMode === "time" ? "solid" : "outline"}
                            onClick={() => setReviewsMode("time")}
                          >
                            Time
                          </Button>
                        </ButtonGroup>
                      </HStack>
                    </Flex>

                    <Flex
                      align="flex-end"
                      h="130px"
                      gap="2px"
                      pt={2}
                      borderBottomWidth="1px"
                      borderColor={borderColor}
                    >
                      {stats.reviews.days.slice(-60).map((d) => {
                        const learnVal =
                          reviewsMode === "count" ? d.learn : d.learnMs / 60000;
                        const relearnVal =
                          reviewsMode === "count" ? d.relearn : d.relearnMs / 60000;
                        const youngVal =
                          reviewsMode === "count" ? d.young : d.youngMs / 60000;
                        const matureVal =
                          reviewsMode === "count" ? d.mature : d.matureMs / 60000;
                        const totalVal =
                          learnVal + relearnVal + youngVal + matureVal;
                        const hPct = Math.min(100, (totalVal / maxReviewsDay) * 100);
                        return (
                          <Tooltip
                            key={d.dateKey}
                            label={`${d.dateKey}: ${d.learn} learn, ${d.relearn} relearn, ${d.young} young, ${d.mature} mature`}
                            fontSize="xs"
                          >
                            <Flex
                              flex="1"
                              direction="column"
                              justify="flex-end"
                              h="full"
                              minW="3px"
                            >
                              {totalVal > 0 && (
                                <Flex
                                  direction="column"
                                  h={`${Math.max(4, hPct)}%`}
                                  w="full"
                                  roundedTop="2px"
                                  overflow="hidden"
                                >
                                  <Box flex={matureVal} bg="#276749" />
                                  <Box flex={youngVal} bg="#48BB78" />
                                  <Box flex={relearnVal} bg="#DD6B20" />
                                  <Box flex={learnVal} bg="#E53E3E" />
                                </Flex>
                              )}
                            </Flex>
                          </Tooltip>
                        );
                      })}
                    </Flex>
                    <HStack justify="space-between" fontSize="2xs" color={mutedText} mt={1}>
                      <Text>Past</Text>
                      <Text>Today</Text>
                    </HStack>
                  </CardBody>
                </Card>
              </SimpleGrid>

              {/* Row 4: Review Intervals + Card Ease */}
              <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
                {/* Review Intervals */}
                <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} rounded="xl">
                  <CardBody>
                    <Flex justify="space-between" align="center" mb={3}>
                      <Heading size="sm">Review Intervals</Heading>
                      <Text fontSize="xs" color={mutedText}>
                        Avg: <b>{stats.intervals.averageDays}d</b> • Max:{" "}
                        <b>{stats.intervals.longestDays}d</b>
                      </Text>
                    </Flex>
                    <Stack spacing={2}>
                      {stats.intervals.buckets.map((b) => (
                        <HStack key={b.label} spacing={3} fontSize="xs">
                          <Text w="56px" color={mutedText}>
                            {b.label}
                          </Text>
                          <Box flex="1" h="12px" bg={barTrackBg} rounded="full" overflow="hidden">
                            <Box
                              h="full"
                              w={`${(b.count / maxIntervalBucket) * 100}%`}
                              bg="cyan.500"
                              rounded="full"
                            />
                          </Box>
                          <Text w="32px" textAlign="right" fontWeight={700}>
                            {b.count}
                          </Text>
                        </HStack>
                      ))}
                    </Stack>
                  </CardBody>
                </Card>

                {/* Card Ease */}
                <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} rounded="xl">
                  <CardBody>
                    <Flex justify="space-between" align="center" mb={3}>
                      <Heading size="sm">Card Ease</Heading>
                      <Text fontSize="xs" color={mutedText}>
                        Avg: <b>{stats.eases.averageEasePct}%</b> • Median:{" "}
                        <b>{stats.eases.medianEasePct}%</b>
                      </Text>
                    </Flex>
                    {stats.eases.buckets.length === 0 ? (
                      <Text fontSize="sm" color={mutedText}>
                        No graduated review cards yet.
                      </Text>
                    ) : (
                      <Stack spacing={2}>
                        {stats.eases.buckets.map((b) => (
                          <HStack key={b.label} spacing={3} fontSize="xs">
                            <Text w="48px" color={mutedText}>
                              {b.label}
                            </Text>
                            <Box flex="1" h="12px" bg={barTrackBg} rounded="full" overflow="hidden">
                              <Box
                                h="full"
                                w={`${(b.count / maxEaseBucket) * 100}%`}
                                bg="purple.400"
                                rounded="full"
                              />
                            </Box>
                            <Text w="32px" textAlign="right" fontWeight={700}>
                              {b.count}
                            </Text>
                          </HStack>
                        ))}
                      </Stack>
                    )}
                  </CardBody>
                </Card>
              </SimpleGrid>

              {/* Row 5: Hourly Breakdown + Answer Buttons */}
              <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
                {/* Hourly Breakdown */}
                <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} rounded="xl">
                  <CardBody>
                    <Heading size="sm" mb={3}>
                      Hourly Breakdown
                    </Heading>
                    <Flex
                      align="flex-end"
                      h="110px"
                      gap="3px"
                      borderBottomWidth="1px"
                      borderColor={borderColor}
                    >
                      {stats.hours.map((h) => {
                        const hPct = (h.total / maxHourTotal) * 100;
                        return (
                          <Tooltip
                            key={h.hour}
                            label={`${String(h.hour).padStart(2, "0")}:00 — ${h.total} reviews (${h.pct ?? 0}% correct)`}
                            fontSize="xs"
                          >
                            <Flex
                              flex="1"
                              direction="column"
                              justify="flex-end"
                              h="full"
                            >
                              {h.total > 0 && (
                                <Box
                                  h={`${Math.max(5, hPct)}%`}
                                  w="full"
                                  bg="blue.400"
                                  roundedTop="2px"
                                />
                              )}
                            </Flex>
                          </Tooltip>
                        );
                      })}
                    </Flex>
                    <HStack justify="space-between" fontSize="2xs" color={mutedText} mt={1}>
                      <Text>0h</Text>
                      <Text>6h</Text>
                      <Text>12h</Text>
                      <Text>18h</Text>
                      <Text>23h</Text>
                    </HStack>
                  </CardBody>
                </Card>

                {/* Answer Buttons */}
                <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} rounded="xl">
                  <CardBody>
                    <Heading size="sm" mb={3}>
                      Answer Buttons
                    </Heading>
                    <Table size="xs" variant="simple">
                      <Thead>
                        <Tr>
                          <Th px={1}>Category</Th>
                          <Th isNumeric px={1} color="red.400">
                            Again
                          </Th>
                          <Th isNumeric px={1} color="yellow.500">
                            Hard
                          </Th>
                          <Th isNumeric px={1} color="blue.400">
                            Good
                          </Th>
                          <Th isNumeric px={1} color="green.400">
                            Easy
                          </Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {(
                          [
                            { label: "Learning", arr: stats.buttons.learning },
                            { label: "Young", arr: stats.buttons.young },
                            { label: "Mature", arr: stats.buttons.mature },
                          ] as const
                        ).map((row) => (
                          <Tr key={row.label}>
                            <Td px={1} fontWeight={600}>
                              {row.label}
                            </Td>
                            <Td isNumeric px={1}>
                              {row.arr[0]}
                            </Td>
                            <Td isNumeric px={1}>
                              {row.arr[1]}
                            </Td>
                            <Td isNumeric px={1}>
                              {row.arr[2]}
                            </Td>
                            <Td isNumeric px={1}>
                              {row.arr[3]}
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </CardBody>
                </Card>
              </SimpleGrid>

              {/* Row 6: True Retention Table */}
              <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} rounded="xl">
                <CardBody>
                  <Heading size="sm" mb={3}>
                    True Retention
                  </Heading>
                  <Box overflowX="auto">
                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Past</Th>
                          <Th isNumeric>Young Pass %</Th>
                          <Th isNumeric>Mature Pass %</Th>
                          <Th isNumeric>Total</Th>
                          <Th isNumeric>Reviews</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {(
                          [
                            { label: "Today", data: stats.trueRetention.today },
                            {
                              label: "Yesterday",
                              data: stats.trueRetention.yesterday,
                            },
                            { label: "Last week", data: stats.trueRetention.week },
                            { label: "Last month", data: stats.trueRetention.month },
                            { label: "Last year", data: stats.trueRetention.year },
                            {
                              label: "All time",
                              data: stats.trueRetention.allTime,
                            },
                          ] as const
                        ).map((row) => {
                          const totalRev =
                            row.data.youngPassed +
                            row.data.youngFailed +
                            row.data.maturePassed +
                            row.data.matureFailed;
                          return (
                            <Tr key={row.label}>
                              <Td fontWeight={600}>{row.label}</Td>
                              <Td isNumeric>
                                {row.data.youngPct !== null
                                  ? `${row.data.youngPct}%`
                                  : "—"}
                              </Td>
                              <Td isNumeric>
                                {row.data.maturePct !== null
                                  ? `${row.data.maturePct}%`
                                  : "—"}
                              </Td>
                              <Td isNumeric fontWeight={700}>
                                {row.data.totalPct !== null
                                  ? `${row.data.totalPct}%`
                                  : "—"}
                              </Td>
                              <Td isNumeric color={mutedText}>
                                {totalRev}
                              </Td>
                            </Tr>
                          );
                        })}
                      </Tbody>
                    </Table>
                  </Box>
                </CardBody>
              </Card>

              {/* Suspended / Leech Cards */}
              {suspendedCards.length > 0 && (
                <Card bg={cardBg} borderWidth="1px" borderColor="yellow.400" rounded="xl">
                  <CardBody>
                    <Heading size="sm" mb={2}>
                      Suspended / Leech Cards ({suspendedCards.length})
                    </Heading>
                    <Divider mb={3} />
                    <Stack spacing={2}>
                      {suspendedCards.map((c) => (
                        <HStack
                          key={c.termId}
                          justify="space-between"
                          p={2}
                          rounded="lg"
                          bg={barTrackBg}
                        >
                          <Stack spacing={0} minW={0}>
                            <Text fontSize="sm" fontWeight={600} noOfLines={1}>
                              {c.wordPreview}
                            </Text>
                            <Text fontSize="xs" color={mutedText}>
                              Lapses: {c.lapses} • Interval: {c.interval}d
                            </Text>
                          </Stack>
                          <Button
                            size="xs"
                            colorScheme="orange"
                            isLoading={setSuspendedMutation.isLoading}
                            onClick={() =>
                              setSuspendedMutation.mutate({
                                studySetId,
                                termId: c.termId,
                                suspended: false,
                              })
                            }
                          >
                            Unsuspend
                          </Button>
                        </HStack>
                      ))}
                    </Stack>
                  </CardBody>
                </Card>
              )}
            </Stack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default AnkiStatsModal;
