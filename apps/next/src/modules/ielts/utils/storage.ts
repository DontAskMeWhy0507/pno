import rawCatalog from '../data/builtinCatalog.json';
import type { Exam } from '../types/exam';

interface BuiltinCatalogItem {
  id: string;
  title: string;
  description?: string;
  durationMinutes: number;
  category?: string;
  collection?: string;
  isBuiltin: true;
  partCount: number;
  questionCount: number;
  partTitles?: string[];
  createdAt: number;
  updatedAt: number;
  dataFile: string;
}

const builtinCatalog: BuiltinCatalogItem[] =
  (rawCatalog as unknown as BuiltinCatalogItem[]) || [];

const STORAGE_KEY_EXAMS = 'ielts_exams_list_v3';
const STORAGE_KEY_DELETED = 'ielts_deleted_exam_ids_v3';
const STORAGE_KEY_COLLECTIONS = 'ielts_collections_list_v1';
const STORAGE_KEY_DELETED_COLLECTIONS = 'ielts_deleted_collections_v2';

const fullExamCache = new Map<string, Exam>();

function catalogToSummaryExam(item: BuiltinCatalogItem): Exam {
  const cached = fullExamCache.get(item.id);
  if (cached) return cached;
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    durationMinutes: item.durationMinutes,
    category: item.category,
    collection: item.collection,
    parts: [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    isBuiltin: true,
    partCount: item.partCount,
    questionCount: item.questionCount,
    dataFile: item.dataFile,
  };
}

export function getExamPartCount(exam: Exam): number {
  if (exam.parts && exam.parts.length > 0) return exam.parts.length;
  return exam.partCount ?? 0;
}

export function getExamQuestionCount(exam: Exam): number {
  if (exam.parts && exam.parts.length > 0) {
    return exam.parts.reduce(
      (sum, p) =>
        sum +
        (p.questionGroups || []).reduce(
          (gSum, g) => gSum + (g.questions || []).length,
          0
        ),
      0
    );
  }
  return exam.questionCount ?? 0;
}

export function getCustomExams(): Exam[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY_EXAMS);
    return raw ? (JSON.parse(raw) as Exam[]) : [];
  } catch {
    return [];
  }
}

export function getDeletedExamIds(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(STORAGE_KEY_DELETED);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function saveDeletedExamIds(deletedSet: Set<string>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_DELETED, JSON.stringify(Array.from(deletedSet)));
  } catch (e) {
    console.error('Failed to save deleted exam IDs', e);
  }
}

export function getAllExams(): Exam[] {
  try {
    const customList = getCustomExams();
    const deletedIds = getDeletedExamIds();

    const allMap = new Map<string, Exam>();
    const importedTitles = new Set(
      builtinCatalog.map((e) => (e.title || '').trim().toUpperCase())
    );

    for (const item of builtinCatalog) {
      allMap.set(item.id, catalogToSummaryExam(item));
    }

    for (const ex of customList) {
      if (
        ex.id === 'vol-9-test-1-reading' &&
        importedTitles.has((ex.title || '').trim().toUpperCase())
      ) {
        continue;
      }
      allMap.set(ex.id, ex);
    }

    return Array.from(allMap.values()).filter((e) => !deletedIds.has(e.id));
  } catch (err) {
    console.error('Failed to load exams from localStorage', err);
    return builtinCatalog.map(catalogToSummaryExam);
  }
}

export async function loadFullExam(examOrId: string | Exam): Promise<Exam | undefined> {
  const id = typeof examOrId === 'string' ? examOrId : examOrId.id;
  const customList = getCustomExams();
  const customMatch = customList.find((e) => e.id === id);
  if (customMatch && customMatch.parts && customMatch.parts.length > 0) {
    return customMatch;
  }

  const cached = fullExamCache.get(id);
  if (cached && cached.parts && cached.parts.length > 0) {
    return cached;
  }

  if (typeof examOrId !== 'string' && examOrId.parts && examOrId.parts.length > 0) {
    fullExamCache.set(id, examOrId);
    return examOrId;
  }

  const catalogItem = builtinCatalog.find((e) => e.id === id);
  const dataFile =
    (typeof examOrId !== 'string' ? examOrId.dataFile : undefined) ||
    catalogItem?.dataFile;

  if (!dataFile) return undefined;

  const res = await fetch(`/ielts-data/${encodeURIComponent(dataFile)}`);
  if (!res.ok) {
    throw new Error(`Unable to load exam data (${res.status})`);
  }
  const fullExam = (await res.json()) as Exam;
  fullExamCache.set(id, fullExam);
  return fullExam;
}

