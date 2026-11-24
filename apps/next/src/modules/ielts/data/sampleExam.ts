import type { Exam } from '../types/exam';
import rawImportedExams from './imported_exams.json';

const importedList = (rawImportedExams as unknown as Exam[]) || [];
const firstExam = importedList[0];
if (!firstExam) {
  throw new Error('imported_exams.json is empty');
}

export const sampleExam: Exam = firstExam;
