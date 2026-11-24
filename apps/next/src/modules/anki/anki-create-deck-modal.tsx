import { useRouter } from "next/router";
import React, { useState } from "react";

import { ANKI_DECK_PRESETS, type AnkiPresetDefinition } from "@pno/lib/src/anki/presets";
import { outfit } from "@pno/lib/chakra-theme";
import { api } from "@pno/trpc";

import {
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
  Stack,
  Text,
  Textarea,
  Wrap,
  WrapItem,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import { IconCheck, IconSparkles } from "@tabler/icons-react";

export interface AnkiCreateDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnkiCreateDeckModal: React.FC<AnkiCreateDeckModalProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const toast = useToast();
  const utils = api.useUtils();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<
    "vocab_pro" | "basic" | "cloze"
  >("vocab_pro");

  const cardBg = useColorModeValue("gray.50", "gray.800");
  const selectedBg = useColorModeValue("blue.50", "rgba(49, 130, 206, 0.16)");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const subColor = useColorModeValue("gray.600", "gray.400");

  const createDeckMutation = api.anki.createDeck.useMutation({
    onSuccess: async (created) => {
      await utils.recent.get.invalidate();
      setTitle("");
      setDescription("");
      onClose();
      toast({
        title: "Anki deck created",
        description: "Add your first card or customize the template anytime.",
        status: "success",
        duration: 2500,
      });
      await router.push(`/${created.id}`);
    },
    onError: (err) => {
      toast({
        title: "Could not create deck",
        description: err.message || "Please try again.",
        status: "error",
        duration: 3500,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createDeckMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      presetId: selectedPreset,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={{ base: "full", md: "xl" }}
      scrollBehavior="inside"
      isCentered
    >
      <ModalOverlay />
      <ModalContent>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", maxHeight: "100%" }}
        >
          <ModalHeader
            fontFamily={outfit.style.fontFamily}
            fontWeight={800}
            fontSize="xl"
            pb={2}
          >
            Create Anki Deck (SRS)
          </ModalHeader>
          <ModalCloseButton rounded="full" top={4} right={4} />

          <ModalBody py={4}>
            <Stack spacing={5}>
              <FormControl isRequired>
                <FormLabel fontWeight={700}>Deck Title</FormLabel>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 4000 Essential English Words - Unit 1"
                  autoFocus
                  fontSize="md"
                />
              </FormControl>

              <FormControl>
                <FormLabel fontWeight={700}>Description (optional)</FormLabel>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notes about this Anki deck..."
                  rows={2}
                  fontSize="md"
                />
              </FormControl>

              <Stack spacing={2.5}>
                <HStack spacing={2}>
                  <IconSparkles size={16} />
                  <Text fontSize="sm" fontWeight={700}>
                    Note Type &amp; Card Template
                  </Text>
                </HStack>

                <Stack spacing={3}>
                  {ANKI_DECK_PRESETS.map((preset: AnkiPresetDefinition) => {
                    const active = selectedPreset === preset.id;
                    return (
                      <Box
                        key={preset.id}
                        as="button"
                        type="button"
                        textAlign="left"
                        p={3.5}
                        rounded="xl"
                        borderWidth="2px"
                        borderColor={active ? "blue.400" : borderColor}
                        bg={active ? selectedBg : cardBg}
                        transition="all 150ms ease"
                        onClick={() => setSelectedPreset(preset.id)}
                      >
                        <HStack justify="space-between" align="start" mb={1}>
                          <HStack spacing={2}>
                            <Text
                              fontFamily={outfit.style.fontFamily}
                              fontWeight={700}
                              fontSize="md"
                            >
                              {preset.name}
                            </Text>
                            {preset.id === "vocab_pro" && (
                              <Badge colorScheme="blue" rounded="md" fontSize="2xs">
                                Recommended
                              </Badge>
                            )}
                          </HStack>
                          {active && (
                            <Box color="blue.400">
                              <IconCheck size={18} />
                            </Box>
                          )}
                        </HStack>
                        <Text fontSize="xs" color={subColor} mb={2.5}>
                          {preset.description}
                        </Text>
                        <Wrap spacing={1.5}>
                          {preset.fields.map((field) => (
                            <WrapItem key={field}>
                              <Badge
                                variant="subtle"
                                colorScheme={active ? "blue" : "gray"}
                                fontSize="2xs"
                                px={2}
                                py={0.5}
                                rounded="md"
                                textTransform="none"
                              >
                                {`{{${field}}}`}
                              </Badge>
                            </WrapItem>
                          ))}
                        </Wrap>
                      </Box>
                    );
                  })}
                </Stack>
              </Stack>
            </Stack>
          </ModalBody>

          <ModalFooter gap={3} borderTopWidth="1px" borderColor={borderColor}>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              colorScheme="blue"
              isLoading={createDeckMutation.isLoading}
              isDisabled={!title.trim()}
            >
              Create Deck
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

export default AnkiCreateDeckModal;
