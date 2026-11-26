import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import React from "react";

import { env } from "@pno/env/client";
import { avatarUrl } from "@pno/lib/avatar";
import { outfit } from "@pno/lib/chakra-theme";
import { APP_URL } from "@pno/lib/constants/url";
import { useShortcut } from "@pno/lib/hooks/use-shortcut";
import type { StudySetType, User } from "@pno/prisma/client";
import { api } from "@pno/trpc";

import {
  Avatar,
  Box,
  Center,
  Flex,
  HStack,
  Input,
  Kbd,
  Modal,
  ModalBody,
  ModalContent,
  ModalOverlay,
  Spinner,
  Stack,
  Text,
  useColorMode,
  useColorModeValue,
} from "@chakra-ui/react";

import {
  IconBook,
  IconBooks,
  IconBrain,
  IconCards,
  IconCloudDownload,
  IconCube,
  IconDatabase,
  IconDeviceGamepad2,
  IconEdit,
  IconFolder,
  IconFolderPlus,
  IconGhost3,
  IconHeadphones,
  IconHome,
  IconLink,
  IconMicrophone,
  IconMoon,
  IconPencil,
  IconPlanet,
  IconPlus,
  IconProgress,
  IconPuzzle,
  IconSchool,
  IconSearch,
  IconSettings,
  IconSun,
  IconTestPipe,
  IconUser,
} from "@tabler/icons-react";

import { menuEventChannel } from "../events/menu";
import { useDevActions } from "../hooks/use-dev-actions";
import { useIsTeacher } from "../hooks/use-is-teacher";
import { getAllSpeakingExams } from "../modules/ielts/data/speakingExams";
import { getAllWritingExams } from "../modules/ielts/data/writingExams";
import { getSavedExamSummary } from "../modules/ielts/utils/examProgress";
import {
  getAllExams,
  getExamCollection,
  isListeningExam,
} from "../modules/ielts/utils/storage";
import {
  getSavedWritingSummary,
  loadSpeakingProgress,
} from "../modules/ielts/utils/writingProgress";
import { plural } from "../utils/string";

export interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

type EntityType = "set" | "folder";

interface Entity {
  id: string;
  name: string;
  entityType: EntityType;
  author: Pick<User, "username" | "image">;
  type?: StudySetType;
  collaborators?: string[];
  viewedAt: Date;
}

export interface MenuOption {
  id?: string;
  icon: React.ReactNode;
  name: string;
  searchableName?: string;
  label?: string;
  action: (ctrl: boolean) => void | Promise<void>;
  sortableDate?: Date;
  entity?: Entity;
  shouldShow?: () => boolean;
  loadable?: boolean;
}

