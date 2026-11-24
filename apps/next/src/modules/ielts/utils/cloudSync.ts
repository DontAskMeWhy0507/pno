import type { Exam } from '../types/exam';
import type { SpeakingExam } from '../types/speaking';
import type { WritingExam } from '../types/writing';
import {
  getCustomCollections,
  getCustomExams,
  getDeletedCollections,
  getDeletedExamIds,
  isListeningExam,
  replaceLocalExamsAndCollections,
} from './storage';

export type CloudIeltsSkill = 'Reading' | 'Listening' | 'Writing' | 'Speaking';

export interface CloudCustomExamRow {
  examId: string;
  skill: CloudIeltsSkill;
  title: string;
  collection: string;
  data: unknown;
  deleted: boolean;
}

export interface CloudCollectionRow {
  id: string;
  name: string;
  description: string | null;
  deleted: boolean;
}

export interface CloudProgressRow {
  examId: string;
  skill: CloudIeltsSkill;
  state: unknown;
}

export interface CloudAttemptDetails {
  mode?: 'full' | 'practice';
  selectedParts?: number[];
  timeLimitMinutes?: number | null;
  answers?: Record<string, string | string[]>;
  partScores?: Record<string, { correct: number; total: number }>;
  task1Words?: number;
  task2Words?: number;
  task1Text?: string;
  task2Text?: string;
}

export interface CloudAttemptRow {
  id: string;
  examId: string;
  examTitle: string;
  skill: CloudIeltsSkill;
  bandScore: number | null;
  totalCorrect: number;
  totalQuestions: number;
  timeSpentSeconds: number;
  details?: CloudAttemptDetails | null;
  completedAt: Date | string;
}

export interface CloudBootstrapPayload {
  customExams: CloudCustomExamRow[];
  collections: CloudCollectionRow[];
  progressList: CloudProgressRow[];
  recentAttempts: CloudAttemptRow[];
}

export const CLOUD_MIGRATION_FLAG = 'ielts_cloud_migrated_v1';

const WRITING_STORAGE_KEY = 'ielts_writing_exams_custom';
const WRITING_DELETED_KEY = 'ielts_writing_exams_deleted';
const SPEAKING_STORAGE_KEY = 'ielts_speaking_exams_custom';
const SPEAKING_DELETED_KEY = 'ielts_speaking_exams_deleted';

export function getExamSkillLabel(exam: Exam): 'Reading' | 'Listening' {
  return isListeningExam(exam) ? 'Listening' : 'Reading';
}

export function buildLocalSyncPayload() {
  const customExams: Array<{
    examId: string;
    skill: CloudIeltsSkill;
    title: string;
    collection: string;
    data: Record<string, unknown>;
  }> = [];

  for (const ex of getCustomExams()) {
    customExams.push({
      examId: ex.id,
      skill: getExamSkillLabel(ex),
      title: ex.title,
      collection: ex.collection || 'My Tests',
      data: ex as unknown as Record<string, unknown>,
    });
  }

  try {
    const rawW = localStorage.getItem(WRITING_STORAGE_KEY);
    const listW: WritingExam[] = rawW ? JSON.parse(rawW) : [];
    for (const ex of listW) {
      customExams.push({
        examId: ex.id,
        skill: 'Writing',
        title: ex.title,
        collection: ex.collection || 'My Tests',
        data: ex as unknown as Record<string, unknown>,
      });
    }
  } catch {}

  try {
    const rawS = localStorage.getItem(SPEAKING_STORAGE_KEY);
    const listS: SpeakingExam[] = rawS ? JSON.parse(rawS) : [];
    for (const ex of listS) {
      customExams.push({
        examId: ex.id,
        skill: 'Speaking',
        title: ex.title,
        collection: ex.collection || 'My Tests',
        data: ex as unknown as Record<string, unknown>,
      });
    }
  } catch {}

  const deletedExams: Array<{ examId: string; skill: CloudIeltsSkill }> = [];
  for (const id of getDeletedExamIds()) {
    deletedExams.push({
      examId: id,
      skill: id.toLowerCase().includes('listening') ? 'Listening' : 'Reading',
    });
  }
  try {
    const rawDelW = localStorage.getItem(WRITING_DELETED_KEY);
    const listDelW: string[] = rawDelW ? JSON.parse(rawDelW) : [];
    for (const id of listDelW) {
      deletedExams.push({ examId: id, skill: 'Writing' });
    }
  } catch {}
  try {
    const rawDelS = localStorage.getItem(SPEAKING_DELETED_KEY);
    const listDelS: string[] = rawDelS ? JSON.parse(rawDelS) : [];
    for (const id of listDelS) {
      deletedExams.push({ examId: id, skill: 'Speaking' });
    }
  } catch {}

  const collections = getCustomCollections().map((c) => ({
    name: c.name,
    description: c.description,
  }));
  const deletedCollections = Array.from(getDeletedCollections());

  const progressList: Array<{
    examId: string;
    skill: CloudIeltsSkill;
    state: Record<string, unknown>;
  }> = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const rawVal = localStorage.getItem(key);
      if (!rawVal) continue;

      if (key.startsWith('ielts_exam_progress_v1_')) {
        const examId = key.slice('ielts_exam_progress_v1_'.length);
        progressList.push({
          examId,
          skill: examId.toLowerCase().includes('listening') ? 'Listening' : 'Reading',
          state: JSON.parse(rawVal) as Record<string, unknown>,
        });
      } else if (key.startsWith('ielts_writing_progress_v1_')) {
        const examId = key.slice('ielts_writing_progress_v1_'.length);
        progressList.push({
          examId,
          skill: 'Writing',
          state: JSON.parse(rawVal) as Record<string, unknown>,
        });
      } else if (key.startsWith('ielts_speaking_progress_v1_')) {
        const examId = key.slice('ielts_speaking_progress_v1_'.length);
        progressList.push({
          examId,
          skill: 'Speaking',
          state: JSON.parse(rawVal) as Record<string, unknown>,
        });
      }
    }
  } catch {}

  return {
    customExams,
    deletedExams,
    collections,
    deletedCollections,
    progressList,
  };
}

