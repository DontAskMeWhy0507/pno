import type {
  CourseDetail,
  CourseSummary,
  CourseUserProgress,
  CoursesManifest,
  CoursesProgressStore,
  QuizLessonProgress,
} from "../types";

const STORAGE_KEY_PROGRESS = "pno_courses_progress_v1";
const STORAGE_KEY_CUSTOM = "pno_courses_custom_v1";
const STORAGE_KEY_DELETED = "pno_courses_deleted_v1";

const EMPTY_STORE: CoursesProgressStore = {
  courses: {},
};

const EMPTY_COURSE_PROGRESS = (): CourseUserProgress => ({
  completedLessons: [],
  quizzes: {},
  practiceDrafts: {},
  updatedAt: Date.now(),
});

export function loadCoursesProgress(): CoursesProgressStore {
  if (typeof window === "undefined") return EMPTY_STORE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PROGRESS);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as CoursesProgressStore;
    if (!parsed || typeof parsed !== "object" || !parsed.courses) {
      return EMPTY_STORE;
    }
    return parsed;
  } catch {
    return EMPTY_STORE;
  }
}

export function saveCoursesProgress(store: CoursesProgressStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors
  }
}

export function getCourseProgress(
  store: CoursesProgressStore,
  courseId: string,
): CourseUserProgress {
  return store.courses[courseId] ?? EMPTY_COURSE_PROGRESS();
}

export function toggleLessonCompleted(
  store: CoursesProgressStore,
  courseId: string,
  lessonId: string,
  forceValue?: boolean,
): CoursesProgressStore {
  const prev = getCourseProgress(store, courseId);
  const exists = prev.completedLessons.includes(lessonId);
  const shouldComplete = forceValue !== undefined ? forceValue : !exists;
  const completedLessons = shouldComplete
    ? exists
      ? prev.completedLessons
      : [...prev.completedLessons, lessonId]
    : prev.completedLessons.filter((id) => id !== lessonId);

  const next: CoursesProgressStore = {
    ...store,
    lastCourseId: courseId,
    courses: {
      ...store.courses,
      [courseId]: {
        ...prev,
        completedLessons,
        lastLessonId: lessonId,
        updatedAt: Date.now(),
      },
    },
  };
  saveCoursesProgress(next);
  return next;
}

export function setLastVisitedLesson(
  store: CoursesProgressStore,
  courseId: string,
  lessonId: string,
): CoursesProgressStore {
  const prev = getCourseProgress(store, courseId);
  if (store.lastCourseId === courseId && prev.lastLessonId === lessonId) {
    return store;
  }
  const next: CoursesProgressStore = {
    ...store,
    lastCourseId: courseId,
    courses: {
      ...store.courses,
      [courseId]: {
        ...prev,
        lastLessonId: lessonId,
        updatedAt: Date.now(),
      },
    },
  };
  saveCoursesProgress(next);
  return next;
}

export function saveQuizState(
  store: CoursesProgressStore,
  courseId: string,
  lessonId: string,
  quizState: QuizLessonProgress,
): CoursesProgressStore {
  const prev = getCourseProgress(store, courseId);
  const next: CoursesProgressStore = {
    ...store,
    lastCourseId: courseId,
    courses: {
      ...store.courses,
      [courseId]: {
        ...prev,
        quizzes: {
          ...prev.quizzes,
          [lessonId]: quizState,
        },
        updatedAt: Date.now(),
      },
    },
  };
  saveCoursesProgress(next);
  return next;
}

export function savePracticeDraft(
  store: CoursesProgressStore,
  courseId: string,
  lessonId: string,
  code: string,
): CoursesProgressStore {
  const prev = getCourseProgress(store, courseId);
  const next: CoursesProgressStore = {
    ...store,
    lastCourseId: courseId,
    courses: {
      ...store.courses,
      [courseId]: {
        ...prev,
        practiceDrafts: {
          ...prev.practiceDrafts,
          [lessonId]: code,
        },
        updatedAt: Date.now(),
      },
    },
  };
  saveCoursesProgress(next);
  return next;
}

