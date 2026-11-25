export type SyncScope = "quiz" | "ielts" | "all";

export interface SyncBusMessage {
  scope: SyncScope;
  entityId?: string;
  senderId: string;
  ts: number;
}

const CHANNEL_NAME = "pno_sync_v1";
const STORAGE_FALLBACK_KEY = "pno_sync_ping_v1";

const TAB_ID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

let sharedChannel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (!sharedChannel) {
    try {
      sharedChannel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return sharedChannel;
}

export function broadcastSync(scope: SyncScope, entityId?: string): void {
  if (typeof window === "undefined") return;
  const payload: SyncBusMessage = {
    scope,
    entityId,
    senderId: TAB_ID,
    ts: Date.now(),
  };

  const ch = getChannel();
  if (ch) {
    try {
      ch.postMessage(payload);
      return;
    } catch {
      // Fall through to storage fallback
    }
  }

  try {
    localStorage.setItem(STORAGE_FALLBACK_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors
  }
}

export function subscribeSync(
  handler: (msg: SyncBusMessage) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const dispatchIfRemote = (msg: SyncBusMessage | null | undefined) => {
    if (!msg || typeof msg !== "object" || msg.senderId === TAB_ID) return;
    handler(msg);
  };

  const ch = getChannel();
  const onChannelMessage = (event: MessageEvent<SyncBusMessage>) => {
    dispatchIfRemote(event.data);
  };
  if (ch) {
    ch.addEventListener("message", onChannelMessage);
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_FALLBACK_KEY || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue) as SyncBusMessage;
      dispatchIfRemote(parsed);
    } catch {
      // Ignore malformed JSON
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    if (ch) {
      ch.removeEventListener("message", onChannelMessage);
    }
    window.removeEventListener("storage", onStorage);
  };
}
