import React, { useMemo, useRef } from "react";

import { Modal } from "@quenti/components/modal";
import { parseQuizletExportText } from "@quenti/lib/src/quizlet/parser";

import {
  Button,
  ButtonGroup,
  Flex,
  FormControl,
  FormLabel,
  Input,
  Stack,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";

import { plural } from "../utils/string";
import { AutoResizeTextarea } from "./auto-resize-textarea";
import { GenericTermCard } from "./generic-term-card";

export interface ImportTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (terms: { word: string; definition: string }[]) => void;
}

export const ImportTermsModal: React.FC<ImportTermsModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [value, setValue] = React.useState("");

  const [_termDelimiter, setTermDelimiter] = React.useState("\\t");
  const [_cardDelimiter, setCardDelimiter] = React.useState("\\n");
  const td = _termDelimiter.replace(/\\t/g, "\t").replace(/\\n/g, "\n");
  const cd = _cardDelimiter.replace(/\\t/g, "\t").replace(/\\n/g, "\n");

  const grayText = useColorModeValue("gray.600", "gray.400");

  const generatePlaceholder = () => {
    return Array.from({ length: 3 })
      .map((_, i) => `Term ${i + 1}${td}Definition ${i + 1}`)
      .join(cd);
  };

  React.useEffect(() => {
    if (isOpen) return;
    setValue("");
    setTermDelimiter("\\t");
    setCardDelimiter("\\n");
  }, [isOpen]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(text) as
          | { word?: string; term?: string; definition?: string }[]
          | { terms?: { word?: string; term?: string; definition?: string }[] };
        const items = Array.isArray(parsed) ? parsed : parsed.terms || [];
        const formatted = items
          .map((item) => `${item.word || item.term || ""}\t${item.definition || ""}`)
          .filter((l) => l.trim().length > 0)
          .join("\n");
        setTermDelimiter("\\t");
        setCardDelimiter("\\n");
        setValue(formatted);
      } else {
        setValue(text);
      }
    } catch {
      // ignore invalid file
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const parseTerms = (
    value: string,
    td: string,
    cd: string,
  ): { word: string; definition: string }[] => {
    if (!value || !value.trim()) return [];
    const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // When using default Tab/Newline delimiters, leverage smart auto-detect parser
    if (td === "\t" && cd === "\n") {
      const smart = parseQuizletExportText(normalized, {
        termDelimiter: "auto",
        rowDelimiter: "auto",
      });
      if (smart.length > 0) {
        return smart.map(({ word, definition }) => ({ word, definition }));
      }
    }

    if (!cd || !td) return [];
    return normalized
      .split(cd)
      .map((card) => {
        const idx = card.indexOf(td);
        return idx === -1
          ? [card.trim(), ""]
          : [card.slice(0, idx).trim(), card.slice(idx + td.length).trim()];
      })
      .map(([word, definition]) => ({
        word: word || "",
        definition: definition || "",
      }))
      .filter(({ word, definition }) => word || definition);
  };

  const previewTerms = useMemo(
    () => parseTerms(value, td, cd),
    [value, td, cd],
  );

  const textareaBg = useColorModeValue("gray.100", "gray.900");

  return (
    <Modal onClose={onClose} isOpen={isOpen} size="3xl" scrollBehavior="inside">
      <Modal.Overlay />
      <Modal.Content>
        <Modal.Body>
          <Modal.Heading>Import terms</Modal.Heading>
          <Stack spacing={6}>
            <FormControl>
              <Flex justify="space-between" align="center" mb="3" wrap="wrap" gap={2}>
                <FormLabel m="0">
                  Copy and paste your terms and definitions (or upload a file):
                </FormLabel>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv,.tsv,.json"
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                />
                <Button
                  size="xs"
                  variant="outline"
                  colorScheme="blue"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload .txt / .csv / .json
                </Button>
              </Flex>
              <AutoResizeTextarea
                bg={textareaBg}
                placeholder={generatePlaceholder()}
                minHeight="100px"
                rounded="lg"
                allowTab
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </FormControl>
            <Flex gap={4}>
              <Stack w="full">
                <Stack spacing={0}>
                  <Text fontWeight={700}>In between terms</Text>
                  <Text fontSize="sm" color={grayText}>
                    Defaults to tab
                  </Text>
                </Stack>
                <Input
                  variant="flushed"
                  placeholder="Tab"
                  value={_termDelimiter}
                  onChange={(e) => setTermDelimiter(e.target.value)}
                />
              </Stack>
              <Stack w="full">
                <Stack spacing={0}>
                  <Text fontWeight={700}>In between cards</Text>
                  <Text fontSize="sm" color={grayText}>
                    Defaults to newline
                  </Text>
                </Stack>
                <Input
                  variant="flushed"
                  placeholder="Newline"
                  value={_cardDelimiter}
                  onChange={(e) => setCardDelimiter(e.target.value)}
                />
              </Stack>
            </Flex>
            <Text fontWeight={700}>
              Preview{" "}
              {!!previewTerms.length && plural(previewTerms.length, "term")}
            </Text>
            <Stack>
              {previewTerms.map(({ word, definition }, i) => (
                <GenericTermCard
                  key={i}
                  term={{
                    word,
                    definition,
                    wordRichText: null,
                    definitionRichText: null,
                    assetUrl: null,
                    id: "",
                    studySetId: "",
                    rank: i,
                  }}
                  variantBg
                />
              ))}
              {!previewTerms.length && (
                <Text color={grayText}>Nothing to preview</Text>
              )}
            </Stack>
          </Stack>
        </Modal.Body>
        <Modal.Divider />
        <Modal.Footer>
          <ButtonGroup>
            <Button variant="ghost" colorScheme="gray" onClick={onClose}>
              Cancel
            </Button>
            <Button
              isDisabled={!previewTerms.length}
              onClick={() => {
                onImport(previewTerms);
              }}
            >
              Import{" "}
              {!!previewTerms.length && plural(previewTerms.length, "term")}
            </Button>
          </ButtonGroup>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
};
