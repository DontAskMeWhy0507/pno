import React from "react";

import { api } from "@pno/trpc";

import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Center,
  Spinner,
  Stack,
  Text,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";

import { menuEventChannel } from "../../events/menu";
import { CourseEditor } from "./components/CourseEditor";
import { CoursePlayer } from "./components/CoursePlayer";
import { CoursesCatalog } from "./components/CoursesCatalog";
import { SmartImportModal } from "./components/SmartImportModal";
import type {
  CourseDetail,
  CoursesManifest,
  CoursesProgressStore,
  QuizLessonProgress,
} from "./types";
import {
  buildCoursesPath,
  deleteCourseLocal,
  getCourseProgress,
  hydrateCoursesFromCloud,
  loadCoursesProgress,
  loadCustomCourses,
  loadDeletedCourseIds,
  mergeManifestWithCustom,
  normalizeCourseDetail,
  parseCoursesLocation,
  restoreDeletedCoursesLocal,
  saveCustomCourseLocal,
  savePracticeDraft,
  saveQuizState,
  setLastVisitedLesson,
  toggleLessonCompleted,
} from "./utils/storage";

export default function CoursesApp() {
  const toast = useToast();
  const {
    isOpen: isImportOpen,
    onOpen: onImportOpen,
    onClose: onImportClose,
  } = useDisclosure();

  const [baseManifest, setBaseManifest] =
    React.useState<CoursesManifest | null>(null);
  const [manifestError, setManifestError] = React.useState<string | null>(null);

  const [customCourses, setCustomCourses] = React.useState<
    Record<string, CourseDetail>
  >(() => loadCustomCourses());
  const [deletedIds, setDeletedIds] = React.useState<string[]>(() =>
    loadDeletedCourseIds(),
  );

  const [courseCache, setCourseCache] = React.useState<
    Record<string, CourseDetail>
  >({});
  const [loadingCourseId, setLoadingCourseId] = React.useState<string | null>(
    null,
  );
  const [courseError, setCourseError] = React.useState<string | null>(null);

  const [editingTarget, setEditingTarget] = React.useState<{
    course: CourseDetail;
    isNew: boolean;
  } | null>(null);

  const [route, setRoute] = React.useState<{
    courseId?: string;
    lessonId?: string;
  }>(() =>
    typeof window !== "undefined"
      ? parseCoursesLocation(window.location.pathname)
      : {},
  );

  const [searchQuery, setSearchQuery] = React.useState("");
  const [progress, setProgress] = React.useState<CoursesProgressStore>(() =>
    loadCoursesProgress(),
  );
  const [syncStatus, setSyncStatus] = React.useState<
    "synced" | "saving" | "offline"
  >("synced");

  const upsertCourseMutation = api.courses.upsertCourse.useMutation({
    onMutate: () => setSyncStatus("saving"),
    onSuccess: () => setSyncStatus("synced"),
    onError: () => setSyncStatus("offline"),
  });

  const deleteCourseMutation = api.courses.deleteCourse.useMutation({
    onMutate: () => setSyncStatus("saving"),
    onSuccess: () => setSyncStatus("synced"),
    onError: () => setSyncStatus("offline"),
  });

  const restoreDefaultsMutation = api.courses.restoreDefaults.useMutation({
    onMutate: () => setSyncStatus("saving"),
    onSuccess: () => setSyncStatus("synced"),
    onError: () => setSyncStatus("offline"),
  });

  const saveProgressMutation = api.courses.saveProgress.useMutation({
    onMutate: () => setSyncStatus("saving"),
    onSuccess: () => setSyncStatus("synced"),
    onError: () => setSyncStatus("offline"),
  });

  api.courses.bootstrap.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    onSuccess: (data) => {
      const hydrated = hydrateCoursesFromCloud(
        data.customCourses,
        data.progressList,
      );
      setCustomCourses(hydrated.custom);
      setDeletedIds(hydrated.deleted);
      setProgress(hydrated.progress);
      setSyncStatus("synced");
    },
    onError: () => {
      setSyncStatus("offline");
    },
  });

  // Load lightweight built-in manifest once
  React.useEffect(() => {
    let active = true;
    fetch("/courses-data/manifest.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<CoursesManifest>;
      })
      .then((data) => {
        if (active) setBaseManifest(data);
      })
      .catch((err) => {
        if (active) {
          setManifestError(
            err instanceof Error
              ? err.message
              : "Failed to load courses catalog.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const manifest = React.useMemo(() => {
    if (!baseManifest) return null;
    return mergeManifestWithCustom(baseManifest, customCourses, deletedIds);
  }, [baseManifest, customCourses, deletedIds]);

  const builtinIds = React.useMemo(
    () => new Set((baseManifest?.courses ?? []).map((c) => c.id)),
    [baseManifest],
  );

  // Sync browser back/forward + Navbar / CommandMenu events
  React.useEffect(() => {
    const onPopState = () => {
      setEditingTarget(null);
      setRoute(parseCoursesLocation(window.location.pathname));
    };
    const onNav = (path: string) => {
      const parsed = parseCoursesLocation(path);
      window.history.pushState({}, "", path);
      setEditingTarget(null);
      setRoute(parsed);
    };
    const onSearch = (q: string) => setSearchQuery(q);

    window.addEventListener("popstate", onPopState);
    menuEventChannel.on("coursesNavigate", onNav);
    menuEventChannel.on("coursesSearchChange", onSearch);
    return () => {
      window.removeEventListener("popstate", onPopState);
      menuEventChannel.off("coursesNavigate", onNav);
      menuEventChannel.off("coursesSearchChange", onSearch);
    };
  }, []);

  const navigateTo = React.useCallback(
    (courseId?: string, lessonId?: string) => {
      const target = buildCoursesPath(courseId, lessonId);
      if (
        typeof window !== "undefined" &&
        window.location.pathname !== target
      ) {
        window.history.pushState({}, "", target);
      }
      setEditingTarget(null);
      setRoute({ courseId, lessonId });
    },
    [],
  );

  const loadCourseDetailById = React.useCallback(
    async (cid: string): Promise<CourseDetail> => {
      if (customCourses[cid]) return customCourses[cid]!;
      if (courseCache[cid]) return courseCache[cid]!;
      const res = await fetch(`/courses-data/${encodeURIComponent(cid)}.json`);
      if (!res.ok) throw new Error(`Course not found (${res.status})`);
      const detail = (await res.json()) as CourseDetail;
      setCourseCache((prev) => ({ ...prev, [cid]: detail }));
      return detail;
    },
    [customCourses, courseCache],
  );

  // Fetch selected course JSON on demand if not in customCourses/cache
  React.useEffect(() => {
    const cid = route.courseId;
    if (!cid || customCourses[cid] || courseCache[cid]) {
      setCourseError(null);
      return;
    }

    let active = true;
    setLoadingCourseId(cid);
    setCourseError(null);

    fetch(`/courses-data/${encodeURIComponent(cid)}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Course not found (${res.status})`);
        return res.json() as Promise<CourseDetail>;
      })
      .then((detail) => {
        if (!active) return;
        setCourseCache((prev) => ({ ...prev, [cid]: detail }));
      })
      .catch((err) => {
        if (!active) return;
        setCourseError(
          err instanceof Error ? err.message : "Failed to load course data.",
        );
      })
      .finally(() => {
        if (active) setLoadingCourseId(null);
      });

    return () => {
      active = false;
    };
  }, [route.courseId, customCourses, courseCache]);

  const activeCourse = route.courseId
    ? customCourses[route.courseId] ?? courseCache[route.courseId]
    : undefined;

  const resolvedLessonId = React.useMemo(() => {
    if (!activeCourse) return undefined;
    const allIds = activeCourse.chapters.flatMap((ch) =>
      ch.lessons.map((l) => l.id),
    );
    if (route.lessonId && allIds.includes(route.lessonId)) {
      return route.lessonId;
    }
    const saved = getCourseProgress(progress, activeCourse.id).lastLessonId;
    if (saved && allIds.includes(saved)) return saved;
    return allIds[0];
  }, [activeCourse, route.lessonId, progress]);

  React.useEffect(() => {
    if (activeCourse && resolvedLessonId) {
      setProgress((prev) =>
        setLastVisitedLesson(prev, activeCourse.id, resolvedLessonId),
      );
    }
  }, [activeCourse, resolvedLessonId]);

  const syncCourseProgress = React.useCallback(
    (nextStore: CoursesProgressStore, cid: string) => {
      const state = getCourseProgress(nextStore, cid);
      saveProgressMutation.mutate({
        courseId: cid,
        state: state as unknown as Record<string, unknown>,
      });
    },
    [saveProgressMutation],
  );

  const handleOpenCourse = (courseId: string, lessonId?: string) => {
    const targetLesson =
      lessonId ?? getCourseProgress(progress, courseId).lastLessonId;
    navigateTo(courseId, targetLesson);
  };

  const handleToggleComplete = (lessonId: string, force?: boolean) => {
    if (!activeCourse) return;
    setProgress((prev) => {
      const next = toggleLessonCompleted(
        prev,
        activeCourse.id,
        lessonId,
        force,
      );
      syncCourseProgress(next, activeCourse.id);
      return next;
    });
  };

  const handleSaveQuiz = (lessonId: string, state: QuizLessonProgress) => {
    if (!activeCourse) return;
    setProgress((prev) => {
      const next = saveQuizState(prev, activeCourse.id, lessonId, state);
      syncCourseProgress(next, activeCourse.id);
      return next;
    });
  };

  const handleSavePracticeDraft = (lessonId: string, code: string) => {
    if (!activeCourse) return;
    setProgress((prev) =>
      savePracticeDraft(prev, activeCourse.id, lessonId, code),
    );
  };

  const handleCreateNew = () => {
    const starter: CourseDetail = normalizeCourseDetail({
      id: `course-${Date.now()}`,
      title: "New Custom Course",
      track: "Python",
      level: "Beginner",
      description: "Write or paste Markdown from AI to build this course.",
      estimatedHours: 3,
      chapterCount: 1,
      lessonCount: 1,
      stats: { theory: 1, practice: 0, quiz: 0, quizQuestions: 0 },
      isCustom: true,
      chapters: [
        {
          id: "ch-1",
          number: 1,
          title: "Getting Started",
          lessons: [
            {
              id: `lesson-${Date.now()}`,
              index: 1,
              globalIndex: 1,
              title: "Introduction",
              rawTitle: "Introduction",
              type: "theory",
              theory: {
                markdown:
                  "## Welcome\n\nWrite Markdown or paste text from AI here. Paste any image (`Ctrl+V`) to upload it to CDN automatically.",
                contentHtml:
                  '<h2 id="welcome">Welcome</h2><p>Write Markdown or paste text from AI here. Paste any image (<code>Ctrl+V</code>) to upload it to CDN automatically.</p>',
                headings: [{ id: "welcome", text: "Welcome", level: 2 }],
              },
            },
          ],
        },
      ],
    });
    setEditingTarget({ course: starter, isNew: true });
  };

  const handleEditCourse = async (courseId: string) => {
    try {
      const detail = await loadCourseDetailById(courseId);
      setEditingTarget({
        course: structuredClone(detail),
        isNew: false,
      });
    } catch (err) {
      toast({
        title: "Failed to open course editor",
        description: err instanceof Error ? err.message : undefined,
        status: "error",
      });
    }
  };

  const handleSaveEditedCourse = (updated: CourseDetail) => {
    const nextMap = saveCustomCourseLocal(updated);
    setCustomCourses(nextMap);
    setCourseCache((prev) => ({ ...prev, [updated.id]: updated }));
    setDeletedIds((prev) => prev.filter((id) => id !== updated.id));

    upsertCourseMutation.mutate({
      courseId: updated.id,
      title: updated.title,
      track: updated.track,
      level: updated.level,
      data: updated as unknown as Record<string, unknown>,
    });

    toast({
      title: "Course saved",
      description: `${updated.title} saved locally and syncing to cloud.`,
      status: "success",
      duration: 2500,
    });
    setEditingTarget(null);
    if (route.courseId) {
      navigateTo(updated.id, updated.chapters[0]?.lessons[0]?.id);
    }
  };

  const handleImportCourse = (imported: CourseDetail) => {
    const nextMap = saveCustomCourseLocal(imported);
    setCustomCourses(nextMap);
    setCourseCache((prev) => ({ ...prev, [imported.id]: imported }));
    setDeletedIds((prev) => prev.filter((id) => id !== imported.id));

    upsertCourseMutation.mutate({
      courseId: imported.id,
      title: imported.title,
      track: imported.track,
      level: imported.level,
      data: imported as unknown as Record<string, unknown>,
    });

    toast({
      title: "Course imported",
      description: `${imported.title} (${imported.lessonCount} lessons) added.`,
      status: "success",
    });
    navigateTo(imported.id, imported.chapters[0]?.lessons[0]?.id);
  };

  const handleExportCourse = async (courseId: string) => {
    try {
      const detail = await loadCourseDetailById(courseId);
      const blob = new Blob([JSON.stringify(detail, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${detail.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : undefined,
        status: "error",
      });
    }
  };

  const handleDeleteCourse = (
    courseId: string,
    title: string,
    isBuiltin: boolean,
  ) => {
    const res = deleteCourseLocal(courseId, isBuiltin);
    setCustomCourses(res.custom);
    setDeletedIds(res.deleted);
    deleteCourseMutation.mutate({ courseId });
    toast({
      title: isBuiltin ? `Hidden "${title}"` : `Deleted "${title}"`,
      status: "info",
      duration: 2500,
    });
    if (route.courseId === courseId) {
      navigateTo(undefined);
    }
  };

  const handleRestoreDefaults = () => {
    const nextDeleted = restoreDeletedCoursesLocal();
    setDeletedIds(nextDeleted);
    restoreDefaultsMutation.mutate();
    toast({
      title: "Built-in courses restored",
      status: "success",
      duration: 2500,
    });
  };

  if (manifestError) {
    return (
      <Center py={16} px={4}>
        <Alert status="error" maxW="lg" rounded="2xl">
          <AlertIcon />
          <Text fontSize="sm">{manifestError}</Text>
        </Alert>
      </Center>
    );
  }

  if (!manifest) {
    return (
      <Center py={20}>
        <Stack align="center" spacing={3}>
          <Spinner size="lg" color="blue.500" />
          <Text fontSize="sm" color="gray.500">
            Loading Data Courses...
          </Text>
        </Stack>
      </Center>
    );
  }

  if (editingTarget) {
    return (
      <CourseEditor
        initialCourse={editingTarget.course}
        isNew={editingTarget.isNew}
        onCancel={() => setEditingTarget(null)}
        onSave={handleSaveEditedCourse}
      />
    );
  }

  if (route.courseId) {
    if (courseError) {
      return (
        <Center py={16} px={4}>
          <Stack spacing={4} align="center">
            <Alert status="error" maxW="lg" rounded="2xl">
              <AlertIcon />
              <Text fontSize="sm">{courseError}</Text>
            </Alert>
            <Button onClick={() => navigateTo(undefined)} rounded="xl">
              Back to all courses
            </Button>
          </Stack>
        </Center>
      );
    }

    if (
      !activeCourse ||
      loadingCourseId === route.courseId ||
      !resolvedLessonId
    ) {
      return (
        <Center py={20}>
          <Stack align="center" spacing={3}>
            <Spinner size="lg" color="blue.500" />
            <Text fontSize="sm" color="gray.500">
              Opening course...
            </Text>
          </Stack>
        </Center>
      );
    }

    return (
      <CoursePlayer
        course={activeCourse}
        activeLessonId={resolvedLessonId}
        userProgress={getCourseProgress(progress, activeCourse.id)}
        onBackCatalog={() => navigateTo(undefined)}
        onSelectLesson={(lid) => navigateTo(activeCourse.id, lid)}
        onToggleComplete={handleToggleComplete}
        onSaveQuiz={handleSaveQuiz}
        onSavePracticeDraft={handleSavePracticeDraft}
        onEditCourse={() => void handleEditCourse(activeCourse.id)}
      />
    );
  }

  return (
    <Box>
      <CoursesCatalog
        manifest={manifest}
        progress={progress}
        searchQuery={searchQuery}
        builtinIds={builtinIds}
        hasDeletedBuiltins={deletedIds.length > 0}
        syncStatus={syncStatus}
        onSearchChange={(q) => {
          setSearchQuery(q);
          menuEventChannel.emit("coursesSearchChange", q);
        }}
        onOpenCourse={handleOpenCourse}
        onCreateNew={handleCreateNew}
        onOpenSmartImport={onImportOpen}
        onEditCourse={(cid) => void handleEditCourse(cid)}
        onExportCourse={(cid) => void handleExportCourse(cid)}
        onDeleteCourse={handleDeleteCourse}
        onRestoreDefaults={handleRestoreDefaults}
      />

      <SmartImportModal
        isOpen={isImportOpen}
        onClose={onImportClose}
        onImportCourse={handleImportCourse}
      />
    </Box>
  );
}
