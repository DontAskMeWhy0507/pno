export type CourseTrack =
  | "Python"
  | "SQL"
  | "R"
  | "Git"
  | "JavaScript"
  | "Excel";

export type LessonType = "theory" | "practice" | "quiz";

export interface CourseLessonSummary {
  id: string;
  globalIndex: number;
  title: string;
  type: LessonType;
}

export interface CourseChapterSummary {
  id: string;
  number: number;
  title: string;
  lessons: CourseLessonSummary[];
}

export interface CourseStats {
  theory: number;
  practice: number;
  quiz: number;
  quizQuestions: number;
}

export interface CourseSummary {
  id: string;
  title: string;
  track: CourseTrack;
  level: string;
  description: string;
  estimatedHours: number;
  chapterCount: number;
  lessonCount: number;
  stats: CourseStats;
  chapters: CourseChapterSummary[];
  isCustom?: boolean;
  isEdited?: boolean;
  updatedAt?: number;
}

export interface CoursesManifest {
  version: number;
  totalCourses: number;
  tracks: CourseTrack[];
  courses: CourseSummary[];
}

export interface QuizOption {
  label: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  number: number;
  prompt: string;
  options: QuizOption[];
  correctIndex: number;
  explanation: string;
}

export interface SqlTableData {
  name: string;
  columns: string[];
  rows: string[][];
}

export interface PracticeSection {
  title: string;
  html: string;
}

export interface PracticeData {
  difficulty: string;
  title: string;
  summaryHtml: string;
  sections: PracticeSection[];
  starterCode: string;
  sqlTables: SqlTableData[];
  expectedTable: { columns: string[]; rows: string[][] } | null;
  expectedText: string;
}

export interface TheoryHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface TheoryData {
  contentHtml: string;
  markdown?: string;
  headings: TheoryHeading[];
}

export interface CourseLesson {
  id: string;
  index: number;
  globalIndex: number;
  title: string;
  rawTitle: string;
  type: LessonType;
  theory?: TheoryData;
  practice?: PracticeData;
  questions?: QuizQuestion[];
}

export interface CourseChapter {
  id: string;
  number: number;
  title: string;
  lessons: CourseLesson[];
}

export interface CourseDetail {
  id: string;
  title: string;
  track: CourseTrack;
  level: string;
  description: string;
  estimatedHours: number;
  chapterCount: number;
  lessonCount: number;
  stats: CourseStats;
  chapters: CourseChapter[];
  isCustom?: boolean;
  isEdited?: boolean;
  updatedAt?: number;
}

export interface QuizLessonProgress {
  answers: Record<string, number>;
  checked: Record<string, boolean>;
}

export interface CourseUserProgress {
  completedLessons: string[];
  lastLessonId?: string;
  quizzes: Record<string, QuizLessonProgress>;
  practiceDrafts: Record<string, string>;
  updatedAt: number;
}

export interface CoursesProgressStore {
  lastCourseId?: string;
  courses: Record<string, CourseUserProgress>;
}
