export type QuestionType =
  | 'TRUE_FALSE_NOT_GIVEN'
  | 'YES_NO_NOT_GIVEN'
  | 'MULTIPLE_CHOICE_SINGLE'
  | 'MULTIPLE_CHOICE_MULTI'
  | 'FILL_IN_BLANK'
  | 'MATCHING';

export interface QuestionOption {
  id: string; // e.g. "A", "B", "C", "D"
  text: string;
}

export interface Question {
  id: string;
  orderNumber: number; // 1 to 40
  type: QuestionType;
  prompt: string; // e.g. "All of the baobab species found on Madagascar are unique to the island."
  options?: QuestionOption[];
  maxSelect?: number;
  correctAnswer: string | string[]; // e.g. "FALSE" or "seeds" or ["B", "D"]
  acceptableAnswers?: string[]; // Alternative variations e.g. ["fruit", "fruits"]
  explanation?: string; // Detailed reference / explanation
}

export interface QuestionGroup {
  id: string;
  title: string; // e.g. "Questions 1-6"
  instructions: string; // e.g. "Do the following statements agree with the information given in the text? Choose TRUE if... FALSE if... NOT GIVEN if..."
  summaryTitle?: string; // e.g. "Early European reaction to the discovery of Easter Island"
  sharedContent?: string; // Optional context: text with blanks e.g. {{7}}, {{8}} or summary/table
  wordBank?: QuestionOption[]; // e.g. [{ id: "A", text: "poverty" }, ...]
  questions: Question[];
}

export interface Part {
  id: string;
  partNumber: number; // 1, 2, 3 (Reading) or 1–4 (Listening)
  title: string; // e.g. "The Baobabs of Madagascar" or "Section 1"
  subtitle?: string;
  passage: string; // Passage text (Reading) or transcript/context (Listening)
  footnotes?: string;
  audioUrl?: string; // Optional audio URL for Listening sections (MP3/YouTube)
  questionGroups: QuestionGroup[];
}

export interface TestCollection {
  id: string;
  name: string; // e.g. "Vol 10", "Vol 1", "Cambridge 18", "Bộ đề cá nhân"
  description?: string;
  createdAt?: number;
  isBuiltin?: boolean;
}

export interface Exam {
  id: string;
  title: string; // e.g. "VOL 9 TEST 1 READING"
  description?: string;
  durationMinutes: number; // default 60
  category?: string;
  collection?: string; // e.g. "Vol 9", "Vol 10", "Cambridge 18", "Bộ đề của tôi"
  parts: Part[];
  createdAt: number;
  updatedAt: number;
  isBuiltin?: boolean;
}

export interface UserAnswerRecord {
  [questionNumber: number]: string | string[];
}

export interface ScoreReport {
  totalCorrect: number;
  totalQuestions: number;
  bandScore: number;
  partScores: {
    [partNumber: number]: {
      correct: number;
      total: number;
    };
  };
  details: {
    questionNumber: number;
    userAnswer: string | string[];
    correctAnswer: string | string[];
    isCorrect: boolean;
    explanation?: string;
  }[];
}
