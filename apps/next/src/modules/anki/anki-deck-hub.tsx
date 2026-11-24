import dynamic from "next/dynamic";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";

import { parseAnkiDeckTemplate } from "@quenti/lib/src/anki/presets";
import {
  extractAnkiAudioSources,
  sanitizeAnkiHtml,
} from "@quenti/lib/src/anki/template";
import { outfit } from "@quenti/lib/chakra-theme";
import { api } from "@quenti/trpc";

import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Container,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Textarea,
  Wrap,
  WrapItem,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import {
  IconArrowLeft,
  IconBrain,
  IconCards,
  IconCheck,
  IconClock,
  IconCode,
  IconEdit,
  IconFlame,
  IconPlayerPlay,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";

import { ConfirmModal } from "../../components/confirm-modal";
import { SetData } from "../hydrate-set-data";
import { AnkiAudioPlayer } from "./anki-audio-player";
import type { EditableAnkiCard } from "./anki-card-editor-modal";

const AnkiCardEditorModal = dynamic(
  () => import("./anki-card-editor-modal").then((m) => m.AnkiCardEditorModal),
  { ssr: false },
);
const AnkiTemplateEditorModal = dynamic(
  () =>
    import("./anki-template-editor-modal").then(
      (m) => m.AnkiTemplateEditorModal,
    ),
  { ssr: false },
);

export interface AnkiDeckHubProps {
  data: SetData;
}

export const AnkiDeckHub: React.FC<AnkiDeckHubProps> = ({ data }) => {
  const router = useRouter();
  const toast = useToast();
  const utils = api.useUtils();
  const secondaryColor = useColorModeValue("gray.600", "gray.400");
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  const [searchQuery, setSearchQuery] = useState("");
  const [displayCount, setDisplayCount] = useState(20);

  const [editingCard, setEditingCard] = useState<EditableAnkiCard | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isEditDeckOpen, setIsEditDeckOpen] = useState(false);
  const [deckTitleInput, setDeckTitleInput] = useState(data.title);
  const [deckDescInput, setDeckDescInput] = useState(data.description || "");
  const [deleteDeckModalOpen, setDeleteDeckModalOpen] = useState(false);
  const [deletingTermId, setDeletingTermId] = useState<string | null>(null);

  const { data: session, status } = useSession();
  const isOwner = session?.user?.id === data.userId;

  const deckTemplate = useMemo(
    () =>
      parseAnkiDeckTemplate(
        (data as SetData & { ankiTemplate?: unknown }).ankiTemplate,
      ),
    [data],
  );

  const queueQuery = api.anki.getReviewQueue.useQuery(
    { studySetId: data.id },
    { staleTime: 30000, enabled: status === "authenticated" },
  );

  const updateDeckMutation = api.anki.updateDeck.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.studySets.invalidate(),
        utils.recent.get.invalidate(),
      ]);
      setIsEditDeckOpen(false);
      toast({ title: "Deck details updated", status: "success", duration: 2000 });
    },
    onError: (err) => {
      toast({
        title: "Failed to update deck",
        description: err.message,
        status: "error",
        duration: 3000,
      });
    },
  });

  const deleteDeckMutation = api.studySets.delete.useMutation({
    onSuccess: async () => {
      await utils.recent.get.invalidate();
      await router.push("/home");
    },
  });

  const deleteCardMutation = api.anki.deleteCard.useMutation({
    onSuccess: async () => {
      setDeletingTermId(null);
      await Promise.all([
        utils.studySets.invalidate(),
        utils.anki.getReviewQueue.invalidate({ studySetId: data.id }),
      ]);
      toast({ title: "Card deleted", status: "info", duration: 1800 });
    },
    onError: (err) => {
      toast({
        title: "Failed to delete card",
        description: err.message,
        status: "error",
        duration: 3000,
      });
    },
  });

  const counts = queueQuery.data?.counts || {
    new: data.terms.length,
    learn: 0,
    review: 0,
    totalDue: data.terms.length,
  };

  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return data.terms;
    const query = searchQuery.toLowerCase();
    return data.terms.filter(
      (t) =>
        t.word.toLowerCase().includes(query) ||
        t.definition.toLowerCase().includes(query),
    );
  }, [data.terms, searchQuery]);

  const visibleCards = useMemo(() => {
    return filteredCards.slice(0, displayCount);
  }, [filteredCards, displayCount]);

  return (
    <Container maxW="5xl" px={{ base: 3, sm: 6 }} py={{ base: 4, md: 8 }}>
      <Stack spacing={{ base: 5, md: 8 }}>
        {/* Back navigation */}
        <HStack justify="space-between" align="center" flexWrap="wrap" gap={2}>
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<IconArrowLeft size={16} />}
            onClick={() => router.push("/home")}
          >
            Home
          </Button>
          <Badge colorScheme="purple" fontSize="xs" px={3} py={1} rounded="full">
            <HStack spacing={1}>
              <Icon as={IconBrain} boxSize={3.5} />
              <Text>Anki Spaced Repetition (SRS)</Text>
            </HStack>
          </Badge>
        </HStack>

        {/* Deck Header */}
        <Card
          bg={cardBg}
          borderWidth="2px"
          borderColor={borderColor}
          rounded="2xl"
          p={{ base: 4, md: 6 }}
          shadow="sm"
        >
          <CardBody p={0}>
            <Stack spacing={4}>
              <Stack spacing={1.5}>
                <Heading
                  size={{ base: "lg", md: "xl" }}
                  fontFamily={outfit.style.fontFamily}
                >
                  {data.title}
                </Heading>
                {data.description && (
                  <Text color={secondaryColor} fontSize={{ base: "sm", md: "md" }}>
                    {data.description}
                  </Text>
                )}
              </Stack>

              <Wrap spacing={2.5} align="center">
                <WrapItem>
                  <Button
                    size={{ base: "md", md: "lg" }}
                    colorScheme="orange"
                    leftIcon={<IconPlayerPlay size={18} />}
                    onClick={() => router.push(`/${data.id}/anki`)}
                    fontSize="md"
                    px={{ base: 6, md: 8 }}
                    h={{ base: "44px", md: "52px" }}
                    shadow="md"
                  >
                    Study Now
                  </Button>
                </WrapItem>
                {isOwner && (
                  <>
                    <WrapItem>
                      <Button
                        size={{ base: "sm", md: "md" }}
                        h={{ base: "40px", md: "44px" }}
                        colorScheme="blue"
                        variant="outline"
                        leftIcon={<IconPlus size={16} />}
                        onClick={() => {
                          setEditingCard(null);
                          setIsCardModalOpen(true);
                        }}
                      >
                        Add Card
                      </Button>
                    </WrapItem>
                    <WrapItem>
                      <Button
                        size={{ base: "sm", md: "md" }}
                        h={{ base: "40px", md: "44px" }}
                        variant="outline"
                        leftIcon={<IconCode size={16} />}
                        onClick={() => setIsTemplateModalOpen(true)}
                      >
                        Card Template
                      </Button>
                    </WrapItem>
                    <WrapItem>
                      <Button
                        size={{ base: "sm", md: "md" }}
                        h={{ base: "40px", md: "44px" }}
                        variant="ghost"
                        leftIcon={<IconEdit size={16} />}
                        onClick={() => {
                          setDeckTitleInput(data.title);
                          setDeckDescInput(data.description || "");
                          setIsEditDeckOpen(true);
                        }}
                      >
                        Edit Deck
                      </Button>
                    </WrapItem>
                    <WrapItem>
                      <IconButton
                        aria-label="Delete deck"
                        icon={<IconTrash size={17} />}
                        size="md"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => setDeleteDeckModalOpen(true)}
                      />
                    </WrapItem>
                  </>
                )}
              </Wrap>
            </Stack>
          </CardBody>
        </Card>

        {/* SRS Status Summary Grid (compact 3-column row even on phones) */}
        <SimpleGrid columns={3} gap={{ base: 2, sm: 4 }}>
          <Card
            bg={cardBg}
            borderWidth="1px"
            borderColor={borderColor}
            rounded="xl"
            p={{ base: 2.5, sm: 4 }}
          >
            <HStack spacing={{ base: 2, sm: 3 }} justify={{ base: "center", sm: "flex-start" }}>
              <Box
                display={{ base: "none", sm: "flex" }}
                p={2.5}
                rounded="lg"
                bg="blue.50"
                _dark={{ bg: "blue.900" }}
                color="blue.500"
              >
                <Icon as={IconCards} boxSize={5} />
              </Box>
              <Stack spacing={0} align={{ base: "center", sm: "flex-start" }}>
                <Text
                  fontSize="2xs"
                  fontWeight={700}
                  color={secondaryColor}
                  textTransform="uppercase"
                >
                  New
                </Text>
                <Heading size={{ base: "md", sm: "lg" }} color="blue.500">
                  {queueQuery.isLoading ? <Spinner size="sm" /> : counts.new}
                </Heading>
              </Stack>
            </HStack>
          </Card>

          <Card
            bg={cardBg}
            borderWidth="1px"
            borderColor={borderColor}
            rounded="xl"
            p={{ base: 2.5, sm: 4 }}
          >
            <HStack spacing={{ base: 2, sm: 3 }} justify={{ base: "center", sm: "flex-start" }}>
              <Box
                display={{ base: "none", sm: "flex" }}
                p={2.5}
                rounded="lg"
                bg="red.50"
                _dark={{ bg: "red.900" }}
                color="red.500"
              >
                <Icon as={IconClock} boxSize={5} />
              </Box>
              <Stack spacing={0} align={{ base: "center", sm: "flex-start" }}>
                <Text
                  fontSize="2xs"
                  fontWeight={700}
                  color={secondaryColor}
                  textTransform="uppercase"
                >
                  Learning
                </Text>
                <Heading size={{ base: "md", sm: "lg" }} color="red.500">
                  {queueQuery.isLoading ? <Spinner size="sm" /> : counts.learn}
                </Heading>
              </Stack>
            </HStack>
          </Card>

          <Card
            bg={cardBg}
            borderWidth="1px"
            borderColor={borderColor}
            rounded="xl"
            p={{ base: 2.5, sm: 4 }}
          >
            <HStack spacing={{ base: 2, sm: 3 }} justify={{ base: "center", sm: "flex-start" }}>
              <Box
                display={{ base: "none", sm: "flex" }}
                p={2.5}
                rounded="lg"
                bg="green.50"
                _dark={{ bg: "green.900" }}
                color="green.500"
              >
                <Icon as={IconCheck} boxSize={5} />
              </Box>
              <Stack spacing={0} align={{ base: "center", sm: "flex-start" }}>
                <Text
                  fontSize="2xs"
                  fontWeight={700}
                  color={secondaryColor}
                  textTransform="uppercase"
                >
                  To Review
                </Text>
                <Heading size={{ base: "md", sm: "lg" }} color="green.500">
                  {queueQuery.isLoading ? <Spinner size="sm" /> : counts.review}
                </Heading>
              </Stack>
            </HStack>
          </Card>
        </SimpleGrid>

        {/* Info card */}
        <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} rounded="xl" p={4}>
          <HStack spacing={3}>
            <Icon as={IconFlame} boxSize={5} color="orange.400" flexShrink={0} />
            <Text fontSize="sm" color={secondaryColor}>
              Total cards in deck: <b>{data.terms.length} cards</b>. The SM-2
              spaced repetition algorithm schedules reviews automatically for
              long-term retention.
            </Text>
          </HStack>
        </Card>

        {/* Card Explorer */}
        <Stack spacing={4} pt={2}>
          <HStack justify="space-between" align="center" wrap="wrap" gap={3}>
            <Heading size="md" fontFamily={outfit.style.fontFamily}>
              Cards in Deck ({data.terms.length})
            </Heading>
            <InputGroup maxW={{ base: "full", sm: "320px" }} size="sm">
              <InputLeftElement pointerEvents="none">
                <Icon as={IconSearch} color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search cards..."
                rounded="lg"
                fontSize="sm"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setDisplayCount(20);
                }}
              />
            </InputGroup>
          </HStack>

          {visibleCards.length === 0 && (
            <Card
              bg={cardBg}
              borderWidth="2px"
              borderStyle="dashed"
              borderColor={borderColor}
              rounded="2xl"
              p={8}
              textAlign="center"
            >
              <Stack spacing={3} align="center">
                <Text fontWeight={700}>
                  {searchQuery ? "No matching cards found" : "No cards in this deck yet"}
                </Text>
                {isOwner && !searchQuery && (
                  <Button
                    size="sm"
                    colorScheme="blue"
                    leftIcon={<IconPlus size={15} />}
                    onClick={() => {
                      setEditingCard(null);
                      setIsCardModalOpen(true);
                    }}
                  >
                    Add First Card
                  </Button>
                )}
              </Stack>
            </Card>
          )}

          <Stack spacing={3}>
            {visibleCards.map((term, index) => {
              const safeFront = sanitizeAnkiHtml(term.word).html;
              const safeBack = sanitizeAnkiHtml(term.definition).html;
              const frontAudios = extractAnkiAudioSources(safeFront);
              const backAudios = extractAnkiAudioSources(safeBack);

              return (
                <Card
                  key={term.id}
                  bg={cardBg}
                  borderWidth="1px"
                  borderColor={borderColor}
                  rounded="xl"
                  p={{ base: 3.5, md: 4 }}
                  sx={{
                    overflowWrap: "anywhere",
                    ".anki-cloze": {
                      bg: "orange.100",
                      color: "orange.800",
                      _dark: {
                        bg: "orange.900",
                        color: "orange.200",
                      },
                      fontWeight: "bold",
                      px: 1,
                      rounded: "sm",
                    },
                    ".anki-img, img": {
                      maxH: "140px",
                      objectFit: "contain",
                      my: 1,
                      rounded: "md",
                    },
                  }}
                >
                  <Stack spacing={3}>
                    <HStack justify="space-between" align="center">
                      <Badge colorScheme="purple" rounded="md" fontSize="2xs">
                        Card #{index + 1}
                      </Badge>
                      {isOwner && (
                        <HStack spacing={1}>
                          <IconButton
                            aria-label="Edit card"
                            icon={<IconEdit size={16} />}
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                              setEditingCard({
                                termId: term.id,
                                word: term.word,
                                definition: term.definition,
                                wordRichText: term.wordRichText,
                                assetUrl: term.assetUrl,
                              });
                              setIsCardModalOpen(true);
                            }}
                          />
                          <IconButton
                            aria-label="Delete card"
                            icon={<IconTrash size={16} />}
                            size="xs"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => setDeletingTermId(term.id)}
                          />
                        </HStack>
                      )}
                    </HStack>

                    <HStack
                      justify="space-between"
                      align="flex-start"
                      spacing={4}
                      wrap={{ base: "wrap", md: "nowrap" }}
                    >
                      <Box flex="1" minW={{ base: "100%", md: "45%" }}>
                        <Text
                          fontSize="xs"
                          fontWeight="bold"
                          color="purple.500"
                          mb={1}
                        >
                          Front
                        </Text>
                        <Box
                          fontSize="md"
                          fontWeight={500}
                          dangerouslySetInnerHTML={{ __html: safeFront }}
                        />
                        {frontAudios.length > 0 && (
                          <Wrap spacing={1.5} mt={2}>
                            {frontAudios.map((src, aIdx) => (
                              <WrapItem key={`hub-f-${term.id}-${aIdx}`}>
                                <AnkiAudioPlayer
                                  src={src}
                                  label={
                                    frontAudios.length > 1
                                      ? `Audio ${aIdx + 1}`
                                      : "Audio"
                                  }
                                  compact
                                />
                              </WrapItem>
                            ))}
                          </Wrap>
                        )}
                      </Box>

                      <Box flex="1" minW={{ base: "100%", md: "45%" }}>
                        <Text
                          fontSize="xs"
                          fontWeight="bold"
                          color="blue.500"
                          mb={1}
                        >
                          Back (Answer / Definition)
                        </Text>
                        <Box
                          fontSize="sm"
                          color={secondaryColor}
                          dangerouslySetInnerHTML={{ __html: safeBack }}
                        />
                        {backAudios.length > 0 && (
                          <Wrap spacing={1.5} mt={2}>
                            {backAudios.map((src, aIdx) => (
                              <WrapItem key={`hub-b-${term.id}-${aIdx}`}>
                                <AnkiAudioPlayer
                                  src={src}
                                  label={
                                    backAudios.length > 1
                                      ? `Audio ${aIdx + 1}`
                                      : "Audio"
                                  }
                                  compact
                                />
                              </WrapItem>
                            ))}
                          </Wrap>
                        )}
                      </Box>
                    </HStack>
                  </Stack>
                </Card>
              );
            })}
          </Stack>

          {/* Progressive Load Controls */}
          {displayCount < filteredCards.length && (
            <HStack justify="space-between" pt={2} wrap="wrap" gap={3}>
              <Text fontSize="sm" color={secondaryColor}>
                Showing {visibleCards.length} / {filteredCards.length} cards
              </Text>
              <HStack spacing={2}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDisplayCount((prev) =>
                      Math.min(prev + 20, filteredCards.length),
                    )
                  }
                >
                  Load more (
                  {Math.min(20, filteredCards.length - displayCount)})
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDisplayCount(filteredCards.length)}
                >
                  Show all ({filteredCards.length})
                </Button>
              </HStack>
            </HStack>
          )}
        </Stack>
      </Stack>

      {/* Modals */}
      {isCardModalOpen && (
        <AnkiCardEditorModal
          isOpen={isCardModalOpen}
          onClose={() => {
            setIsCardModalOpen(false);
            setEditingCard(null);
          }}
          studySetId={data.id}
          deckTemplate={deckTemplate}
          card={editingCard}
        />
      )}

      {isTemplateModalOpen && (
        <AnkiTemplateEditorModal
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          studySetId={data.id}
          currentTemplate={deckTemplate}
          sampleCardWordRichText={data.terms[0]?.wordRichText}
        />
      )}

      {/* Edit Deck Title & Description Modal */}
      <Modal
        isOpen={isEditDeckOpen}
        onClose={() => setIsEditDeckOpen(false)}
        isCentered
        size={{ base: "full", md: "md" }}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontFamily={outfit.style.fontFamily} fontWeight={800}>
            Edit Anki Deck
          </ModalHeader>
          <ModalCloseButton rounded="full" top={4} right={4} />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel fontWeight={700}>Deck Title</FormLabel>
                <Input
                  value={deckTitleInput}
                  onChange={(e) => setDeckTitleInput(e.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight={700}>Description</FormLabel>
                <Textarea
                  value={deckDescInput}
                  onChange={(e) => setDeckDescInput(e.target.value)}
                  rows={3}
                />
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={() => setIsEditDeckOpen(false)}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              isLoading={updateDeckMutation.isLoading}
              isDisabled={!deckTitleInput.trim()}
              onClick={() =>
                updateDeckMutation.mutate({
                  studySetId: data.id,
                  title: deckTitleInput.trim(),
                  description: deckDescInput.trim(),
                })
              }
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmModal
        isOpen={deleteDeckModalOpen}
        onClose={() => setDeleteDeckModalOpen(false)}
        heading="Delete this Anki deck?"
        body={
          <Text>
            All cards and spaced-repetition progress for this deck will be
            permanently removed.
          </Text>
        }
        actionText="Delete Deck"
        isLoading={deleteDeckMutation.isLoading}
        onConfirm={() => deleteDeckMutation.mutate({ studySetId: data.id })}
        destructive
      />

      <ConfirmModal
        isOpen={Boolean(deletingTermId)}
        onClose={() => setDeletingTermId(null)}
        heading="Delete this card?"
        body={<Text>This card and its SRS schedule will be removed.</Text>}
        actionText="Delete Card"
        isLoading={deleteCardMutation.isLoading}
        onConfirm={() => {
          if (deletingTermId) {
            deleteCardMutation.mutate({
              studySetId: data.id,
              termId: deletingTermId,
            });
          }
        }}
        destructive
      />
    </Container>
  );
};

export default AnkiDeckHub;