export function normalizeCourseDetail(course: CourseDetail): CourseDetail {
  let globalIdx = 0;
  let theory = 0;
  let practice = 0;
  let quiz = 0;
  let quizQuestions = 0;

  const chapters = course.chapters.map((ch, cIdx) => {
    const lessons = ch.lessons.map((l, lIdx) => {
      globalIdx += 1;
      if (l.type === "theory") theory += 1;
      else if (l.type === "practice") practice += 1;
      else if (l.type === "quiz") {
        quiz += 1;
        quizQuestions += l.questions?.length ?? 0;
      }
      return {
        ...l,
        index: lIdx + 1,
        globalIndex: globalIdx,
        rawTitle: l.rawTitle || l.title,
      };
    });
    return {
      ...ch,
      number: cIdx + 1,
      lessons,
    };
  });

  return {
    ...course,
    chapterCount: chapters.length,
    lessonCount: globalIdx,
    estimatedHours:
      course.estimatedHours && course.estimatedHours > 0
        ? course.estimatedHours
        : Math.max(1, Math.round(globalIdx * 0.3)),
    stats: { theory, practice, quiz, quizQuestions },
    chapters,
    updatedAt: course.updatedAt ?? Date.now(),
  };
}

export function courseDetailToSummary(detail: CourseDetail): CourseSummary {
  const norm = normalizeCourseDetail(detail);
  return {
    id: norm.id,
    title: norm.title,
    track: norm.track,
    level: norm.level,
    description: norm.description,
    estimatedHours: norm.estimatedHours,
    chapterCount: norm.chapterCount,
    lessonCount: norm.lessonCount,
    stats: norm.stats,
    isCustom: norm.isCustom,
    isEdited: norm.isEdited,
    updatedAt: norm.updatedAt,
    chapters: norm.chapters.map((ch) => ({
      id: ch.id,
      number: ch.number,
      title: ch.title,
      lessons: ch.lessons.map((l) => ({
        id: l.id,
        globalIndex: l.globalIndex,
        title: l.title,
        type: l.type,
      })),
    })),
  };
}

export function loadCustomCourses(): Record<string, CourseDetail> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_CUSTOM);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CourseDetail>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCustomCoursesMap(map: Record<string, CourseDetail>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

export function saveCustomCourseLocal(
  course: CourseDetail,
): Record<string, CourseDetail> {
  const current = loadCustomCourses();
  const normalized = normalizeCourseDetail({
    ...course,
    updatedAt: Date.now(),
  });
  const next = { ...current, [normalized.id]: normalized };
  saveCustomCoursesMap(next);

  // Also ensure it is removed from deleted tombstones if re-added
  const deleted = loadDeletedCourseIds().filter((id) => id !== normalized.id);
  saveDeletedCourseIds(deleted);

  return next;
}

export function loadDeletedCourseIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_DELETED);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDeletedCourseIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY_DELETED, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function deleteCourseLocal(
  courseId: string,
  isBuiltin: boolean,
): { custom: Record<string, CourseDetail>; deleted: string[] } {
  const current = loadCustomCourses();
  const nextCustom = { ...current };
  delete nextCustom[courseId];
  saveCustomCoursesMap(nextCustom);

  let nextDeleted = loadDeletedCourseIds();
  if (isBuiltin && !nextDeleted.includes(courseId)) {
    nextDeleted = [...nextDeleted, courseId];
    saveDeletedCourseIds(nextDeleted);
  }
  return { custom: nextCustom, deleted: nextDeleted };
}

export function restoreDeletedCoursesLocal(): string[] {
  saveDeletedCourseIds([]);
  return [];
}

