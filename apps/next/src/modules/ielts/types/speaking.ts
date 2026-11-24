export interface SpeakingQuestion {
  id: string;
  part: 1 | 2 | 3;
  topic: string;
  questionText: string;
  cueCardBullets?: string[]; // For Part 2
  prepTimeSeconds?: number; // 60s for Part 2
  speakTimeSeconds?: number; // 120s for Part 2
  sampleAnswer: string; // Band 8.0+ Model Answer
  audioSampleUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  keyVocabulary?: { word: string; meaning: string; phonetic?: string }[];
  tips?: string[];
}

export interface SpeakingExam {
  id: string;
  title: string;
  collection?: string;
  description?: string;
  part1Questions: SpeakingQuestion[];
  part2Question: SpeakingQuestion;
  part3Questions: SpeakingQuestion[];
  createdAt: number;
  updatedAt: number;
}

export interface SpeakingRecordItem {
  questionId: string;
  part: 1 | 2 | 3;
  audioBlobUrl?: string;
  audioDurationSeconds: number;
  transcript: string;
  recordedAt: number;
}
