import { useShortcut } from "@quenti/lib/hooks/use-shortcut";

export const AnyKeyPressLayer = ({ onSubmit }: { onSubmit: () => void }) => {
  useShortcut(
    [],
    () => {
      if (
        typeof document !== "undefined" &&
        document.querySelector('[role="dialog"]')
      )
        return;
      onSubmit();
    },
    {
      ctrlKey: false,
      anyKey: true,
      allowInput: true,
    },
  );
  return null;
};
