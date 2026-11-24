import type { JSONContent } from "@tiptap/core";
import React from "react";

import { isRectInBounds } from "@pno/lib/area";

import { type MatchItem, useMatchContext } from "../../stores/use-match-store";

export const EventListener: React.FC<{
  wrapper: React.RefObject<HTMLDivElement>;
}> = ({ wrapper }) => {
  const terms = useMatchContext((s) => s.terms);
  const roundQuestions = useMatchContext((s) => s.roundQuestions);
  const setTerms = useMatchContext((s) => s.setTerms);
  const setCard = useMatchContext((s) => s.setCard);
  const pickNewSpot = useMatchContext((s) => s.pickNewSpot);
  const setZIndex = useMatchContext((s) => s.setZIndex);

  const grossTerms = React.useRef<MatchItem[]>();
  grossTerms.current = terms;

  React.useEffect(() => {
    if (!wrapper.current) return;

    const terms: MatchItem[] = roundQuestions.flatMap((term, i) => {
      const base: Omit<MatchItem, "type" | "word" | "richWord" | "zIndex"> = {
        id: term.id,
        completed: false,
        assetUrl: term.assetUrl,
        width: 200,
        height: 60,
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
      };

      return [
        {
          ...base,
          type: "word",
          word: term.word,
          richWord: term.wordRichText as JSONContent | null,
          zIndex: i * 2 + 1,
        },
        {
          ...base,
          type: "definition",
          word: term.definition,
          richWord: term.definitionRichText as JSONContent | null,
          zIndex: i * 2 + 2,
        },
      ];
    });

    setTerms(terms);
    setZIndex(terms.length);

    const initTimer = window.setTimeout(() => {
      if (!wrapper.current || !grossTerms.current) return;
      terms.forEach((term, index) => {
        const current = grossTerms.current?.[index];
        if (!current || !wrapper.current) return;
        const { width, height } = current;
        const { x, y } = pickNewSpot(
          index,
          { ...term, width, height },
          wrapper.current,
        );

        setCard(index, {
          ...term,
          height,
          width,
          x,
          y,
          targetX: x,
          targetY: y,
        });
      });
    });

    const resizeHandler = () => {
      if (!wrapper.current || !grossTerms.current) return;
      const rect = wrapper.current.getBoundingClientRect();
      grossTerms.current.forEach((term, index) => {
        if (term.completed) return;
        if (!isRectInBounds(term, rect) && wrapper.current) {
          const { x, y } = pickNewSpot(index, term, wrapper.current);

          setCard(index, {
            ...term,
            x,
            y,
            targetX: x,
            targetY: y,
          });
        }
      });
    };

    window.addEventListener("resize", resizeHandler);
    return () => {
      window.clearTimeout(initTimer);
      window.removeEventListener("resize", resizeHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundQuestions]);

  return <></>;
};
