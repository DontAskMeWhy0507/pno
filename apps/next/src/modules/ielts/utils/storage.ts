import type { Exam } from '../types/exam';
import { sampleExam } from '../data/sampleExam';
import rawImportedExams from '../data/imported_exams.json';
import rawImportedListeningExams from '../data/imported_listening_exams.json';
import { sampleListeningExams } from '../data/listeningExams';

const importedExamsList: Exam[] = (rawImportedExams as unknown as Exam[]) || [];
const importedListeningExamsList: Exam[] = (rawImportedListeningExams as unknown as Exam[]) || [];
const STORAGE_KEY_EXAMS = 'ielts_exams_list_v3';
const STORAGE_KEY_DELETED = 'ielts_deleted_exam_ids_v3';

function getDeletedExamIds(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(STORAGE_KEY_DELETED);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveDeletedExamIds(deletedSet: Set<string>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_DELETED, JSON.stringify(Array.from(deletedSet)));
  } catch (e) {
    console.error('Failed to save deleted exam IDs', e);
  }
}

export function getAllExams(): Exam[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_EXAMS) : null;
    const customList: Exam[] = raw ? JSON.parse(raw) : [];
    const deletedIds = getDeletedExamIds();

    // Combine builtins (importedExamsList + sampleExam if not duplicate + sampleListeningExams + importedListeningExamsList) + custom user exams
    const allMap = new Map<string, Exam>();
    const importedTitles = new Set(
      importedExamsList.map((e) => (e.title || '').trim().toUpperCase())
    );

    // Only add sampleExam if it is not already present in importedExamsList by title
    if (!importedTitles.has((sampleExam.title || '').trim().toUpperCase())) {
      allMap.set(sampleExam.id, sampleExam);
    }

    // Add all imported reading exams from static library
    for (const ex of importedExamsList) {
      allMap.set(ex.id, ex);
    }

    // Add sample listening exams
    for (const ex of sampleListeningExams) {
      allMap.set(ex.id, ex);
    }

    // Add all imported Vol 9 listening exams
    for (const ex of importedListeningExamsList) {
      allMap.set(ex.id, ex);
    }

    // Add/overwrite with custom exams from localStorage (skip duplicate vol-9-test-1-reading if imported_vol9_test_1 exists)
    for (const ex of customList) {
      if (ex.id === sampleExam.id && importedTitles.has((sampleExam.title || '').trim().toUpperCase())) {
        continue;
      }
      allMap.set(ex.id, ex);
    }

    return Array.from(allMap.values()).filter(e => !deletedIds.has(e.id));
  } catch (err) {
    console.error('Failed to load exams from localStorage', err);
    return [sampleExam, ...importedExamsList, ...sampleListeningExams, ...importedListeningExamsList];
  }
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
  return all.find(e => e.id === id);
}

export function saveExam(exam: Exam): void {
  try {
    const deletedIds = getDeletedExamIds();
    if (deletedIds.has(exam.id)) {
      deletedIds.delete(exam.id);
      saveDeletedExamIds(deletedIds);
    }

    const raw = localStorage.getItem(STORAGE_KEY_EXAMS);
    const customList: Exam[] = raw ? JSON.parse(raw) : [];
    const index = customList.findIndex(e => e.id === exam.id);
    const updatedExam = { ...exam, updatedAt: Date.now() };

    if (index >= 0) {
      customList[index] = updatedExam;
    } else {
      customList.push(updatedExam);
    }

    localStorage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(customList));
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

    const raw = localStorage.getItem(STORAGE_KEY_EXAMS);
    if (raw) {
      const customList: Exam[] = JSON.parse(raw);
      const filtered = customList.filter(e => e.id !== id);
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

const STORAGE_KEY_COLLECTIONS = 'ielts_collections_list_v1';

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
  if (title.includes('MADAGASCAR')) {
    return 'Vol 9';
  }
  return exam.isBuiltin ? 'Official IELTS Library' : 'My Tests';
}

const STORAGE_KEY_DELETED_COLLECTIONS = 'ielts_deleted_collections_v2';

function getDeletedCollections(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_COLLECTIONS);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDeletedCollections(set: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY_DELETED_COLLECTIONS, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export function getAllCollections(): { id: string; name: string; description?: string; isBuiltin?: boolean }[] {
  const defaultCollections = [
    { id: 'col_my_tests', name: 'My Tests', description: 'User created & imported custom practice tests', isBuiltin: true },
    { id: 'col_cam_18', name: 'Cambridge 18', description: 'Official Cambridge Practice Tests 18', isBuiltin: true },
    { id: 'col_vol_10', name: 'Vol 10', description: 'Recent IELTS Practice Tests Vol 10', isBuiltin: true },
    { id: 'col_vol_9', name: 'Vol 9', description: 'Curated IELTS Tests Vol 9', isBuiltin: true },
    { id: 'col_vol_8', name: 'Vol 8', description: 'Curated IELTS Tests Vol 8', isBuiltin: true },
    { id: 'col_vol_7', name: 'Vol 7', description: 'Curated IELTS Tests Vol 7', isBuiltin: true },
    { id: 'col_vol_6', name: 'Vol 6', description: 'Curated IELTS Tests Vol 6', isBuiltin: true },
    { id: 'col_vol_5', name: 'Vol 5', description: 'Curated IELTS Tests Vol 5', isBuiltin: true },
    { id: 'col_vol_4', name: 'Vol 4', description: 'Curated IELTS Tests Vol 4', isBuiltin: true },
    { id: 'col_vol_3', name: 'Vol 3', description: 'Curated IELTS Tests Vol 3', isBuiltin: true },
    { id: 'col_vol_2', name: 'Vol 2', description: 'Curated IELTS Tests Vol 2', isBuiltin: true },
    { id: 'col_vol_1', name: 'Vol 1', description: 'Curated IELTS Tests Vol 1', isBuiltin: true },
  ];

  const colMap = new Map<string, { id: string; name: string; description?: string; isBuiltin?: boolean }>();
  for (const c of defaultCollections) {
    colMap.set(c.name.toLowerCase(), c);
  }

  // Load custom collections
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COLLECTIONS);
    if (raw) {
      const customCols: { id: string; name: string; description?: string }[] = JSON.parse(raw);
      for (const c of customCols) {
        let name = c.name;
        if (name === 'Bộ đề của tôi') name = 'My Tests';
        colMap.set(name.toLowerCase(), { ...c, name, isBuiltin: false });
      }
    }
  } catch {
    // ignore
  }

  // Also discover collections from current exams
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

  const deletedSet = getDeletedCollections();
  return Array.from(colMap.values()).filter(c => !deletedSet.has(c.name.toLowerCase()));
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
    const raw = localStorage.getItem(STORAGE_KEY_COLLECTIONS);
    const list: { id: string; name: string; description?: string }[] = raw ? JSON.parse(raw) : [];
    if (!list.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
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

  // 1. Mark as deleted in persistent set
  const deletedSet = getDeletedCollections();
  deletedSet.add(colTrim.toLowerCase());
  saveDeletedCollections(deletedSet);

  // 2. If requested, delete all exams in this collection
  if (deleteContainedExams) {
    const exams = getAllExams();
    for (const ex of exams) {
      if (getExamCollection(ex).toLowerCase() === colTrim.toLowerCase()) {
        deleteExam(ex.id);
      }
    }
  }

  // 3. Remove collection from custom collections list
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COLLECTIONS);
    const list: { id: string; name: string; description?: string }[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(c => c.name.toLowerCase() !== colTrim.toLowerCase());
    localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to delete collection', err);
  }
}