export function hydrateFromCloudBootstrap(data: CloudBootstrapPayload) {
  const customRlExams: Exam[] = [];
  const deletedRlIds: string[] = [];
  const customWriting: WritingExam[] = [];
  const deletedWritingIds: string[] = [];
  const customSpeaking: SpeakingExam[] = [];
  const deletedSpeakingIds: string[] = [];

  for (const row of data.customExams) {
    if (row.skill === 'Reading' || row.skill === 'Listening') {
      if (row.deleted) {
        deletedRlIds.push(row.examId);
      } else if (row.data && typeof row.data === 'object') {
        customRlExams.push(row.data as Exam);
      }
    } else if (row.skill === 'Writing') {
      if (row.deleted) {
        deletedWritingIds.push(row.examId);
      } else if (row.data && typeof row.data === 'object') {
        customWriting.push(row.data as WritingExam);
      }
    } else if (row.skill === 'Speaking') {
      if (row.deleted) {
        deletedSpeakingIds.push(row.examId);
      } else if (row.data && typeof row.data === 'object') {
        customSpeaking.push(row.data as SpeakingExam);
      }
    }
  }

  const activeCollections: { id: string; name: string; description?: string }[] = [];
  const deletedCollections: string[] = [];
  for (const col of data.collections) {
    if (col.deleted) {
      deletedCollections.push(col.name);
    } else {
      activeCollections.push({
        id: col.id,
        name: col.name,
        description: col.description ?? undefined,
      });
    }
  }

  replaceLocalExamsAndCollections({
    customExams: customRlExams,
    deletedExamIds: deletedRlIds,
    collections: activeCollections,
    deletedCollections,
  });

  try {
    localStorage.setItem(WRITING_STORAGE_KEY, JSON.stringify(customWriting));
    localStorage.setItem(WRITING_DELETED_KEY, JSON.stringify(deletedWritingIds));
    localStorage.setItem(SPEAKING_STORAGE_KEY, JSON.stringify(customSpeaking));
    localStorage.setItem(SPEAKING_DELETED_KEY, JSON.stringify(deletedSpeakingIds));

    for (const prog of data.progressList) {
      const prefix =
        prog.skill === 'Writing'
          ? 'ielts_writing_progress_v1_'
          : prog.skill === 'Speaking'
            ? 'ielts_speaking_progress_v1_'
            : 'ielts_exam_progress_v1_';
      const storageKey = prefix + prog.examId;
      const cloudSavedAt =
        prog.state &&
        typeof prog.state === 'object' &&
        'lastSavedAt' in prog.state &&
        typeof (prog.state as { lastSavedAt?: unknown }).lastSavedAt === 'number'
          ? (prog.state as { lastSavedAt: number }).lastSavedAt
          : 0;

      let shouldOverwrite = true;
      const existingRaw = localStorage.getItem(storageKey);
      if (existingRaw) {
        try {
          const existing = JSON.parse(existingRaw) as { lastSavedAt?: unknown };
          const localSavedAt =
            typeof existing?.lastSavedAt === 'number' ? existing.lastSavedAt : 0;
          if (localSavedAt > cloudSavedAt) {
            shouldOverwrite = false;
          }
        } catch {
          shouldOverwrite = true;
        }
      }

      if (shouldOverwrite) {
        localStorage.setItem(storageKey, JSON.stringify(prog.state));
      }
    }
  } catch (e) {
    console.warn('Failed hydrating writing/speaking/progress cache', e);
  }
}
