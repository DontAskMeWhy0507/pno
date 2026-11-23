export interface WritingTask {
  id: string;
  taskNumber: 1 | 2;
  title: string;
  recommendedMinutes: number; // 20 or 40
  minWords: number; // 150 or 250
  prompt: string;
  imageUrl?: string;
  chartType?: 'bar' | 'line' | 'pie' | 'table' | 'map' | 'process' | 'none';
  sampleAnswer?: string; // Band 8.5+ Model Answer
  keyVocabulary?: { word: string; meaning: string; type?: string }[];
  analysisTips?: string[];
}

export interface WritingExam {
  id: string;
  title: string;
  collection?: string;
  durationMinutes: number; // 60
  task1: WritingTask;
  task2: WritingTask;
  createdAt: number;
  updatedAt: number;
}

export interface WritingSubmission {
  examId: string;
  task1Answer: string;
  task2Answer: string;
  task1Words: number;
  task2Words: number;
  timeSpentSeconds: number;
  submittedAt: number;
}

export interface WritingCriteriaScore {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface WritingAiEvaluation {
  overallBand: number;
  task1Evaluation?: {
    taskAchievement: WritingCriteriaScore;
    coherenceCohesion: WritingCriteriaScore;
    lexicalResource: WritingCriteriaScore;
    grammaticalRange: WritingCriteriaScore;
    overallBand: number;
    improvedVersion?: string;
  };
  task2Evaluation?: {
    taskResponse: WritingCriteriaScore;
    coherenceCohesion: WritingCriteriaScore;
    lexicalResource: WritingCriteriaScore;
    grammaticalRange: WritingCriteriaScore;
    overallBand: number;
    improvedVersion?: string;
  };
}
