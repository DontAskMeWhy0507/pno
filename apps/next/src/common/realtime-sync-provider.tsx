import { useSession } from "next-auth/react";
import React from "react";

import { type RouterOutputs, api } from "@pno/trpc";

import { readRecentCache } from "../lib/local-query-cache";
import { subscribeSync } from "../lib/sync-bus";

type RecentOutput = RouterOutputs["recent"]["get"];

export default function RealtimeSyncProvider() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const utils = api.useContext();

  const [isVisible, setIsVisible] = React.useState(() =>
    typeof document === "undefined"
      ? true
      : document.visibilityState === "visible",
  );

  const seededRecentUserRef = React.useRef<string | null>(null);
  const prevQuizVersionRef = React.useRef<string | null>(null);
  const prevIeltsVersionRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // Layer 1: Seed recent.get cache from localStorage on client mount (post-hydration)
  React.useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    if (seededRecentUserRef.current === userId) return;
    seededRecentUserRef.current = userId;

    if (!utils.recent.get.getData()) {
      const cached = readRecentCache<RecentOutput>(userId);
      if (cached?.data) {
        utils.recent.get.setData(undefined, cached.data);
        void utils.recent.get.invalidate();
      }
    }
  }, [status, userId, utils]);

  // Layer 3: Cross-device lightweight version pulse while tab is visible
  const versionsQuery = api.sync.versions.useQuery(undefined, {
    enabled: status === "authenticated" && isVisible,
    refetchInterval: isVisible ? 10_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 5_000,
  });

  React.useEffect(() => {
    const versions = versionsQuery.data;
    if (!versions) return;

    if (
      prevQuizVersionRef.current !== null &&
      prevQuizVersionRef.current !== versions.quizVersion
    ) {
      void utils.recent.get.invalidate();
      void utils.studySets.byId.invalidate();
    }
    prevQuizVersionRef.current = versions.quizVersion;

    if (
      prevIeltsVersionRef.current !== null &&
      prevIeltsVersionRef.current !== versions.ieltsVersion
    ) {
      void utils.ielts.bootstrap.invalidate();
    }
    prevIeltsVersionRef.current = versions.ieltsVersion;
  }, [versionsQuery.data, utils]);

  // Layer 3: Cross-tab instant sync via BroadcastChannel
  React.useEffect(() => {
    if (status !== "authenticated") return;
    return subscribeSync((msg) => {
      if (msg.scope === "quiz" || msg.scope === "all") {
        void utils.recent.get.invalidate();
        if (msg.entityId) {
          void utils.studySets.byId.invalidate({ studySetId: msg.entityId });
        } else {
          void utils.studySets.byId.invalidate();
        }
      }
      if (msg.scope === "ielts" || msg.scope === "all") {
        void utils.ielts.bootstrap.invalidate();
      }
    });
  }, [status, utils]);

  return null;
}