const normalizeSearch = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const CommandMenu: React.FC<CommandMenuProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const session = useSession();
  const devActions = useDevActions();
  const isTeacher = useIsTeacher();
  const { colorMode, toggleColorMode } = useColorMode();

  const dismiss = router.pathname == "/onboarding/command-menu";
  const isPortal = router.pathname === "/";
  const isIelts = router.pathname.startsWith("/ielts");
  const isCourses = router.pathname.startsWith("/courses");
  const isQuiz = !isPortal && !isIelts && !isCourses;

  const onSet = router.pathname == "/sets/[id]";
  const onSetSubpage = router.pathname.startsWith("/sets/[id]");
  const onFolder = router.pathname == "/profile/[username]/folders/[slug]";
  const currentSetId =
    onSetSubpage && typeof router.query.id === "string"
      ? router.query.id
      : undefined;

  const [loadingOptionId, setLoadingOptionId] = React.useState<string | null>(
    null,
  );

  const url = (id: string) => `${APP_URL}/_${id}`;
  const onShareSuccess = (id: string) => {
    void (async () => {
      await navigator.clipboard.writeText(url(id));
    })();
    setLoadingOptionId(null);
    onClose();
  };

  const getSetShareId = api.studySets.getShareId.useQuery(
    { studySetId: router.query.id as string },
    {
      enabled: false,
      refetchOnWindowFocus: false,
      onSuccess: onShareSuccess,
      onError: () => setLoadingOptionId(null),
    },
  );

  const getFolderShareId = api.folders.getShareId.useQuery(
    {
      idOrSlug: router.query.slug as string,
      username: ((router.query.username as string) || "").slice(1),
    },
    {
      enabled: false,
      refetchOnWindowFocus: false,
      onSuccess: onShareSuccess,
      onError: () => setLoadingOptionId(null),
    },
  );

  const recentQuery = api.recent.get.useQuery(undefined, {
    enabled: isOpen && !isIelts && !isCourses,
    refetchOnWindowFocus: false,
  });
  const isLoadingRecent = !isIelts && !isCourses && recentQuery.isInitialLoading;

  const openLink = React.useCallback(
    (link: string, ctrl: boolean) => {
      void (async () => {
        if (ctrl) {
          window.open(link, "_blank");
        } else {
          await router.push(link);
        }
      })();
    },
    [router],
  );

  const openIeltsPath = React.useCallback(
    (path: string, ctrl: boolean) => {
      void (async () => {
        if (ctrl) {
          window.open(path, "_blank");
        } else if (router.pathname.startsWith("/ielts")) {
          menuEventChannel.emit("ieltsNavigate", path);
        } else {
          await router.push(path);
        }
      })();
    },
    [router],
  );

  const triggerIeltsAction = React.useCallback(
    (
      actionName: "add_test" | "test_bank" | "new_collection",
      eventName:
        | "openIeltsManage"
        | "openIeltsAddTest"
        | "openIeltsTestBank"
        | "openIeltsNewCollection",
    ) => {
      if (router.pathname.startsWith("/ielts")) {
        menuEventChannel.emit(eventName);
      } else {
        const targetPath =
          actionName === "add_test"
            ? "/ielts/manage/tests?action=smart_import"
            : actionName === "new_collection"
              ? "/ielts/manage/collections?action=new_collection"
              : "/ielts/manage/tests";
        void router.push(targetPath);
      }
    },
    [router],
  );

  const options = React.useMemo<MenuOption[]>(() => {
    const buildEntityOptions = (): MenuOption[] => {
      const data = recentQuery.data;
      if (!data) return [];

      const items: MenuOption[] = [];

      for (const set of data.sets) {
        items.push({
          id: `set:${set.id}`,
          icon: <IconBooks />,
          name: set.title,
          searchableName: `${set.title} ${normalizeSearch(set.title)} quiz study set`,
          action: (ctrl) => openLink(`/${set.id}`, ctrl),
          sortableDate: set.viewedAt,
          entity: {
            id: set.id,
            name: set.title,
            entityType: "set",
            type: set.type,
            author: set.user,
            viewedAt: set.viewedAt,
            collaborators: set.collaborators?.avatars,
          },
          shouldShow: () =>
            typeof window !== "undefined"
              ? window.location.pathname !== `/${set.id}`
              : true,
        });
      }
      for (const folder of data.folders) {
        const folderUrl = `/@${folder.user.username}/folders/${
          folder.slug ?? folder.id
        }`;

        items.push({
          id: `folder:${folder.id}`,
          icon: <IconFolder />,
          name: folder.title,
          searchableName: `${folder.title} ${normalizeSearch(folder.title)} folder`,
          action: (ctrl) => openLink(folderUrl, ctrl),
          sortableDate: folder.viewedAt,
          entity: {
            id: folder.id,
            name: folder.title,
            entityType: "folder",
            author: folder.user,
            viewedAt: folder.viewedAt,
          },
          shouldShow: () =>
            typeof window !== "undefined"
              ? !window.location.pathname.startsWith(folderUrl)
              : true,
        });
      }
      for (const draft of data.drafts) {
        items.push({
          id: `draft:${draft.id}`,
          icon: <IconProgress />,
          name: draft.title || "Untitled draft",
          searchableName: `${draft.title} ${normalizeSearch(draft.title || "")} draft`,
          action: (ctrl) => openLink(`/${draft.id}/create`, ctrl),
          sortableDate: draft.savedAt,
          entity: {
            id: draft.id,
            name: draft.title,
            entityType: "set",
            author: draft.user,
            viewedAt: draft.savedAt,
          },
          shouldShow: () => {
            if (typeof window === "undefined") return true;
            const path = window.location.pathname;
            if (path == `/${draft.id}/create`) return false;
            if (path == "/create") {
              const latest = [...data.drafts].sort(
                (a, b) =>
                  new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
              )[0];
              if (latest?.id == draft.id) return false;
            }
            return true;
          },
        });
      }
      for (const class_ of data.classes) {
        const classUrl = `/classes/${class_.id}`;

        items.push({
          id: `class:${class_.id}`,
          icon: <IconSchool />,
          name: class_.name,
          label:
            class_._count.members !== undefined
              ? `${plural(class_._count.members || 0, "student")} · ${plural(
                  class_._count.sections || 0,
                  "section",
                )}`
              : `${plural(class_._count.studySets || 0, "set")} · ${plural(
                  class_._count.folders || 0,
                  "folder",
                )}`,
          sortableDate: class_.viewedAt || undefined,
          searchableName: `${class_.name} ${normalizeSearch(class_.name)} class`,
          action: (ctrl) => openLink(classUrl, ctrl),
          shouldShow: () =>
            typeof window !== "undefined"
              ? !window.location.pathname.startsWith(classUrl)
              : true,
        });
      }

      return items.sort(
        (a, b) =>
          (b.sortableDate ? new Date(b.sortableDate).getTime() : 0) -
          (a.sortableDate ? new Date(a.sortableDate).getTime() : 0),
      );
    };

    const buildIeltsOptions = (): MenuOption[] => {
      if (typeof window === "undefined") return [];
      const items: Array<MenuOption & { inProgress: boolean }> = [];

      try {
        for (const exam of getAllExams()) {
          const isListen = isListeningExam(exam);
          const skill = isListen ? "listening" : "reading";
          const col = getExamCollection(exam);
          const saved = getSavedExamSummary(exam.id);
          const path = `/ielts/${skill}/${encodeURIComponent(exam.id)}/part/${
            saved?.activePartNumber ?? 1
          }`;

          items.push({
            id: `ielts:${skill}:${exam.id}`,
            icon: isListen ? <IconHeadphones /> : <IconBook />,
            name: exam.title,
            label: `IELTS ${isListen ? "Listening" : "Reading"} · ${col}${
              saved ? " · In Progress" : ""
            }`,
            searchableName: `${exam.title} ${col} ielts ${skill}`,
            action: (ctrl) => openIeltsPath(path, ctrl),
            inProgress: Boolean(saved),
          });
        }

        for (const w of getAllWritingExams()) {
          const saved = getSavedWritingSummary(w.id);
          const path = `/ielts/writing/${encodeURIComponent(w.id)}`;
          items.push({
            id: `ielts:writing:${w.id}`,
            icon: <IconPencil />,
            name: w.title,
            label: `IELTS Writing · ${w.collection || "Writing"}${
              saved ? " · In Progress" : ""
            }`,
            searchableName: `${w.title} ${w.collection || ""} ielts writing`,
            action: (ctrl) => openIeltsPath(path, ctrl),
            inProgress: Boolean(saved),
          });
        }

        for (const s of getAllSpeakingExams()) {
          const saved = loadSpeakingProgress(s.id);
          const path = `/ielts/speaking/${encodeURIComponent(s.id)}`;
          items.push({
            id: `ielts:speaking:${s.id}`,
            icon: <IconMicrophone />,
            name: s.title,
            label: `IELTS Speaking · ${s.collection || "Speaking"}${
              saved ? " · In Progress" : ""
            }`,
            searchableName: `${s.title} ${s.collection || ""} ielts speaking`,
            action: (ctrl) => openIeltsPath(path, ctrl),
            inProgress: Boolean(saved),
          });
        }
      } catch {
        // Ignore storage read errors
      }

      // Sort in-progress exams first while keeping relative order within each group
      items.sort((a, b) => Number(b.inProgress) - Number(a.inProgress));
      return items.map(({ inProgress: _inProgress, ...rest }) => rest);
    };

    const setModeOptions: MenuOption[] = [];
    if (isQuiz && currentSetId) {
      const setModes: Array<{
        path: string;
        name: string;
        label: string;
        icon: React.ReactNode;
      }> = [
        {
          path: `/${currentSetId}`,
          name: "Set Overview",
          label: "View terms & study options",
          icon: <IconBooks />,
        },
        {
          path: `/${currentSetId}/flashcards`,
          name: "Study Flashcards",
          label: "Open Flashcards mode for this set",
          icon: <IconCards />,
        },
        {
          path: `/${currentSetId}/learn`,
          name: "Adaptive Learn",
          label: "Open Learn mode for this set",
          icon: <IconBrain />,
        },
        {
          path: `/${currentSetId}/test`,
          name: "Practice Test",
          label: "Open Test mode for this set",
          icon: <IconTestPipe />,
        },
        {
          path: `/${currentSetId}/match`,
          name: "Match Game",
          label: "Open Match mode for this set",
          icon: <IconDeviceGamepad2 />,
        },
        {
          path: `/${currentSetId}/blocks`,
          name: "Blocks Puzzle",
          label: "Open Blocks puzzle game for this set",
          icon: <IconCube />,
        },
        {
          path: `/${currentSetId}/crossword`,
          name: "Crossword",
          label: "Open Crossword mode for this set",
          icon: <IconPuzzle />,
        },
        {
          path: `/${currentSetId}/gravity`,
          name: "Gravity",
          label: "Open Gravity mode for this set",
          icon: <IconPlanet />,
        },
        {
          path: `/${currentSetId}/anki`,
          name: "Anki SRS Review",
          label: "Open Spaced Repetition mode for this set",
          icon: <IconBrain />,
        },
        {
          path: `/${currentSetId}/edit`,
          name: "Edit Study Set",
          label: "Add or modify terms in this set",
          icon: <IconEdit />,
        },
      ];

      for (const m of setModes) {
        setModeOptions.push({
          id: `mode:${m.path}`,
          icon: m.icon,
          name: m.name,
          label: m.label,
          searchableName: `${m.name} ${m.label} mode`,
          action: (ctrl) => openLink(m.path, ctrl),
          shouldShow: () =>
            typeof window !== "undefined"
              ? window.location.pathname !== m.path
              : true,
        });
      }
    }

    const quizNavOption: MenuOption = {
      id: "nav:home",
      icon: <IconHome />,
      name: "Quiz Dashboard",
      label: isIelts
        ? "Switch workspace to Quiz, Anki & Flashcards"
        : "View your Quiz sets, Anki decks & folders",
      searchableName: isIelts
        ? "Quiz Dashboard Switch Workspace"
        : "Quiz Dashboard Home Sets Anki",
      action: (ctrl) => openLink(`/home`, ctrl),
      shouldShow: () =>
        typeof window !== "undefined"
          ? window.location.pathname !== "/home"
          : true,
    };

    const ieltsNavOption: MenuOption = {
      id: "nav:ielts",
      icon: <IconSchool />,
      name: isIelts ? "IELTS Home" : "IELTS Practice",
      label: isIelts
        ? "Return to IELTS exam dashboard"
        : isQuiz
          ? "Switch workspace to 4-skill IELTS exam suite"
          : "Open 4-skill IELTS exam suite",
      searchableName: "IELTS Home Practice Reading Listening Writing Speaking",
      action: (ctrl) => openIeltsPath(`/ielts`, ctrl),
      shouldShow: () =>
        typeof window !== "undefined"
          ? window.location.pathname !== "/ielts"
          : true,
    };

    const coursesNavOption: MenuOption = {
      id: "nav:courses",
      icon: <IconDatabase />,
      name: isCourses ? "Data Courses Catalog" : "Data Courses (XómData)",
      label: isCourses
        ? "Browse all 16 interactive Python, SQL, R, Git, JS & Excel courses"
        : "Switch workspace to interactive Data Courses",
      searchableName:
        "Data Courses XomData Python SQL R Git JavaScript Excel Interactive",
      action: (ctrl) => openLink(`/courses`, ctrl),
      shouldShow: () =>
        typeof window !== "undefined"
          ? window.location.pathname !== "/courses"
          : true,
    };

    const portalNavOption: MenuOption = {
      id: "nav:portal",
      icon: <IconHome />,
      name: "PNO Portal",
      label: "Switch between Quiz, IELTS and Data Courses",
      searchableName: "PNO Portal Home Switch Workspace",
      action: (ctrl) => openLink(`/`, ctrl),
      shouldShow: () =>
        typeof window !== "undefined" ? window.location.pathname !== "/" : true,
    };

    const accountOptions: MenuOption[] = [
      {
        id: "nav:profile",
        icon: <IconUser />,
        name: "Profile",
        label: "Navigate to your profile",
        action: (ctrl) =>
          openLink(`/@${session.data?.user?.username || ""}`, ctrl),
        shouldShow: () =>
          typeof window !== "undefined"
            ? window.location.pathname !==
              `/@${session.data?.user?.username || ""}`
            : true,
      },
      {
        id: "nav:settings",
        icon: <IconSettings />,
        name: "Settings",
        label: "Navigate to settings",
        action: (ctrl) => openLink(`/settings`, ctrl),
        shouldShow: () =>
          typeof window !== "undefined"
            ? window.location.pathname !== "/settings"
            : true,
      },
      {
        id: "action:toggle-theme",
        icon: colorMode == "dark" ? <IconSun /> : <IconMoon />,
        name: "Toggle Theme",
        label: `Switch to ${colorMode == "dark" ? "light" : "dark"} mode`,
        action: toggleColorMode,
      },
    ];

    const quizActions: MenuOption[] = [
      {
        id: "action:create-set",
        icon: <IconPlus />,
        name: "Create Study Set",
        label: "Create a new vocabulary study set",
        action: (ctrl) => openLink(`/create`, ctrl),
        shouldShow: () =>
          typeof window !== "undefined"
            ? window.location.pathname !== "/create"
            : true,
      },
      {
        id: "action:create-anki-deck",
        icon: <IconBrain />,
        name: "Create Anki Deck (SRS)",
        label: "Custom Fields & HTML/CSS Template",
        action: () => menuEventChannel.emit("openCreateAnkiDeck"),
      },
      {
        id: "action:import-quizlet",
        icon: <IconCloudDownload />,
        name: "Import From Quizlet",
        label: "Import a study set from Quizlet.com",
        action: () => menuEventChannel.emit("openImportDialog"),
      },
      {
        id: "action:import-anki",
        icon: <IconCloudDownload />,
        name: "Import From Anki (.apkg)",
        label: "Import an Anki deck with media & SRS",
        action: () => menuEventChannel.emit("openAnkiImportDialog"),
      },
      {
        id: "action:create-folder",
        icon: <IconFolderPlus />,
        name: "Create Folder",
        label: "Create a new study folder",
        action: () => menuEventChannel.emit("createFolder"),
      },
      ...(isTeacher
        ? [
            {
              id: "action:create-class",
              icon: <IconPlus />,
              name: "Create Class",
              label: "Create a new class",
              action: () => menuEventChannel.emit("createClass"),
            },
          ]
        : []),
    ];

    const ieltsActions: MenuOption[] = [
      {
        id: "action:ielts-add",
        icon: <IconPlus />,
        name: "Add IELTS Test (4 Skills)",
        label: "Import or create a new Reading, Listening, Writing or Speaking test",
        action: () => triggerIeltsAction("add_test", "openIeltsAddTest"),
      },
      {
        id: "action:ielts-bank",
        icon: <IconDatabase />,
        name: "Manage IELTS Library (CRUD)",
        label: "Create, edit, rename, move & delete IELTS tests and collections",
        action: () => triggerIeltsAction("test_bank", "openIeltsManage"),
      },
      {
        id: "action:ielts-col",
        icon: <IconFolderPlus />,
        name: "New IELTS Collection",
        label: "Create a collection folder in IELTS",
        action: () =>
          triggerIeltsAction("new_collection", "openIeltsNewCollection"),
      },
    ];

    const total: MenuOption[] = [];

    if (isIelts) {
      total.push(...buildIeltsOptions());
      total.push(...ieltsActions);
      total.push(ieltsNavOption, coursesNavOption, quizNavOption, portalNavOption);
      total.push(...accountOptions);
    } else if (isCourses) {
      total.push(coursesNavOption, quizNavOption, ieltsNavOption, portalNavOption);
      total.push(...accountOptions);
    } else if (isQuiz) {
      total.push(...setModeOptions);
      if (onSet || onFolder) {
        total.push({
          id: "action:copy-link",
          icon: <IconLink />,
          name: "Copy Link",
          label: `Copy the URL for this ${onSet ? "set" : "folder"}`,
          action: async () => {
            setLoadingOptionId("action:copy-link");
            if (onSet) await getSetShareId.refetch();
            if (onFolder) await getFolderShareId.refetch();
          },
          loadable: true,
        });
      }
      total.push(...buildEntityOptions());
      total.push(...quizActions);
      total.push(quizNavOption, ieltsNavOption, coursesNavOption, portalNavOption);
      total.push(...accountOptions);
    } else {
      // Portal (/): all workspaces + recent sets + IELTS tests + quick actions
      total.push(quizNavOption, ieltsNavOption, coursesNavOption);
      total.push(...buildEntityOptions());
      total.push(...buildIeltsOptions());
      total.push(...quizActions, ...ieltsActions);
      total.push(...accountOptions);
    }

    if (env.NEXT_PUBLIC_DEPLOYMENT === undefined) total.push(...devActions);

    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    isPortal,
    isIelts,
    isCourses,
    isQuiz,
    recentQuery.data,
    currentSetId,
    onSet,
    onFolder,
    colorMode,
    isTeacher,
    session.data?.user?.username,
    devActions,
    openLink,
    openIeltsPath,
    triggerIeltsAction,
    toggleColorMode,
  ]);

  const [query, setQuery] = React.useState("");
  const [selectionIndex, setSelectionIndex] = React.useState(0);
  const [ignoreMouse, setIgnoreMouse] = React.useState(false);

  const normalizedQuery = normalizeSearch(query.trim());
  const filteredOptions: MenuOption[] = React.useMemo(
    () =>
      options
        .filter((o) => (o.shouldShow ? o.shouldShow() : true))
        .filter((e) => {
          if (!normalizedQuery) return true;
          const haystack = normalizeSearch(
            `${e.searchableName ?? e.name} ${e.label ?? ""}`,
          );
          return haystack.includes(normalizedQuery);
        }),
    [options, normalizedQuery],
  );

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const resultsRef = React.useRef<(HTMLDivElement | null)[]>([]);

  React.useEffect(() => {
    resultsRef.current = resultsRef.current.slice(0, filteredOptions.length);
  }, [filteredOptions.length]);

  React.useEffect(() => {
    setSelectionIndex(0);
  }, [filteredOptions.length]);

  React.useEffect(() => {
    if (isOpen) {
      setQuery("");
      setLoadingOptionId(null);
    }
    setSelectionIndex(0);
  }, [isOpen]);

  const onSubmit = (i: number, ctrl: boolean) => {
    const option = filteredOptions[i];
    if (!option) return;

    if (!dismiss || option.name == "Toggle Theme") {
      void (async () => {
        await option.action(ctrl);
      })();
    }

    if (option.loadable) {
      return;
    }
    onClose();
  };

  const borderColor = useColorModeValue("gray.200", "gray.750");
  const cursorBg = useColorModeValue(
    "rgba(226, 232, 240, 0.65)",
    "rgba(45, 55, 72, 0.65)",
  );
  const hintBg = useColorModeValue(
    "rgba(237, 242, 247, 0.55)",
    "rgba(26, 32, 44, 0.55)",
  );
  const hintColor = useColorModeValue("gray.600", "gray.400");

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay
        backdropFilter="blur(12px)"
        transform="translateZ(0px)"
        backgroundColor={useColorModeValue(
          "rgba(247, 250, 252, 0.72)",
          "rgba(23, 25, 35, 0.55)",
        )}
      />
      <ModalContent
        my={{ base: 3, sm: "12vh" }}
        mx={{ base: 3, sm: 4 }}
        background={useColorModeValue(
          "rgba(247, 250, 252, 0.85)",
          "rgba(23, 25, 35, 0.84)",
        )}
        backdropFilter="blur(16px)"
        borderWidth="2px"
        rounded="2xl"
        borderColor={borderColor}
        shadow="2xl"
        overflow="hidden"
      >
        <ModalBody p="0">
          {isOpen && (
            <ShortcutsManager
              filteredOptions={filteredOptions}
              selectionIndex={selectionIndex}
              setSelectionIndex={setSelectionIndex}
              setIgnoreMouse={setIgnoreMouse}
              resultsRef={resultsRef}
              scrollRef={scrollRef}
              onSubmit={(ctrl) => onSubmit(selectionIndex, ctrl)}
            />
          )}
          <HStack
            py={{ base: 3, sm: 4 }}
            px={{ base: 4, sm: 6 }}
            spacing="3.5"
            borderBottomWidth="2px"
            borderBottomColor={borderColor}
          >
            <Box color="gray.400" flexShrink={0}>
              <IconSearch size={22} />
            </Box>
            <Input
              aria-label="Search commands, study sets, and IELTS tests"
              placeholder={
                isIelts
                  ? "Search IELTS tests, skills, or commands..."
                  : isQuiz
                    ? "Search study sets, folders, or commands..."
                    : "Search study sets, IELTS tests, or commands..."
              }
              size="lg"
              variant="unstyled"
              fontSize={{ base: "md", sm: "xl" }}
              fontWeight={600}
              px="0"
              _placeholder={{
                color: "gray.500",
                fontWeight: 500,
              }}
              color={useColorModeValue("gray.900", "whiteAlpha.900")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </HStack>
          <Box
            overflow={filteredOptions.length > 6 ? "auto" : "hidden"}
            maxH={{ base: "52dvh", sm: "none" }}
            px={{ base: 2.5, sm: 4 }}
            my="3"
            pos="relative"
            transition="height cubic-bezier(.4,0,.2,1) 250ms"
            style={{
              height:
                isLoadingRecent && !filteredOptions.length
                  ? 72
                  : filteredOptions.length === 0
                    ? 88
                    : 72 * Math.min(filteredOptions.length, 6),
            }}
            ref={scrollRef}
          >
            {!!filteredOptions.length && (
              <Box
                pos="absolute"
                h="72px"
                w="full"
                top="0"
                left="0"
                px="4"
                pointerEvents="none"
                transition="transform cubic-bezier(.4,0,.2,1) 200ms"
                style={{
                  transform: `translateY(${selectionIndex * 72}px)`,
                }}
              >
                <Box bg={cursorBg} rounded="xl" w="full" h="full" />
              </Box>
            )}
            {isLoadingRecent && !filteredOptions.length && (
              <Center w="full" h="16">
                <Spinner color="blue.300" />
              </Center>
            )}
            {!isLoadingRecent && filteredOptions.length === 0 && (
              <Center w="full" h="full" flexDir="column" gap={1}>
                <Text fontSize="sm" fontWeight={700} color={hintColor}>
                  No results found for &ldquo;{query}&rdquo;
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {isIelts
                    ? "Try searching Reading, Listening, Writing, Speaking tests or IELTS actions."
                    : isQuiz
                      ? "Try searching a study set, folder, study mode, or Quiz action."
                      : "Try searching a study set, IELTS test, or workspace action."}
                </Text>
              </Center>
            )}
            {filteredOptions.map((o, i) => (
              <OptionComp
                key={o.id ?? `${o.name}-${i}`}
                index={i}
                icon={o.icon}
                name={o.name}
                label={o.label}
                type={o.entity?.type}
                author={o.entity?.author}
                collaborators={o.entity?.collaborators}
                resultsRef={resultsRef}
                selectionIndex={selectionIndex}
                setSelectionIndex={setSelectionIndex}
                isLoading={Boolean(o.id && loadingOptionId === o.id)}
                ignoreMouse={ignoreMouse}
                setIgnoreMouse={setIgnoreMouse}
                onClick={(e) => onSubmit(i, e.ctrlKey || e.metaKey)}
              />
            ))}
          </Box>
          <Flex
            px="6"
            py="2.5"
            bg={hintBg}
            borderTopWidth="1px"
            borderTopColor={borderColor}
            justify="space-between"
            align="center"
            fontSize="xs"
            color={hintColor}
            display={{ base: "none", sm: "flex" }}
          >
            <HStack spacing={4}>
              <HStack spacing={1.5}>
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                <Text>Navigate</Text>
              </HStack>
              <HStack spacing={1.5}>
                <Kbd>↵</Kbd>
                <Text>Open</Text>
              </HStack>
              <HStack spacing={1.5}>
                <Kbd>Ctrl</Kbd>
                <Kbd>↵</Kbd>
                <Text>New tab</Text>
              </HStack>
            </HStack>
            <HStack spacing={1.5}>
              <Kbd>Esc</Kbd>
              <Text>Close</Text>
            </HStack>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

interface OptionCompProps {
  index: number;
  icon: React.ReactNode;
  name: string;
  type?: StudySetType;
  author?: Pick<User, "username" | "image">;
  collaborators?: string[];
  label?: string;
  resultsRef: React.MutableRefObject<(HTMLDivElement | null)[]>;
  selectionIndex: number;
  setSelectionIndex: React.Dispatch<React.SetStateAction<number>>;
  isLoading?: boolean;
  ignoreMouse: boolean;
  setIgnoreMouse: React.Dispatch<React.SetStateAction<boolean>>;
  onClick: React.MouseEventHandler<HTMLDivElement>;
}

const OptionComp: React.FC<OptionCompProps> = ({
  index,
  icon,
  name,
  type,
  author,
  collaborators,
  label,
  resultsRef,
  selectionIndex,
  setSelectionIndex,
  ignoreMouse,
  isLoading,
  setIgnoreMouse,
  onClick,
}) => {
  const baseText = useColorModeValue("gray.600", "whiteAlpha.700");
  const highlightText = useColorModeValue("gray.900", "whiteAlpha.900");
  const baseColor = useColorModeValue("gray.500", "gray.400");
  const highlightColor = useColorModeValue("gray.900", "gray.50");

  return (
    <Flex
      alignItems="center"
      p="4"
      ref={(el) => (resultsRef.current[index] = el)}
      gap="4"
      h="72px"
      pos="relative"
      cursor="pointer"
      w="full"
      onPointerEnter={() => {
        if (!ignoreMouse) setSelectionIndex(index);
      }}
      onPointerMove={() => {
        setIgnoreMouse(false);
        setSelectionIndex(index);
      }}
      onClick={onClick}
    >
      <Box
        transition="all cubic-bezier(.4,0,.2,1) 300ms"
        color={selectionIndex == index ? highlightColor : baseColor}
        transform={
          selectionIndex == index
            ? "rotate(-10deg) scale(1.1)"
            : "rotate(0deg) scale(1)"
        }
      >
        {!isLoading ? (
          icon
        ) : (
          <Center boxSize="6">
            <Spinner boxSize="4" />
          </Center>
        )}
      </Box>
      <Stack spacing={1} w="full" overflow="hidden">
        <Text
          fontSize="lg"
          fontWeight={600}
          fontFamily={outfit.style.fontFamily}
          whiteSpace="nowrap"
          overflow="hidden"
          textOverflow="ellipsis"
          transition="color cubic-bezier(.4,0,.2,1) 300ms"
          color={selectionIndex === index ? highlightText : baseText}
        >
          {name}
        </Text>
        {author && type == "Default" ? (
          <HStack>
            <Avatar
              src={avatarUrl(author)}
              size="2xs"
              className="highlight-block"
            />
            <Text fontSize="xs" color={baseText} className="highlight-block">
              {author.username}
            </Text>
          </HStack>
        ) : type == "Collab" ? (
          !!collaborators?.length ? (
            <HStack spacing="0">
              <svg
                width="0"
                height="0"
                viewBox="0 0 16 16"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <mask id="avatarClip">
                    <circle cx="8" cy="8" r="8" fill="white" />
                    <circle cx="22" cy="8" r="10" fill="black" />
                  </mask>
                  <mask id="defaultAvatar">
                    <circle cx="8" cy="8" r="8" fill="white" />
                  </mask>
                </defs>
              </svg>
              {collaborators.map((c, i) => (
                <Avatar
                  key={i}
                  src={c}
                  width="16px"
                  height="16px"
                  bg="gray.300"
                  _dark={{
                    bg: "gray.600",
                  }}
                  icon={<></>}
                  style={{
                    borderRadius: 0,
                    width: "16px",
                    height: "16px",
                    marginLeft: i != 0 ? "-2px" : 0,
                    mask:
                      i < collaborators.length - 1
                        ? "url(#avatarClip)"
                        : "url(#defaultAvatar)",
                  }}
                />
              ))}
            </HStack>
          ) : (
            <HStack spacing="1" color={baseText}>
              <IconGhost3 size={16} />
              <Text fontSize="xs">No collaborators yet</Text>
            </HStack>
          )
        ) : (
          ""
        )}
        {label && (
          <Text fontSize="xs" color={baseText} noOfLines={1}>
            {label}
          </Text>
        )}
      </Stack>
    </Flex>
  );
};

interface ShortcutsManagerProps {
  filteredOptions: MenuOption[];
  selectionIndex: number;
  setSelectionIndex: React.Dispatch<React.SetStateAction<number>>;
  setIgnoreMouse: React.Dispatch<React.SetStateAction<boolean>>;
  resultsRef: React.MutableRefObject<(HTMLDivElement | null)[]>;
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
  onSubmit: (ctrl: boolean) => void;
}

const ShortcutsManager: React.FC<ShortcutsManagerProps> = ({
  filteredOptions: filteredEvents,
  selectionIndex,
  setSelectionIndex,
  setIgnoreMouse,
  resultsRef,
  scrollRef,
  onSubmit,
}) => {
  const isScrolledIntoView = (el: HTMLDivElement | null) => {
    const container = scrollRef.current;
    if (!el || !container) return true;

    const rect = el.getBoundingClientRect();
    const { bottom, top } = rect;
    let { height } = rect;

    const containerRect = container.getBoundingClientRect();
    height = height - 72;

    return top <= containerRect.top
      ? containerRect.top - top <= height
      : bottom - containerRect.bottom <= height;
  };

  useShortcut(
    ["ArrowDown", "Tab"],
    () => {
      if (!filteredEvents.length) return;

      setIgnoreMouse(true);
      setSelectionIndex((i) => {
        const next = i < filteredEvents.length - 1 ? i + 1 : 0;
        const targetEl = resultsRef.current[next] ?? null;
        if (targetEl && !isScrolledIntoView(targetEl)) {
          targetEl.scrollIntoView(false);
        }
        return next;
      });
    },
    {
      ctrlKey: false,
      shiftKey: false,
    },
  );

  const up = () => {
    if (!filteredEvents.length) return;

    setIgnoreMouse(true);
    setSelectionIndex((i) => {
      const next = i > 0 ? i - 1 : filteredEvents.length - 1;
      const scrollTo =
        next == filteredEvents.length - 1
          ? next
          : Math.max(selectionIndex - 1, 0);

      const targetEl = resultsRef.current[scrollTo] ?? null;
      if (targetEl && !isScrolledIntoView(targetEl)) {
        targetEl.scrollIntoView();
      }
      return next;
    });
  };

  useShortcut(["ArrowUp"], up, {
    ctrlKey: false,
  });
  useShortcut(["Tab"], up, {
    ctrlKey: false,
    shiftKey: "Tab",
  });

  useShortcut(
    ["Enter"],
    () => {
      if (filteredEvents.length) onSubmit(false);
    },
    {
      ctrlKey: false,
    },
  );
  useShortcut(
    ["Enter"],
    () => {
      if (filteredEvents.length) onSubmit(true);
    },
    {
      ctrlKey: true,
    },
  );

  return null;
};