/** Returns true if the exam is an IELTS Listening test */
export function isListeningExam(exam: Exam): boolean {
  return !!(exam.category && exam.category.toLowerCase().includes('listening'));
}

/** Returns true if the exam is an IELTS Reading test (default for any non-listening exam) */
export function isReadingExam(exam: Exam): boolean {
  return !isListeningExam(exam);
}

export function getExamById(id: string): Exam | undefined {
  const all = getAllExams();
  return all.find((e) => e.id === id);
}

export function saveExam(exam: Exam): void {
  try {
    const deletedIds = getDeletedExamIds();
    if (deletedIds.has(exam.id)) {
      deletedIds.delete(exam.id);
      saveDeletedExamIds(deletedIds);
    }

    const customList = getCustomExams();
    const index = customList.findIndex((e) => e.id === exam.id);
    const updatedExam = { ...exam, updatedAt: Date.now() };

    if (index >= 0) {
      customList[index] = updatedExam;
    } else {
      customList.push(updatedExam);
    }

    localStorage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(customList));
    if (updatedExam.parts && updatedExam.parts.length > 0) {
      fullExamCache.set(updatedExam.id, updatedExam);
    }
  } catch (error) {
    console.error('Failed to save exam', error);
    throw new Error('Unable to save this test. Check available browser storage and try again.');
  }
}

export function deleteExam(id: string): boolean {
  try {
    const deletedIds = getDeletedExamIds();
    deletedIds.add(id);
    saveDeletedExamIds(deletedIds);

    const customList = getCustomExams();
    if (customList.length > 0) {
      const filtered = customList.filter((e) => e.id !== id);
      localStorage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(filtered));
    }
    return true;
  } catch (error) {
    console.error('Failed to delete exam', error);
    return false;
  }
}

