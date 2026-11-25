import { Container, Stack } from "@chakra-ui/react";

import { EditorGlobalStyles } from "../common/editor-global-styles";
import HydrateSetData from "../modules/hydrate-set-data";
import { useSet } from "../hooks/use-set";
import { AnkiDeckHub } from "../modules/anki/anki-deck-hub";
import { CollabDetails } from "../modules/main/collab-details";
import { DescriptionArea } from "../modules/main/description-area";
import { FlashcardPreview } from "../modules/main/flashcard-preview";
import { HeadingArea } from "../modules/main/heading-area";
import { SetLoading } from "../modules/main/set-loading";
import { TermsOverview } from "../modules/main/terms-overview";
import { TermImageLayer } from "../modules/term-image-layer";
import { PhotoViewProvider } from "./photo-view/provider";
import { WithFooter } from "./with-footer";

interface InternalSetProps {
  collab?: boolean;
}

const InternalSetContent: React.FC<InternalSetProps> = ({ collab }) => {
  const data = useSet();

  const isAnki = Array.isArray(data.tags) && data.tags.includes("anki");
  const isCollab = collab ?? data.type === "Collab";

  if (isAnki) {
    return (
      <WithFooter>
        <AnkiDeckHub data={data} />
      </WithFooter>
    );
  }

  return (
    <WithFooter>
      <Container maxW="7xl">
        <Stack spacing={10}>
          <HeadingArea />
        </Stack>
      </Container>
      <Container maxW="full" overflow="hidden" px="0" py="6">
        <Container maxW="7xl" p="4">
          <Stack spacing={10} w="full">
            <FlashcardPreview />
            {isCollab ? <CollabDetails /> : <DescriptionArea />}
          </Stack>
        </Container>
      </Container>
      <Container maxW="7xl">
        <Stack spacing={10}>
          <TermsOverview />
        </Stack>
      </Container>
    </WithFooter>
  );
};

const InternalSet: React.FC<InternalSetProps> = ({ collab }) => {
  return (
    <PhotoViewProvider>
      <HydrateSetData
        placeholder={<SetLoading collab={collab} />}
        isPublic
        withCollab={collab}
      >
        <EditorGlobalStyles />
        <TermImageLayer />
        <InternalSetContent collab={collab} />
      </HydrateSetData>
    </PhotoViewProvider>
  );
};

export default InternalSet;
