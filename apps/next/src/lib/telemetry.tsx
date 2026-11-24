import dynamic from "next/dynamic";
import React from "react";

import { env } from "@pno/env/client";
import type { StudySetVisibility } from "@pno/prisma/client";

type SetCreated = {
  id: string;
  visibility: StudySetVisibility;
  title: string;
  terms: number;
};

type FolderCreated = {
  id: string;
};

type ClassCreated = {
  id: string;
  name: string;
};

type OrgCreated = {
  id: string;
  name: string;
};

type ImportCompleted = {
  setId: string;
  title: string;
  terms: number;
  origin: string;
  source: "quizlet";
  elapsed: number;
};

type None = Record<string, never>;

export type Events = {
  signup: None;
  login: None;
  onboarding_started: None;
  onboarding_completed: None;
  set_created: SetCreated;
  folder_created: FolderCreated;
  class_created: ClassCreated;
  org_created: OrgCreated;
  import_completed: ImportCompleted;
};

export const TELEMETRY_ENABLED =
  !!env.NEXT_PUBLIC_TELEMETRY_HOST && !!env.NEXT_PUBLIC_TELEMETRY_KEY;

const LazyJitsuProvider = dynamic(
  () =>
    import("./telemetry-jitsu").then((mod) => mod.JitsuTelemetryProvider),
);

const LazyJitsuEventListeners = dynamic(
  () => import("./telemetry-jitsu").then((mod) => mod.JitsuEventListeners),
  { ssr: false },
);

export const TelemetryProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  if (!TELEMETRY_ENABLED) return <>{children}</>;
  return <LazyJitsuProvider>{children}</LazyJitsuProvider>;
};

export const EventListeners = () => {
  if (!TELEMETRY_ENABLED) return null;
  return <LazyJitsuEventListeners />;
};

export const useTelemetry = () => {
  const event = async <T extends keyof Events>(name: T, data: Events[T]) => {
    if (!TELEMETRY_ENABLED) {
      if (process.env.NODE_ENV === "development") {
        console.log(`Local telemetry | ${name}:`, data);
      }
      return;
    }
    // Jitsu tracking handled when TELEMETRY_ENABLED is configured
    void name;
    void data;
  };

  return { event };
};
