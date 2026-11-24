import type React from "react";

import { useShortcut } from "@pno/lib/hooks/use-shortcut";

export interface ChoiceShortcutLayerProps {
  choose: (index: number) => void;
}

export const ChoiceShortcutLayer: React.FC<ChoiceShortcutLayerProps> = ({
  choose,
}) => {
  const safeChoose = (index: number) => {
    if (
      typeof document !== "undefined" &&
      document.querySelector('[role="dialog"]')
    )
      return;
    choose(index);
  };

  useShortcut(["1"], () => safeChoose(0), {
    ctrlKey: false,
    allowInput: true,
  });
  useShortcut(["2"], () => safeChoose(1), {
    ctrlKey: false,
    allowInput: true,
  });
  useShortcut(["3"], () => safeChoose(2), {
    ctrlKey: false,
    allowInput: true,
  });
  useShortcut(["4"], () => safeChoose(3), {
    ctrlKey: false,
    allowInput: true,
  });

  return null;
};
