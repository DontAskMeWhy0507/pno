import React from "react";

import type { FacingTerm, StudiableTerm } from "@quenti/interfaces";

import { RootFlashcardContext } from "../components/root-flashcard-wrapper";
import { queryEventChannel } from "../events/query";
import { useSetFolderUnison } from "../hooks/use-set-folder-unison";
import { useContainerContext } from "../stores/use-container-store";
import {
  SortFlashcardsContext,
  type SortFlashcardsStore,
  createSortFlashcardsStore,
} from "../stores/use-sort-flashcards-store";
import type { FolderData } from "./hydrate-folder-data";
import type { SetData } from "./hydrate-set-data";

export const CreateSortFlashcardsData: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { terms, container } = useSetFolderUnison(true);
  const { termOrder } = React.useContext(RootFlashcardContext);
  const starredTerms = useContainerContext((s) => s.starredTerms);
  const storeRef = React.useRef<SortFlashcardsStore>();

  const termOrderRef = React.useRef(termOrder);
  termOrderRef.current = termOrder;
  const starredTermsRef = React.useRef(starredTerms);
  starredTermsRef.current = starredTerms;

  const initState = (
    round: number,
    studiableTerms: Pick<
      StudiableTerm,
      "id" | "correctness" | "appearedInRound" | "incorrectCount"
    >[],
    terms: FacingTerm[],
    order: string[],
    studyStarred: boolean,
  ) => {
    const termMap = new Map(terms.map((t) => [t.id, t]));
    const studiableMap = new Map(studiableTerms.map((s) => [s.id, s]));

    let flashcardTerms: StudiableTerm[] = order
      .map((id) => termMap.get(id))
      .filter((t): t is FacingTerm => !!t)
      .map((term) => {
        const studiableTerm = studiableMap.get(term.id);
        return {
          ...term,
          correctness: studiableTerm?.correctness ?? 0,
          appearedInRound: studiableTerm?.appearedInRound ?? undefined,
          incorrectCount: studiableTerm?.incorrectCount ?? 0,
        };
      });

    if (studyStarred) {
      flashcardTerms = flashcardTerms.filter((x) =>
        starredTermsRef.current.includes(x.id),
      );
    }

    storeRef.current!.getState().initialize(round, flashcardTerms, terms);
  };

  if (!storeRef.current) {
    storeRef.current = createSortFlashcardsStore();
    initState(
      container.cardsRound,
      container.studiableTerms.filter((x) => x.mode == "Flashcards"),
      terms,
      termOrder,
      container.cardsStudyStarred,
    );
  }

  React.useEffect(() => {
    const trigger = (data: SetData | FolderData) => {
      if (!data.container) return;
      initState(
        data.container.cardsRound,
        data.container.studiableTerms.filter((x) => x.mode == "Flashcards"),
        data.terms,
        termOrderRef.current,
        data.container.cardsStudyStarred,
      );
    };

    queryEventChannel.on("setQueryRefetched", trigger);
    queryEventChannel.on("folderQueryRefetched", trigger);
    return () => {
      queryEventChannel.off("setQueryRefetched", trigger);
      queryEventChannel.off("folderQueryRefetched", trigger);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SortFlashcardsContext.Provider value={storeRef.current}>
      {children}
    </SortFlashcardsContext.Provider>
  );
};
