export interface WritingProgress {
  task1Text: string;
  task2Text: string;
  activeTaskNum: 1 | 2;
  notesText: string;
  timeRemaining: number;
  lastSavedAt: number;
}

const writingProgressKey = (examId: string) => `ielts_writing_progress_v1_${examId}`;

export function loadWritingProgress(examId: string): WritingProgress | null {
  try {
    const raw = localStorage.getItem(writingProgressKey(examId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<WritingProgress>;
    if (typeof value.task1Text !== 'string' && typeof value.task2Text !== 'string') return null;
    return {
      task1Text: typeof value.task1Text === 'string' ? value.task1Text : '',
      task2Text: typeof value.task2Text === 'string' ? value.task2Text : '',
      activeTaskNum: value.activeTaskNum === 2 ? 2 : 1,
      notesText: typeof value.notesText === 'string' ? value.notesText : '',
      timeRemaining: typeof value.timeRemaining === 'number' && Number.isFinite(value.timeRemaining) ? Math.max(0, value.timeRemaining) : 3600,
      lastSavedAt: typeof value.lastSavedAt === 'number' ? value.lastSavedAt : Date.now(),
    };
  } catch (error) {
    console.warn('Unable to restore saved writing progress.', error);
    return null;
  }
}

export function saveWritingProgress(examId: string, progress: WritingProgress): void {
  try {
    const payload = {
      ...progress,
      lastSavedAt: Date.now(),
    };
    localStorage.setItem(writingProgressKey(examId), JSON.stringify(payload));
  } catch (error) {
    console.warn('Unable to autosave writing progress.', error);
  }
}

export function clearWritingProgress(examId: string): void {
  try {
    localStorage.removeItem(writingProgressKey(examId));
  } catch (error) {
    console.warn('Unable to clear saved writing progress.', error);
  }
}

export function getSavedWritingSummary(examId: string): {
  task1Words: number;
  task2Words: number;
  timeRemaining: number;
  lastSavedAt: number;
  activeTaskNum: 1 | 2;
} | null {
  const progress = loadWritingProgress(examId);
  if (!progress) return null;

  const countWords = (text: string) => text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const task1Words = countWords(progress.task1Text);
  const task2Words = countWords(progress.task2Text);

  if (task1Words === 0 && task2Words === 0 && !progress.notesText.trim()) {
    return null;
  }

  return {
    task1Words,
    task2Words,
    timeRemaining: progress.timeRemaining,
    lastSavedAt: progress.lastSavedAt || Date.now(),
    activeTaskNum: progress.activeTaskNum || 1,
  };
}

