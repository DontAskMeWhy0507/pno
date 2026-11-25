import superjson from "superjson";

const CACHE_PREFIX = "pno_qcache_v1";
const MAX_STUDY_SET_ENTRIES = 8;
const MAX_ENTRY_CHARS = 300_000;

interface CacheEnvelope<T> {
  data: T;
  updatedAt: number;
}

const recentKey = (userId: string) => `${CACHE_PREFIX}:${userId}:recent`;
const studySetKey = (userId: string, studySetId: string) =>
  `${CACHE_PREFIX}:${userId}:set:${studySetId}`;
const studySetLruKey = (userId: string) => `${CACHE_PREFIX}:${userId}:set_lru`;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readEnvelope<T>(key: string): CacheEnvelope<T> | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = superjson.parse<CacheEnvelope<T>>(raw);
    if (!parsed || typeof parsed !== "object" || !("data" in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function readLru(userId: string): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(studySetLruKey(userId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function writeLru(userId: string, ids: string[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(studySetLruKey(userId), JSON.stringify(ids));
  } catch {
    // Ignore quota errors
  }
}

export function readRecentCache<T>(userId: string): CacheEnvelope<T> | null {
  return readEnvelope<T>(recentKey(userId));
}

export function writeRecentCache<T>(userId: string, data: T): void {
  if (!isBrowser() || !userId) return;
  try {
    const serialized = superjson.stringify({
      data,
      updatedAt: Date.now(),
    } satisfies CacheEnvelope<T>);
    if (serialized.length > MAX_ENTRY_CHARS) return;
    localStorage.setItem(recentKey(userId), serialized);
  } catch {
    // Ignore quota or serialization errors
  }
}

export function readStudySetCache<T>(
  userId: string,
  studySetId: string,
): CacheEnvelope<T> | null {
  return readEnvelope<T>(studySetKey(userId, studySetId));
}

export function writeStudySetCache<T>(
  userId: string,
  studySetId: string,
  data: T,
): void {
  if (!isBrowser() || !userId || !studySetId) return;
  try {
    const serialized = superjson.stringify({
      data,
      updatedAt: Date.now(),
    } satisfies CacheEnvelope<T>);
    if (serialized.length > MAX_ENTRY_CHARS) return;

    const lru = readLru(userId).filter((id) => id !== studySetId);
    lru.unshift(studySetId);
    while (lru.length > MAX_STUDY_SET_ENTRIES) {
      const evictedId = lru.pop();
      if (evictedId) {
        try {
          localStorage.removeItem(studySetKey(userId, evictedId));
        } catch {
          // Ignore
        }
      }
    }

    localStorage.setItem(studySetKey(userId, studySetId), serialized);
    writeLru(userId, lru);
  } catch {
    // Ignore quota or serialization errors
  }
}

export function removeStudySetCache(userId: string, studySetId: string): void {
  if (!isBrowser() || !userId || !studySetId) return;
  try {
    localStorage.removeItem(studySetKey(userId, studySetId));
    const lru = readLru(userId).filter((id) => id !== studySetId);
    writeLru(userId, lru);
  } catch {
    // Ignore
  }
}
