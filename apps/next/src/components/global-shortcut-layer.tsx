import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import React from "react";

import { EnabledFeature } from "@quenti/lib/feature";

import { menuEventChannel } from "../events/menu";
import { useFeature } from "../hooks/use-feature";
import tinykeys from "../lib/tinykeys";
import { CommandMenu } from "./command-menu";

const ImportFromQuizletModal = dynamic(
  () => import("./import-from-quizlet-modal"),
  { ssr: false },
);
const ImportFromAnkiModal = dynamic(
  () => import("./import-from-anki-modal"),
  { ssr: false },
);
const AnkiCreateDeckModal = dynamic(
  () => import("../modules/anki/anki-create-deck-modal"),
  { ssr: false },
);
const CreateFolderModal = dynamic(() => import("./create-folder-modal"), {
  ssr: false,
});

export default function GlobalShortcutLayer() {
  const [open, setOpen] = React.useState(false);
  const [folderModalOpen, setFolderModalOpen] = React.useState(false);
  const [folderChildSetId, setFolderChildSetId] = React.useState<string>();
  const [importIsEdit, setImportIsEdit] = React.useState(false);
  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [ankiImportModalOpen, setAnkiImportModalOpen] = React.useState(false);
  const [ankiCreateModalOpen, setAnkiCreateModalOpen] = React.useState(false);

  const router = useRouter();
  const session = useSession();
  const user = session.data?.user;
  const earlyClassAccess = useFeature(EnabledFeature.EarlyClassAccess);

  React.useEffect(() => {
    const unsub = tinykeys(window, {
      "$mod+k": (e) => {
        if (!session.data?.user) return;
        e.preventDefault();
        setOpen((prev) => !prev);
      },
    });

    const openCmd = () => {
      if (!session.data?.user) return;
      setOpen(true);
    };

    menuEventChannel.on("openCommandMenu", openCmd);
    return () => {
      unsub();
      menuEventChannel.off("openCommandMenu", openCmd);
    };
  }, [session.data?.user]);

  React.useEffect(() => {
    const createFolder = (setId?: string) => {
      setFolderChildSetId(setId);
      setFolderModalOpen(true);
    };
    const openImportDialog = (edit = false) => {
      setImportIsEdit(edit);
      setImportModalOpen(true);
    };
    const openAnkiImportDialog = () => {
      setAnkiImportModalOpen(true);
    };
    const openCreateAnkiDeck = () => {
      setAnkiCreateModalOpen(true);
    };
    const createClass = () => {
      if (user?.organizationId || earlyClassAccess) {
        void router.push("/classes/new");
      } else {
        menuEventChannel.emit("openCreateClassNotice");
      }
    };

    menuEventChannel.on("createFolder", createFolder);
    menuEventChannel.on("openImportDialog", openImportDialog);
    menuEventChannel.on("openAnkiImportDialog", openAnkiImportDialog);
    menuEventChannel.on("openCreateAnkiDeck", openCreateAnkiDeck);
    menuEventChannel.on("createClass", createClass);
    return () => {
      menuEventChannel.off("createFolder", createFolder);
      menuEventChannel.off("openImportDialog", openImportDialog);
      menuEventChannel.off("openAnkiImportDialog", openAnkiImportDialog);
      menuEventChannel.off("openCreateAnkiDeck", openCreateAnkiDeck);
      menuEventChannel.off("createClass", createClass);
    };
  }, [earlyClassAccess, router, user?.organizationId]);

  if (!user) return null;

  return (
    <>
      {folderModalOpen && (
        <CreateFolderModal
          isOpen={folderModalOpen}
          onClose={() => {
            setFolderModalOpen(false);
            setFolderChildSetId(undefined);
          }}
          childSetId={folderChildSetId}
        />
      )}
      {importModalOpen && (
        <ImportFromQuizletModal
          isOpen={importModalOpen}
          onClose={() => {
            setImportModalOpen(false);
          }}
          edit={importIsEdit}
        />
      )}
      {ankiImportModalOpen && (
        <ImportFromAnkiModal
          isOpen={ankiImportModalOpen}
          onClose={() => {
            setAnkiImportModalOpen(false);
          }}
        />
      )}
      {ankiCreateModalOpen && (
        <AnkiCreateDeckModal
          isOpen={ankiCreateModalOpen}
          onClose={() => {
            setAnkiCreateModalOpen(false);
          }}
        />
      )}
      <CommandMenu
        isOpen={open}
        onClose={() => {
          setOpen(false);
          menuEventChannel.emit("commandMenuClosed");
        }}
      />
    </>
  );
}
