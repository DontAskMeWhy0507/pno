import type { UserAnswerRecord } from '../types/exam';

export interface ExamProgress {
  answers: UserAnswerRecord;
  flaggedQuestions: number[];
  activePartNumber: number;
  currentQuestionNumber: number;
  timeRemaining: number;
  lastSavedAt?: number;
}

const progressKey = (examId: string) => `ielts_exam_progress_v1_${examId}`;

export function loadExamProgress(examId: string): ExamProgress | null {
  try {
    const raw = localStorage.getItem(progressKey(examId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ExamProgress>;
    if (!value.answers || !Array.isArray(value.flaggedQuestions)) return null;
    return {
      answers: value.answers,
      flaggedQuestions: value.flaggedQuestions,
      activePartNumber: typeof value.activePartNumber === 'number' && Number.isInteger(value.activePartNumber) ? value.activePartNumber : 1,
      currentQuestionNumber: typeof value.currentQuestionNumber === 'number' && Number.isInteger(value.currentQuestionNumber) ? value.currentQuestionNumber : 1,
      timeRemaining: typeof value.timeRemaining === 'number' && Number.isFinite(value.timeRemaining) ? Math.max(0, value.timeRemaining) : 0,
      lastSavedAt: typeof value.lastSavedAt === 'number' ? value.lastSavedAt : undefined,
    };
  } catch (error) {
    console.warn('Unable to restore saved exam progress.', error);
    return null;
  }
}

export function saveExamProgress(examId: string, progress: ExamProgress): void {
  try {
    const payload = {
      ...progress,
      lastSavedAt: Date.now(),
    };
    localStorage.setItem(progressKey(examId), JSON.stringify(payload));
  } catch (error) {
    console.warn('Unable to autosave exam progress.', error);
  }
}

export function clearExamProgress(examId: string): void {
  try {
    localStorage.removeItem(progressKey(examId));
  } catch (error) {
    console.warn('Unable to clear saved exam progress.', error);
  }
}

export function getSavedExamSummary(examId: string): {
  answeredCount: number;
  timeRemaining: number;
  lastSavedAt?: number;
  activePartNumber?: number;
  currentQuestionNumber?: number;
} | null {
  const progress = loadExamProgress(examId);
  if (!progress) return null;
  const answeredCount = Object.values(progress.answers).filter(
    (a) => a !== undefined && a !== '' && (!Array.isArray(a) || a.length > 0)
  ).length;

  return {
    answeredCount,
    timeRemaining: progress.timeRemaining,
    lastSavedAt: progress.lastSavedAt || Date.now(),
    activePartNumber: progress.activePartNumber,
    currentQuestionNumber: progress.currentQuestionNumber,
  };
}


