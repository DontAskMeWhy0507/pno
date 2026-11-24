import fs from "fs";
import path from "path";

import rawImportedExams from "../apps/next/src/modules/ielts/data/imported_exams.json";
import rawImportedListeningExams from "../apps/next/src/modules/ielts/data/imported_listening_exams.json";
import { sampleExam } from "../apps/next/src/modules/ielts/data/sampleExam";
import type { Exam } from "../apps/next/src/modules/ielts/types/exam";

const importedExamsList = (rawImportedExams as unknown as Exam[]) || [];
const importedListeningExamsList =
  (rawImportedListeningExams as unknown as Exam[]) || [];

const allMap = new Map<string, Exam>();
const importedTitles = new Set(
  importedExamsList.map((e) => (e.title || "").trim().toUpperCase()),
);

if (!importedTitles.has((sampleExam.title || "").trim().toUpperCase())) {
  allMap.set(sampleExam.id, sampleExam);
}
for (const ex of importedExamsList) {
  allMap.set(ex.id, ex);
}
for (const ex of importedListeningExamsList) {
  allMap.set(ex.id, ex);
}

const outDataDir = path.resolve("apps/next/public/ielts-data");
fs.mkdirSync(outDataDir, { recursive: true });

// Clean previous generated files
for (const file of fs.readdirSync(outDataDir)) {
  if (file.endsWith(".json")) {
    fs.unlinkSync(path.join(outDataDir, file));
  }
}

const catalog: Array<{
  id: string;
  title: string;
  description?: string;
  durationMinutes: number;
  category?: string;
  collection?: string;
  isBuiltin: true;
  partCount: number;
  questionCount: number;
  partTitles: string[];
  createdAt: number;
  updatedAt: number;
  dataFile: string;
}> = [];

for (const exam of allMap.values()) {
  const safeFile = `${exam.id.replace(/[^a-zA-Z0-9_.-]/g, "_")}.json`;
  const fullExam: Exam = {
    ...exam,
    isBuiltin: true,
  };

  fs.writeFileSync(
    path.join(outDataDir, safeFile),
    JSON.stringify(fullExam),
    "utf-8",
  );

  const partCount = exam.parts?.length ?? 0;
  const questionCount = (exam.parts ?? []).reduce(
    (sum, part) =>
      sum +
      (part.questionGroups ?? []).reduce(
        (gSum, g) => gSum + (g.questions?.length ?? 0),
        0,
      ),
    0,
  );

  catalog.push({
    id: exam.id,
    title: exam.title,
    description: exam.description,
    durationMinutes: exam.durationMinutes,
    category: exam.category,
    collection: exam.collection,
    isBuiltin: true,
    partCount,
    questionCount,
    partTitles: (exam.parts ?? []).map((p) => p.title).filter(Boolean),
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt,
    dataFile: safeFile,
  });
}

const catalogPath = path.resolve(
  "apps/next/src/modules/ielts/data/builtinCatalog.json",
);
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf-8");

console.log(
  `Generated ${catalog.length} IELTS data files in ${outDataDir} and catalog (${Math.round(
    fs.statSync(catalogPath).size / 1024,
  )} KB) at ${catalogPath}`,
);