export function exportExamAsJSON(exam: Exam): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exam, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  const cleanTitle = (exam.title || 'ielts-exam').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  downloadAnchor.setAttribute('download', `${cleanTitle}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function importExamFromJSON(jsonString: string): Exam {
  const parsed = JSON.parse(jsonString);
  if (!parsed.title || !Array.isArray(parsed.parts)) {
    throw new Error('Invalid exam format. Required "title" and "parts" array.');
  }

  const newExam: Exam = {
    ...parsed,
    id: 'exam_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isBuiltin: false,
  };

  saveExam(newExam);
  return newExam;
}

export function getExamCollection(exam: Exam): string {
  if (exam.collection && exam.collection.trim()) {
    const c = exam.collection.trim();
    if (c === 'Bộ đề của tôi') return 'My Tests';
    if (c === 'Kho đề IELTS Chuẩn') return 'Official IELTS Library';
    return c;
  }
  const title = exam.title.toUpperCase();
  const volMatch = title.match(/VOL\s*(\d+)/i);
  if (volMatch) {
    return `Vol ${volMatch[1]}`;
  }
  const camMatch = title.match(/CAM(?:BRIDGE)?\s*(\d+)/i);
  if (camMatch) {
    return `Cambridge ${camMatch[1]}`;
  }
  return exam.isBuiltin ? 'Official IELTS Library' : 'My Tests';
}

export function getDeletedCollections(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_COLLECTIONS);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveDeletedCollections(set: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY_DELETED_COLLECTIONS, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export function getCustomCollections(): { id: string; name: string; description?: string }[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COLLECTIONS);
    return raw ? (JSON.parse(raw) as { id: string; name: string; description?: string }[]) : [];
  } catch {
    return [];
  }
}

export function getAllCollections(): { id: string; name: string; description?: string; isBuiltin?: boolean }[] {
  const defaultCollections = [
    { id: 'col_my_tests', name: 'My Tests', description: 'User created & imported custom practice tests', isBuiltin: true },
    { id: 'col_cam_21', name: 'Cambridge 21', description: 'Official Cambridge Practice Tests 21', isBuiltin: true },
    { id: 'col_cam_20', name: 'Cambridge 20', description: 'Official Cambridge Practice Tests 20', isBuiltin: true },
    { id: 'col_cam_19', name: 'Cambridge 19', description: 'Official Cambridge Practice Tests 19', isBuiltin: true },
    { id: 'col_cam_18', name: 'Cambridge 18', description: 'Official Cambridge Practice Tests 18', isBuiltin: true },
    { id: 'col_cam_17', name: 'Cambridge 17', description: 'Official Cambridge Practice Tests 17', isBuiltin: true },
    { id: 'col_cam_16', name: 'Cambridge 16', description: 'Official Cambridge Practice Tests 16', isBuiltin: true },
    { id: 'col_cam_15', name: 'Cambridge 15', description: 'Official Cambridge Practice Tests 15', isBuiltin: true },
  ];

  const colMap = new Map<string, { id: string; name: string; description?: string; isBuiltin?: boolean }>();
  for (const c of defaultCollections) {
    colMap.set(c.name.toLowerCase(), c);
  }

  for (const c of getCustomCollections()) {
    let name = c.name;
    if (name === 'Bộ đề của tôi') name = 'My Tests';
    colMap.set(name.toLowerCase(), { ...c, name, isBuiltin: false });
  }

  const exams = getAllExams();
  for (const ex of exams) {
    const colName = getExamCollection(ex);
    if (!colMap.has(colName.toLowerCase())) {
      colMap.set(colName.toLowerCase(), {
        id: 'col_' + colName.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
        name: colName,
        description: `${colName} Test Collection`,
        isBuiltin: false,
      });
    }
  }

  const legacyCollections = new Set([
    'ielts listening',
    'ielts forecast 2024-2026',
    'ielts actual tests',
  ]);
  const deletedSet = getDeletedCollections();
  return Array.from(colMap.values()).filter((c) => {
    const lower = c.name.toLowerCase();
    return !deletedSet.has(lower) && !lower.startsWith('vol ') && !legacyCollections.has(lower);
  });
}

export function createCollection(name: string, description?: string): { id: string; name: string; description?: string } {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Collection name cannot be empty.');

  const deletedSet = getDeletedCollections();
  if (deletedSet.has(trimmed.toLowerCase())) {
    deletedSet.delete(trimmed.toLowerCase());
    saveDeletedCollections(deletedSet);
  }

  const id = 'col_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
  const newCol = { id, name: trimmed, description: description?.trim() || `${trimmed} Collection` };

  try {
    const list = getCustomCollections();
    if (!list.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      list.push(newCol);
      localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(list));
    }
  } catch (err) {
    console.error('Failed to create collection', err);
  }

  return newCol;
}

export function setExamCollection(examId: string, collectionName: string): void {
  const exam = getExamById(examId);
  if (exam) {
    exam.collection = collectionName.trim();
    saveExam(exam);
  }
}

export function deleteCollection(collectionName: string, deleteContainedExams = true): void {
  const colTrim = collectionName.trim();
  if (!colTrim) return;

  const deletedSet = getDeletedCollections();
  deletedSet.add(colTrim.toLowerCase());
  saveDeletedCollections(deletedSet);

  if (deleteContainedExams) {
    const exams = getAllExams();
    for (const ex of exams) {
      if (getExamCollection(ex).toLowerCase() === colTrim.toLowerCase()) {
        deleteExam(ex.id);
      }
    }
  }

  try {
    const list = getCustomCollections();
    const filtered = list.filter((c) => c.name.toLowerCase() !== colTrim.toLowerCase());
    localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to delete collection', err);
  }
}

export function replaceLocalExamsAndCollections(params: {
  customExams: Exam[];
  deletedExamIds: string[];
  collections: { id: string; name: string; description?: string }[];
  deletedCollections: string[];
}) {
  try {
    localStorage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(params.customExams));
    localStorage.setItem(STORAGE_KEY_DELETED, JSON.stringify(params.deletedExamIds));
    localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(params.collections));
    localStorage.setItem(
      STORAGE_KEY_DELETED_COLLECTIONS,
      JSON.stringify(params.deletedCollections.map((c) => c.toLowerCase())),
    );
    for (const ex of params.customExams) {
      if (ex.parts && ex.parts.length > 0) {
        fullExamCache.set(ex.id, ex);
      }
    }
  } catch (e) {
    console.warn('Failed hydrating IELTS local cache from cloud', e);
  }
}
