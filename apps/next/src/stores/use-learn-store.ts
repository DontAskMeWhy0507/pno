import React from "react";
import { createStore, useStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import type {
  Question,
  RoundSummary,
  StudiableTermWithDistractors,
  TermWithDistractors,
} from "@pno/interfaces";
import { shuffleArray } from "@pno/lib/array";
import { SPECIAL_CHAR_REGEXP } from "@pno/lib/constants/characters";
import { LEARN_TERMS_IN_ROUND } from "@pno/lib/constants/learn";
import { CORRECT, INCORRECT } from "@pno/lib/constants/remarks";
import type { LearnMode, StudySetAnswerMode } from "@pno/prisma/client";

import { word } from "../utils/terms";

export interface LearnStoreProps {
  mode: LearnMode;
  answerMode: StudySetAnswerMode;
  studiableTerms: StudiableTermWithDistractors[];
  allTerms: TermWithDistractors[];
  numTerms: number;
  termsThisRound: number;
  currentRound: number;
  roundProgress: number;
  roundCounter: number;
  roundTimeline: Question[];
  specialCharacters: string[];
  feedbackBank: { correct: string[]; incorrect: string[] };
  answered?: string;
  status?: "correct" | "incorrect" | "unknownPartial";
  roundSummary?: RoundSummary;
  completed: boolean;
  hasMissedTerms?: boolean;
  prevTermWasIncorrect?: boolean;
}

interface LearnState extends LearnStoreProps {
  initialize: (
    mode: LearnMode,
    answerMode: StudySetAnswerMode,
    studiableTerms: StudiableTermWithDistractors[],
    allTerms: TermWithDistractors[],
    round: number,
  ) => void;
  answerCorrectly: (termId: string) => void;
  answerIncorrectly: (termId: string) => void;
  acknowledgeIncorrect: () => void;
  answerUnknownPartial: () => void;
  overrideCorrect: () => void;
  endQuestionCallback: (correct: boolean) => void;
  correctFromUnknown: (termId: string) => void;
  incorrectFromUnknown: (termId: string) => void;
  nextRound: (start?: boolean) => void;
  setFeedbackBank: (correct: string[], incorrect: string[]) => void;
}

export type LearnStore = ReturnType<typeof createLearnStore>;

export const createLearnStore = (initProps?: Partial<LearnStoreProps>) => {
  const DEFAULT_PROPS: LearnStoreProps = {
    mode: "Learn",
    answerMode: "Definition",
    studiableTerms: [],
    allTerms: [],
    numTerms: 0,
    termsThisRound: 0,
    currentRound: 0,
    roundProgress: 0,
    roundCounter: 0,
    roundTimeline: [],
    specialCharacters: [],
    feedbackBank: { correct: CORRECT, incorrect: INCORRECT },
    completed: false,
  };

  let answerTimer: ReturnType<typeof setTimeout> | null = null;

  return createStore<LearnState>()(
    subscribeWithSelector((set, get) => ({
      ...DEFAULT_PROPS,
      ...initProps,
      initialize: (mode, answerMode, studiableTerms, allTerms, round) => {
        if (answerTimer) {
          clearTimeout(answerTimer);
          answerTimer = null;
        }
        const words =
          answerMode != "Both"
            ? studiableTerms.map((x) => word(answerMode, x, "answer"))
            : studiableTerms.map((x) => [x.word, x.definition]).flat();

        const specialCharacters = Array.from(
          new Set(
            words
              .map((word) =>
                [...word.matchAll(SPECIAL_CHAR_REGEXP)]
                  .map((x) => Array.from(x))
                  .flat(),
              )
              .flat()
              .map((x) => x.split(""))
              .flat(),
          ),
        );

        set({
          mode,
          answerMode,
          studiableTerms,
          allTerms,
          numTerms: studiableTerms.length,
          currentRound: round,
          specialCharacters,
        });

        set((state) => {
          state.nextRound(true);
          return {};
        });
      },
      answerCorrectly: (termId) => {
        if (get().answered) return;
        set({
          answered: termId,
          status: "correct",
          prevTermWasIncorrect: false,
        });

        if (answerTimer) clearTimeout(answerTimer);
        answerTimer = setTimeout(() => {
          answerTimer = null;
          set((state) => {
            const active = state.roundTimeline[state.roundCounter];
            if (!active) return {};
            active.term.correctness = active.type == "choice" ? 1 : 2;

            state.endQuestionCallback(true);
            return {};
          });
        }, 1000);
      },
      answerIncorrectly: (termId) => {
        if (get().answered) return;
        set((state) => ({
          answered: termId,
          status: "incorrect",
          roundTimeline: state.roundTimeline[state.roundCounter]
            ? [...state.roundTimeline, state.roundTimeline[state.roundCounter]!]
            : state.roundTimeline,
          prevTermWasIncorrect: true,
        }));
      },
      acknowledgeIncorrect: () => {
        set((state) => {
          const active = state.roundTimeline[state.roundCounter];
          if (!active) return {};
          active.term.correctness = -1;
          active.term.incorrectCount++;

          state.endQuestionCallback(false);
          return {};
        });
      },
      answerUnknownPartial: () => {
        set({ status: "unknownPartial" });
      },
      overrideCorrect: () => {
        set((state) => {
          const active = state.roundTimeline[state.roundCounter];
          if (!active) return {};
          active.term.correctness = 2;

          const roundTimeline = [...state.roundTimeline];
          if (roundTimeline.length > state.roundCounter + 1) {
            // Remove the added question from the timeline
            roundTimeline.pop();
          }

          state.endQuestionCallback(true);
          return {
            roundTimeline,
            prevTermWasIncorrect: false,
          };
        });
      },
      endQuestionCallback: (correct) => {
        set((state) => {
          const masteredCount = state.studiableTerms.filter(
            (x) => x.correctness == 2,
          ).length;
          if (masteredCount == state.numTerms) {
            const hasMissedTerms = !!state.studiableTerms.find(
              (x) => x.incorrectCount > 0,
            );
            return {
              completed: true,
              hasMissedTerms,
              status: undefined,
              answered: undefined,
            };
          }

          if (correct && state.roundProgress === state.termsThisRound - 1) {
            return {
              roundSummary: {
                round: state.currentRound,
                termsThisRound: Array.from(
                  new Set(state.roundTimeline.map((q) => q.term)),
                ),
                progress: state.studiableTerms.filter((x) => x.correctness > 0)
                  .length,
                totalTerms: state.numTerms,
              },
              status: undefined,
              answered: undefined,
            };
          }

          const roundCounter = state.roundCounter + 1;
          const roundProgress = state.roundProgress + (correct ? 1 : 0);

          return {
            roundCounter,
            roundProgress,
            answered: undefined,
            status: undefined,
          };
        });
      },
      correctFromUnknown: (termId) => {
        set({
          answered: termId,
          prevTermWasIncorrect: false,
        });

        set((state) => {
          const active = state.roundTimeline[state.roundCounter]!;
          active.term.correctness = active.type == "choice" ? 1 : 2;

          state.endQuestionCallback(true);
          return {};
        });
      },
      incorrectFromUnknown: (termId) => {
        set((state) => ({
          answered: termId,
          roundTimeline: state.roundTimeline[state.roundCounter]
            ? [...state.roundTimeline, state.roundTimeline[state.roundCounter]!]
            : state.roundTimeline,
          prevTermWasIncorrect: true,
        }));

        set((state) => {
          const active = state.roundTimeline[state.roundCounter];
          if (!active) return {};
          active.term.correctness = -1;
          active.term.incorrectCount++;

          state.endQuestionCallback(false);
          return {};
        });
      },
      nextRound: (start = false) => {
        if (answerTimer) {
          clearTimeout(answerTimer);
          answerTimer = null;
        }
        set((state) => {
          const currentRound = state.currentRound + (!start ? 1 : 0);

          const incorrectTerms = state.studiableTerms.filter(
            (x) => x.correctness == -1,
          );
          const unstudied = state.studiableTerms.filter(
            (x) => x.correctness == 0,
          );

          const familiarTerms = state.studiableTerms.filter(
            (x) => x.correctness == 1,
          );
          const eligibleFamiliar = familiarTerms.filter(
            (x) => currentRound - (x.appearedInRound ?? 0) >= 2,
          );
          const remainingFamiliar = familiarTerms.filter(
            (x) => currentRound - (x.appearedInRound ?? 0) < 2,
          );

          const termsThisRound = [
            ...incorrectTerms,
            ...eligibleFamiliar,
            ...unstudied,
            ...remainingFamiliar,
          ].slice(0, LEARN_TERMS_IN_ROUND);

          // For each term that hasn't been seen (correctness == 0), set the round it appeared in as the current round
          termsThisRound.forEach((x) => {
            if (x.correctness == 0) x.appearedInRound = currentRound;
          });

          const normText = (mode: StudySetAnswerMode, t: TermWithDistractors) =>
            word(mode, t, "answer").trim().toLowerCase();

          const roundTimeline: Question[] = termsThisRound.map((term) => {
            const choice = term.correctness < 1;
            const answerMode: StudySetAnswerMode =
              state.answerMode != "Both"
                ? state.answerMode
                : Math.random() < 0.5
                  ? "Definition"
                  : "Word";

            if (choice) {
              const seenIds = new Set<string>([term.id]);
              const seenTexts = new Set<string>([normText(answerMode, term)]);
              const distractors: TermWithDistractors[] = [];

              const storedIds = term.distractors
                .filter((x) => x.type == answerMode)
                .map((x) => x.distractingId);

              for (const candidate of state.allTerms) {
                if (distractors.length >= 3) break;
                if (!storedIds.includes(candidate.id)) continue;
                const text = normText(answerMode, candidate);
                if (seenIds.has(candidate.id) || !text || seenTexts.has(text))
                  continue;
                seenIds.add(candidate.id);
                seenTexts.add(text);
                distractors.push(candidate);
              }

              if (distractors.length < 3) {
                for (const candidate of shuffleArray([...state.allTerms])) {
                  if (distractors.length >= 3) break;
                  const text = normText(answerMode, candidate);
                  if (seenIds.has(candidate.id) || !text || seenTexts.has(text))
                    continue;
                  seenIds.add(candidate.id);
                  seenTexts.add(text);
                  distractors.push(candidate);
                }
              }

              if (distractors.length < 3) {
                for (const candidate of shuffleArray([...state.allTerms])) {
                  if (distractors.length >= 3) break;
                  if (seenIds.has(candidate.id)) continue;
                  const text = normText(answerMode, candidate);
                  if (!text) continue;
                  seenIds.add(candidate.id);
                  distractors.push(candidate);
                }
              }

              const choices = shuffleArray([...distractors, term]);

              return {
                answerMode,
                choices,
                term,
                type: "choice",
              };
            } else {
              return {
                answerMode,
                choices: [],
                term,
                type: "write",
              };
            }
          });

          const hasMissedTerms = !!state.studiableTerms.find(
            (x) => x.incorrectCount > 0,
          );

          return {
            roundSummary: undefined,
            termsThisRound: termsThisRound.length,
            roundTimeline,
            roundCounter: 0,
            roundProgress: 0,
            answered: undefined,
            status: undefined,
            completed: !termsThisRound.length,
            hasMissedTerms,
            currentRound,
          };
        });
      },
      setFeedbackBank: (correct, incorrect) => {
        set({
          feedbackBank: { correct, incorrect },
        });
      },
    })),
  );
};

export const LearnContext = React.createContext<LearnStore | null>(null);

export const useLearnContext = <T>(selector: (state: LearnState) => T): T => {
  const store = React.useContext(LearnContext);
  if (!store) throw new Error("Missing LearnContext.Provider in the tree");

  return useStore(store, selector);
};
