import { EditorContent, useEditor } from "@tiptap/react";
import React from "react";

import { Modal } from "@pno/components/modal";
import type { FacingTerm } from "@pno/interfaces";
import {
  type EditorTerm,
  editorInput,
  getPlainText,
  hasRichText,
  richTextToHtml,
} from "@pno/lib/editor";
import { api } from "@pno/trpc";

import { Box, Button, ButtonGroup, Stack } from "@chakra-ui/react";

import { resize } from "../common/cdn-loaders";
import { editorEventChannel } from "../events/editor";
import { useSetFolderUnison } from "../hooks/use-set-folder-unison";
import { broadcastSync } from "../lib/sync-bus";
import {
  AddImageButton,
  RemoveImageButton,
} from "../modules/editor/card/image-components";
import { RichTextBar } from "../modules/editor/card/rich-text-bar";
import { editorConfig } from "../modules/editor/editor-config";
import { PhotoView } from "./photo-view/photo-view";

export interface EditTermModalProps {
  term: FacingTerm | null;
  isOpen: boolean;
  onClose: () => void;
  onDefinition: boolean;
}

export const EditTermModal: React.FC<EditTermModalProps> = ({
  term,
  isOpen,
  onClose,
  onDefinition,
}) => {
  const utils = api.useUtils();
  const { entityType } = useSetFolderUnison();

  const [termAssetUrl, setTermAssetUrl] = React.useState<string | null>(null);
  const [cachedAssetUrl, setCachedAssetUrl] = React.useState<string | null>(
    null,
  );

  const wordEditor = useEditor({
    ...editorConfig(),
    content: term ? editorInput(term as EditorTerm, "word") : "",
  });
  const definitionEditor = useEditor({
    ...editorConfig(),
    content: term ? editorInput(term as EditorTerm, "definition") : "",
  });

  React.useEffect(() => {
    if (!term || !isOpen) return;

    wordEditor?.commands.setContent(editorInput(term as EditorTerm, "word"));
    definitionEditor?.commands.setContent(
      editorInput(term as EditorTerm, "definition"),
    );
    setTermAssetUrl(term.assetUrl);
    setCachedAssetUrl(term.assetUrl);

    if (onDefinition) {
      definitionEditor?.commands.focus();
    } else {
      wordEditor?.commands.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, isOpen]);

  React.useEffect(() => {
    const handle = (args: { id: string; url: string }) => {
      if (isOpen && args.id == term?.id) {
        setTermAssetUrl(args.url);
        setCachedAssetUrl(args.url);
      }
    };

    editorEventChannel.on("propagateImageUrl", handle);
    return () => {
      editorEventChannel.off("propagateImageUrl", handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const edit = api.terms.edit.useMutation({
    onMutate: async (vars) => {
      onClose();
      if (entityType !== "set") return {};

      const keys = [
        { studySetId: vars.studySetId, withDistractors: false, withCollab: false },
        { studySetId: vars.studySetId, withDistractors: false, withCollab: true },
      ];
      await Promise.all(keys.map((k) => utils.studySets.byId.cancel(k)));

      const snapshots = keys.map((k) => ({
        key: k,
        data: utils.studySets.byId.getData(k),
      }));

      const nextWordRichText = vars.wordRichText
        ? (wordEditor?.getJSON() ?? null)
        : null;
      const nextDefinitionRichText = vars.definitionRichText
        ? (definitionEditor?.getJSON() ?? null)
        : null;

      for (const snap of snapshots) {
        if (!snap.data) continue;
        utils.studySets.byId.setData(snap.key, {
          ...snap.data,
          terms: snap.data.terms.map((t) =>
            t.id === vars.id
              ? {
                  ...t,
                  word: vars.word,
                  definition: vars.definition,
                  wordRichText: nextWordRichText as typeof t.wordRichText,
                  definitionRichText:
                    nextDefinitionRichText as typeof t.definitionRichText,
                }
              : t,
          ),
        });
      }

      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshots) {
        for (const snap of ctx.snapshots) {
          if (snap.data) {
            utils.studySets.byId.setData(snap.key, snap.data);
          }
        }
      }
    },
    async onSuccess(_data, vars) {
      broadcastSync("quiz", vars.studySetId);
      if (entityType == "set") {
        await utils.studySets.invalidate();
      } else {
        await utils.folders.invalidate();
      }
    },
  });

  const removeImage = api.terms.removeImage.useMutation();

  return (
    <Modal onClose={onClose} isOpen={isOpen}>
      <Modal.Overlay />
      <Modal.Content>
        <Modal.Body>
          <Modal.Heading>Edit term</Modal.Heading>
          <Stack w="full">
            <RichTextBar
              activeEditor={wordEditor}
              bg="gray.100"
              _dark={{
                bg: "gray.900",
              }}
            />
            <EditorContent
              editor={wordEditor}
              onKeyDown={(e) => {
                if ([" ", "ArrowRight", "ArrowLeft"].includes(e.key))
                  e.stopPropagation();
              }}
            />
          </Stack>
          <Stack w="full">
            <RichTextBar
              activeEditor={definitionEditor}
              bg="gray.100"
              _dark={{
                bg: "gray.900",
              }}
            />
            <EditorContent
              editor={definitionEditor}
              onKeyDown={(e) => {
                if ([" ", "ArrowRight", "ArrowLeft"].includes(e.key))
                  e.stopPropagation();
              }}
            />
          </Stack>
          {cachedAssetUrl ? (
            <Box w="100px" h="80px" mt={{ base: 3, md: 0 }} position="relative">
              <PhotoView src={resize({ src: cachedAssetUrl, width: 500 })}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  width={100}
                  height={80}
                  alt="Term asset"
                  src={resize({ src: cachedAssetUrl, width: 500 })}
                  style={{
                    cursor: "zoom-in",
                    width: 100,
                    height: 80,
                    objectFit: "cover",
                    aspectRatio: "5 / 4",
                    borderRadius: "6px",
                  }}
                />
              </PhotoView>
              <RemoveImageButton
                onClick={() => {
                  if (!term) return;
                  setCachedAssetUrl(null);
                }}
              />
            </Box>
          ) : (
            <AddImageButton
              w="100px"
              h="80px"
              onClick={() => {
                if (!term) return;
                editorEventChannel.emit("openSearchImages", {
                  termId: term.id,
                  studySetId: term.studySetId,
                });
              }}
            />
          )}
        </Modal.Body>
        <Modal.Divider />
        <Modal.Footer>
          <ButtonGroup>
            <Button variant="ghost" colorScheme="gray" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!term) return;

                const wordJson = wordEditor!.getJSON();
                const definitionJson = definitionEditor!.getJSON();
                const word = getPlainText(wordJson);
                const definition = getPlainText(definitionJson);

                const wordRichText = hasRichText(wordJson, word);
                const definitionRichText = hasRichText(
                  definitionJson,
                  definition,
                );

                if (!cachedAssetUrl && termAssetUrl) {
                  await removeImage.mutateAsync({
                    id: term.id,
                    studySetId: term.studySetId,
                  });
                }

                edit.mutate({
                  ...term,
                  word,
                  definition,
                  wordRichText: wordRichText
                    ? richTextToHtml(wordJson)
                    : undefined,
                  definitionRichText: definitionRichText
                    ? richTextToHtml(definitionJson)
                    : undefined,
                });
              }}
              isLoading={edit.isLoading || removeImage.isLoading}
            >
              Save
            </Button>
          </ButtonGroup>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
};
