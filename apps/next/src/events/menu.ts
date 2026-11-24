import { eventBus } from "../lib/event-bus";

export const menuEventChannel = eventBus<{
  createFolder: (setId?: string) => void;
  openImportDialog: (edit?: boolean) => void;
  openAnkiImportDialog: () => void;
  openCreateAnkiDeck: () => void;
  openCommandMenu: () => void;
  ieltsNavigate: (path: string) => void;
  folderWithSetCreated: (setId: string) => void;
  openChangelog: () => void;
  openCreateClassNotice: () => void;
  createClass: () => void;
  openSignup: (args: { message?: string; callbackUrl?: string }) => void;
  commandMenuClosed: () => void;
  openIeltsManage: () => void;
  openIeltsAddTest: () => void;
  openIeltsTestBank: () => void;
  openIeltsNewCollection: () => void;
  ieltsSearchChange: (query: string) => void;
}>();
