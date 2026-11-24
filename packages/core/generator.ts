import type { FacingTerm } from "@pno/interfaces";
import {
  type MatchData,
  type MultipleChoiceData,
  type TermWithDistractors,
  type TestQuestion,
  TestQuestionType,
  type TrueFalseData,
} from "@pno/interfaces";
import { getRandom, shuffleArray } from "@pno/lib/array";
import type { StudySetAnswerMode } from "@pno/prisma/client";

export const getAnswerMode = (
  answerMode: StudySetAnswerMode,
): StudySetAnswerMode => {
  if (answerMode == "Both") return Math.random() > 0.5 ? "Word" : "Definition";
  return answerMode;
};

const getAnswerText = (mode: StudySetAnswerMode, term: FacingTerm) =>
  (mode === "Definition" ? term.definition : term.word).trim().toLowerCase();

export const generateTrueFalseQuestion = (
  term: TermWithDistractors,
  answerMode: StudySetAnswerMode,
  allTerms: FacingTerm[],
): TestQuestion<TrueFalseData> => {
  const mode = getAnswerMode(answerMode);
  const evaluation = Math.random() > 0.5;
  const targetText = getAnswerText(mode, term);

  let distractorTerm: FacingTerm | undefined;
  if (!evaluation) {
    const storedCandidates = term.distractors
      .filter((d) => d.type == mode)
      .map((d) => allTerms.find((t) => t.id == d.distractingId))
      .filter(
        (t): t is FacingTerm =>
          !!t &&
          t.id !== term.id &&
          getAnswerText(mode, t).length > 0 &&
          getAnswerText(mode, t) !== targetText,
      );

    distractorTerm = getRandom(storedCandidates);

    if (!distractorTerm) {
      const fallbackCandidates = allTerms.filter(
        (t) =>
          t.id !== term.id &&
          getAnswerText(mode, t).length > 0 &&
          getAnswerText(mode, t) !== targetText,
      );
      distractorTerm = getRandom(fallbackCandidates);
    }
  }

  return {
    type: TestQuestionType.TrueFalse,
    answerMode: mode,
    data: {
      term,
      distractor: distractorTerm,
    },
    answered: false,
  };
};

export const generateMcqQuestion = (
  term: TermWithDistractors,
  answerMode: StudySetAnswerMode,
  alTerms: FacingTerm[],
): TestQuestion<MultipleChoiceData> => {
  const mode = getAnswerMode(answerMode);
  const seenIds = new Set<string>([term.id]);
  const seenTexts = new Set<string>([getAnswerText(mode, term)]);
  const distractorTerms: FacingTerm[] = [];

  const storedDistractors = shuffleArray(
    term.distractors.filter((d) => d.type == mode),
  );
  for (const d of storedDistractors) {
    if (distractorTerms.length >= 3) break;
    const found = alTerms.find((t) => t.id == d.distractingId);
    if (!found) continue;
    const text = getAnswerText(mode, found);
    if (seenIds.has(found.id) || !text || seenTexts.has(text)) continue;
    seenIds.add(found.id);
    seenTexts.add(text);
    distractorTerms.push(found);
  }

  if (distractorTerms.length < 3) {
    for (const candidate of shuffleArray([...alTerms])) {
      if (distractorTerms.length >= 3) break;
      const text = getAnswerText(mode, candidate);
      if (seenIds.has(candidate.id) || !text || seenTexts.has(text)) continue;
      seenIds.add(candidate.id);
      seenTexts.add(text);
      distractorTerms.push(candidate);
    }
  }

  if (distractorTerms.length < 3) {
    for (const candidate of shuffleArray([...alTerms])) {
      if (distractorTerms.length >= 3) break;
      if (seenIds.has(candidate.id)) continue;
      const text = getAnswerText(mode, candidate);
      if (!text) continue;
      seenIds.add(candidate.id);
      distractorTerms.push(candidate);
    }
  }

  const choices = shuffleArray([term, ...distractorTerms]);

  return {
    type: TestQuestionType.MultipleChoice,
    answerMode: mode,
    data: {
      term,
      choices,
    },
    answered: false,
  };
};

export const generateMatchQuestion = (
  terms: FacingTerm[],
  answerMode: StudySetAnswerMode,
): TestQuestion<MatchData> => {
  return {
    type: TestQuestionType.Match,
    answerMode: getAnswerMode(answerMode),
    data: {
      terms: shuffleArray(Array.from(terms)),
      zones: terms,
      answer: [],
    },
    answered: false,
  };
};

export const generateWriteQuestion = (
  term: FacingTerm,
  answerMode: StudySetAnswerMode,
): TestQuestion => {
  return {
    type: TestQuestionType.Write,
    answerMode: getAnswerMode(answerMode),
    data: { term, answer: "" },
    answered: false,
  };
};
