import type { Exam } from '../../../types/exam';
import type { SpeakingExam } from '../../../types/speaking';
import type { WritingExam } from '../../../types/writing';
import type { CloudIeltsSkill } from '../../../utils/cloudSync';

export interface CollectionItem {
  id: string;
  name: string;
  description?: string;
  isBuiltin?: boolean;
}

export interface CloudExamPayload {
  examId: string;
  skill: CloudIeltsSkill;
  title: string;
  collection: string;
  data: Record<string, unknown>;
}

export interface UnifiedTestRow {
  key: string;
  id: string;
  title: string;
  skill: CloudIeltsSkill;
  collection: string;
  meta: string;
  questionCount: number;
  isBuiltin: boolean;
  updatedAt: number;
  healthWarnings: string[];
  rawExam?: Exam;
  rawWriting?: WritingExam;
  rawSpeaking?: SpeakingExam;
}

export type SortField = 'title' | 'skill' | 'collection' | 'questions' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';
export type OriginFilter = 'all' | 'custom' | 'builtin';

const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

export function resolveCollectionOption(
  value: string,
  collections: CollectionItem[]
): string {
  const trimmed = (value || '').trim();
  const match = collections.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase()
  );
  return match ? match.name : trimmed || 'My Tests';
}

export function computeTestHealth(input: {
  skill: CloudIeltsSkill;
  questionCount: number;
  rawExam?: Exam;
  rawWriting?: WritingExam;
  rawSpeaking?: SpeakingExam;
}): string[] {
  const warnings: string[] = [];

  if (input.rawExam) {
    if (input.questionCount === 0) {
      warnings.push('No questions defined');
    }
    const parts = input.rawExam.parts || [];
    if (parts.length > 0) {
      let missingAnswers = 0;
      for (const part of parts) {
        if (input.skill === 'Listening' && !part.audioUrl?.trim()) {
          warnings.push(`Section ${part.partNumber} missing audio`);
        }
        for (const group of part.questionGroups || []) {
          for (const q of group.questions || []) {
            const hasAns = Array.isArray(q.correctAnswer)
              ? q.correctAnswer.length > 0
              : Boolean(q.correctAnswer && String(q.correctAnswer).trim());
            if (!hasAns) missingAnswers++;
          }
        }
      }
      if (missingAnswers > 0) {
        warnings.push(`${missingAnswers} question(s) missing answer key`);
      }
    }
  } else if (input.rawWriting) {
    if (!input.rawWriting.task1?.prompt?.trim()) {
      warnings.push('Missing Task 1 prompt');
    }
    if (!input.rawWriting.task2?.prompt?.trim()) {
      warnings.push('Missing Task 2 prompt');
    }
  } else if (input.rawSpeaking) {
    if (!input.rawSpeaking.part1Questions?.length) {
      warnings.push('Part 1 has no questions');
    }
    if (!input.rawSpeaking.part2Question?.questionText?.trim()) {
      warnings.push('Missing Part 2 Cue Card prompt');
    }
    if (!input.rawSpeaking.part3Questions?.length) {
      warnings.push('Part 3 has no questions');
    }
  }

  return warnings;
}

export function sortUnifiedRows(
  rows: UnifiedTestRow[],
  field: SortField,
  direction: SortDirection
): UnifiedTestRow[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (field === 'questions') {
      return factor * (a.questionCount - b.questionCount);
    }
    if (field === 'updatedAt') {
      return factor * ((a.updatedAt || 0) - (b.updatedAt || 0));
    }
    if (field === 'skill') {
      return factor * naturalCollator.compare(a.skill, b.skill);
    }
    if (field === 'collection') {
      return factor * naturalCollator.compare(a.collection, b.collection);
    }
    return factor * naturalCollator.compare(a.title, b.title);
  });
}

export function formatShortUpdated(ts: number): string {
  if (!ts) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(new Date(ts));
  } catch {
    return '—';
  }
}