export function mergeManifestWithCustom(
  baseManifest: CoursesManifest,
  customCourses: Record<string, CourseDetail>,
  deletedIds: string[],
): CoursesManifest {
  const deletedSet = new Set(deletedIds);
  const builtinIds = new Set(baseManifest.courses.map((c) => c.id));

  const merged: CourseSummary[] = baseManifest.courses
    .filter((c) => !deletedSet.has(c.id))
    .map((c) => {
      const override = customCourses[c.id];
      if (!override) return c;
      return {
        ...courseDetailToSummary(override),
        isEdited: true,
        isCustom: false,
      };
    });

  // Append newly created custom courses (not in builtin manifest)
  const customOnly = Object.values(customCourses)
    .filter((c) => !builtinIds.has(c.id) && !deletedSet.has(c.id))
    .map((c) => ({
      ...courseDetailToSummary(c),
      isCustom: true,
    }));

  const courses = [...customOnly, ...merged];
  return {
    ...baseManifest,
    totalCourses: courses.length,
    courses,
  };
}

export interface CloudCourseRow {
  courseId: string;
  deleted: boolean;
  data: unknown;
}

export interface CloudProgressRow {
  courseId: string;
  state: unknown;
}

export function hydrateCoursesFromCloud(
  cloudCourses: CloudCourseRow[],
  cloudProgress: CloudProgressRow[],
): {
  custom: Record<string, CourseDetail>;
  deleted: string[];
  progress: CoursesProgressStore;
} {
  const localCustom = loadCustomCourses();
  const localDeleted = new Set(loadDeletedCourseIds());
  const mergedCustom: Record<string, CourseDetail> = { ...localCustom };

  for (const row of cloudCourses) {
    if (row.deleted) {
      delete mergedCustom[row.courseId];
      localDeleted.add(row.courseId);
      continue;
    }
    const cloudCourse = row.data as CourseDetail | undefined;
    if (
      !cloudCourse ||
      !cloudCourse.id ||
      !Array.isArray(cloudCourse.chapters)
    ) {
      continue;
    }
    localDeleted.delete(row.courseId);
    const localExisting = mergedCustom[row.courseId];
    if (
      !localExisting ||
      (cloudCourse.updatedAt ?? 0) >= (localExisting.updatedAt ?? 0)
    ) {
      mergedCustom[row.courseId] = normalizeCourseDetail(cloudCourse);
    }
  }

  const deletedArr = Array.from(localDeleted);
  saveCustomCoursesMap(mergedCustom);
  saveDeletedCourseIds(deletedArr);

  const localProg = loadCoursesProgress();
  const mergedCoursesProg: Record<string, CourseUserProgress> = {
    ...localProg.courses,
  };
  for (const prow of cloudProgress) {
    const cloudState = prow.state as CourseUserProgress | undefined;
    if (!cloudState || !Array.isArray(cloudState.completedLessons)) continue;
    const existing = mergedCoursesProg[prow.courseId];
    if (!existing || (cloudState.updatedAt ?? 0) >= (existing.updatedAt ?? 0)) {
      mergedCoursesProg[prow.courseId] = cloudState;
    }
  }

  const nextProgress: CoursesProgressStore = {
    ...localProg,
    courses: mergedCoursesProg,
  };
  saveCoursesProgress(nextProgress);

  return {
    custom: mergedCustom,
    deleted: deletedArr,
    progress: nextProgress,
  };
}

export interface CoursesParsedRoute {
  courseId?: string;
  lessonId?: string;
}

export function parseCoursesLocation(pathname: string): CoursesParsedRoute {
  const clean = (pathname || "/courses").replace(/^\/courses\/?/, "");
  const parts = clean.split("/").filter(Boolean);
  if (!parts.length) return {};
  return {
    courseId: decodeURIComponent(parts[0]!),
    lessonId: parts[1] ? decodeURIComponent(parts[1]) : undefined,
  };
}

export function buildCoursesPath(courseId?: string, lessonId?: string): string {
  if (!courseId) return "/courses";
  if (!lessonId) return `/courses/${encodeURIComponent(courseId)}`;
  return `/courses/${encodeURIComponent(courseId)}/${encodeURIComponent(
    lessonId,
  )}`;
}
