import { useSession } from "next-auth/react";
import React from "react";

import type { SetFolderEntity } from "@quenti/interfaces";
import { api } from "@quenti/trpc";

import {
  Badge,
  Button,
  Grid,
  GridItem,
  HStack,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Skeleton,
  Stack,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { IconBrain, IconCards, IconSearch, IconX } from "@tabler/icons-react";

import { FolderCard } from "../../components/folder-card";
import { GenericCard } from "../../components/generic-card";
import { StudySetCard } from "../../components/study-set-card";

type FilterKind = "all" | "anki" | "quiz" | "folders";

export const SetGrid = () => {
  const { status } = useSession();
  const { data, isLoading: recentLoading } = api.recent.get.useQuery();
  const isLoading = status == "unauthenticated" || recentLoading;
  const secondaryColor = useColorModeValue("gray.600", "gray.400");
  const searchBg = useColorModeValue("white", "gray.800");
  const searchBorder = useColorModeValue("gray.200", "gray.700");

  const [query, setQuery] = React.useState("");
  const [filterKind, setFilterKind] = React.useState<FilterKind>("all");

  if (data && !data.entities.length) return null;

  type EntityWithMeta = SetFolderEntity & {
    tags?: unknown;
    description?: string | null;
  };

  const isAnkiEntity = (item: EntityWithMeta) =>
    (Array.isArray(item.tags) && item.tags.includes("anki")) ||
    (typeof item.tags === "string" && item.tags.includes("anki")) ||
    (item.description?.toLowerCase().includes("anki") ?? false);

  const allEntities = (data?.entities || []) as EntityWithMeta[];
  const qLower = query.trim().toLowerCase();

  const matchesQuery = (item: EntityWithMeta) => {
    if (!qLower) return true;
    const tagStr = Array.isArray(item.tags)
      ? item.tags.join(" ").toLowerCase()
      : typeof item.tags === "string"
        ? item.tags.toLowerCase()
        : "";
    return (
      item.title.toLowerCase().includes(qLower) ||
      (item.description || "").toLowerCase().includes(qLower) ||
      tagStr.includes(qLower)
    );
  };

  const totalAnkiCount = allEntities.filter(
    (item) => item.entityType === "set" && isAnkiEntity(item),
  ).length;
  const totalQuizCount = allEntities.filter(
    (item) => item.entityType === "set" && !isAnkiEntity(item),
  ).length;
  const totalFolderCount = allEntities.filter(
    (item) => item.entityType === "folder",
  ).length;

  const ankiDecks =
    filterKind === "all" || filterKind === "anki"
      ? allEntities.filter(
          (item) =>
            item.entityType === "set" &&
            isAnkiEntity(item) &&
            matchesQuery(item),
        )
      : [];

  const quizEntities =
    filterKind === "all" || filterKind === "quiz" || filterKind === "folders"
      ? allEntities.filter((item) => {
          if (item.entityType === "set" && isAnkiEntity(item)) return false;
          if (filterKind === "quiz" && item.entityType !== "set") return false;
          if (filterKind === "folders" && item.entityType !== "folder")
            return false;
          return matchesQuery(item);
        })
      : [];

  const hasActiveFilter = qLower.length > 0 || filterKind !== "all";
  const hasNoFilteredResults =
    !isLoading &&
    allEntities.length > 0 &&
    ankiDecks.length === 0 &&
    quizEntities.length === 0;

  return (
    <Stack spacing={8}>
      {/* Search & Quick Filter Toolbar */}
      {!isLoading && allEntities.length > 0 && (
        <HStack
          justify="space-between"
          align={{ base: "stretch", md: "center" }}
          flexDir={{ base: "column", md: "row" }}
          spacing={3}
        >
          <InputGroup size="md" maxW={{ base: "full", md: "360px" }}>
            <InputLeftElement pointerEvents="none" color="gray.400">
              <IconSearch size={16} />
            </InputLeftElement>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search study sets, Anki decks, folders..."
              rounded="xl"
              bg={searchBg}
              borderWidth="2px"
              borderColor={searchBorder}
              fontWeight={500}
              _focus={{
                borderColor: "blue.400",
                boxShadow: "none",
              }}
            />
            {query && (
              <InputRightElement>
                <IconButton
                  aria-label="Clear search"
                  icon={<IconX size={14} />}
                  size="xs"
                  variant="ghost"
                  onClick={() => setQuery("")}
                />
              </InputRightElement>
            )}
          </InputGroup>

          <HStack spacing={2} flexWrap="wrap">
            {(
              [
                { id: "all", label: `All (${allEntities.length})` },
                ...(totalAnkiCount > 0
                  ? [{ id: "anki" as const, label: `Anki (${totalAnkiCount})` }]
                  : []),
                { id: "quiz", label: `Quiz Sets (${totalQuizCount})` },
                ...(totalFolderCount > 0
                  ? [
                      {
                        id: "folders" as const,
                        label: `Folders (${totalFolderCount})`,
                      },
                    ]
                  : []),
              ] as const
            ).map((pill) => (
              <Button
                key={pill.id}
                size="sm"
                rounded="xl"
                variant={filterKind === pill.id ? "solid" : "outline"}
                colorScheme={filterKind === pill.id ? "blue" : "gray"}
                fontWeight={700}
                onClick={() => setFilterKind(pill.id)}
              >
                {pill.label}
              </Button>
            ))}
          </HStack>
        </HStack>
      )}

      {hasNoFilteredResults && (
        <Stack
          align="center"
          justify="center"
          py={12}
          px={6}
          rounded="2xl"
          borderWidth="2px"
          borderStyle="dashed"
          borderColor={searchBorder}
          spacing={3}
        >
          <Text fontWeight={700} fontSize="md">
            No matching study sets or folders
          </Text>
          <Text fontSize="sm" color={secondaryColor}>
            Try another keyword or clear your active filter.
          </Text>
          {hasActiveFilter && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setQuery("");
                setFilterKind("all");
              }}
            >
              Clear filter
            </Button>
          )}
        </Stack>
      )}

      {/* Dedicated Anki Decks Section */}
      {ankiDecks.length > 0 && (
        <Stack spacing={4}>
          <HStack justify="space-between" align="center">
            <HStack spacing={2.5}>
              <IconBrain size={24} color="#805ad5" />
              <Heading size="lg">Anki Decks (SRS)</Heading>
              <Badge
                colorScheme="purple"
                fontSize="sm"
                px={2}
                py={0.5}
                rounded="md"
              >
                Spaced Repetition
              </Badge>
            </HStack>
            <Text fontSize="sm" color={secondaryColor}>
              {ankiDecks.length} {ankiDecks.length === 1 ? "deck" : "decks"}
            </Text>
          </HStack>
          <Text fontSize="sm" color={secondaryColor} mt={-2}>
            Dedicated Anki study mode with SM-2 spaced repetition algorithm,
            audio, and images.
          </Text>
          <Grid
            templateColumns="repeat(auto-fill, minmax(256px, 1fr))"
            gap={4}
          >
            {ankiDecks.map((item) => (
              <GridItem key={item.id} h="156px">
                <StudySetCard
                  studySet={{
                    ...item,
                    visibility: item.visibility!,
                    type: item.type!,
                  }}
                  collaborators={item.collaborators}
                  draft={item.draft}
                  numTerms={item.numItems}
                  user={item.user}
                />
              </GridItem>
            ))}
          </Grid>
        </Stack>
      )}

      {/* Standard Quiz Sets & Folders Section */}
      {(quizEntities.length > 0 || (isLoading && ankiDecks.length === 0)) && (
        <Stack spacing={4}>
          <Skeleton isLoaded={!!data} rounded="md" fitContent>
            <HStack spacing={2}>
              <IconCards size={24} />
              <Heading size="lg">Quiz Sets &amp; Folders</Heading>
            </HStack>
          </Skeleton>
          <Grid
            templateColumns="repeat(auto-fill, minmax(256px, 1fr))"
            gap={4}
          >
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <GridItem h="156px" key={i}>
                  <GenericCard.Skeleton />
                </GridItem>
              ))}
            {quizEntities.map((item) => (
              <GridItem key={item.id} h="156px">
                {item.entityType == "set" ? (
                  <StudySetCard
                    studySet={{
                      ...item,
                      visibility: item.visibility!,
                      type: item.type!,
                    }}
                    collaborators={item.collaborators}
                    draft={item.draft}
                    numTerms={item.numItems}
                    user={item.user}
                  />
                ) : (
                  <FolderCard
                    folder={{ ...item }}
                    numSets={item.numItems}
                    user={item.user}
                  />
                )}
              </GridItem>
            ))}
          </Grid>
        </Stack>
      )}
    </Stack>
  );
};
