import JSZip from "jszip";
import * as fzstd from "fzstd";
import initSqlJs, { type Database } from "sql.js";

/**
 * TypeScript port of extractor.py. Produces the exact same collection
 * structure without needing a Python runtime, so Anki imports work inside
 * serverless functions (Vercel) as well as locally.
 */

export interface RawExtractedCollection {
  decks: Record<string, string>;
  notetypes: Record<
    string,
    {
      name: string;
      fields: string[];
      templates: Record<
        number | string,
        { name: string; qfmt: string; afmt: string }
      >;
    }
  >;
  notes: Record<
    string,
    { mid: string; fields: Record<string, string>; tags: string[] }
  >;
  cards: Array<{
    id: string;
    noteId: string;
    deckId: string;
    ord: number;
    type: number;
    queue: number;
    due: number;
    interval: number;
    factor: number;
    reps: number;
    lapses: number;
  }>;
  mediaMap: Record<string, string>;
}

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];
const MAX_DECOMPRESSED_BYTES = 200 * 1024 * 1024;

function isZstd(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 && ZSTD_MAGIC.every((b, i) => bytes[i] === b)
  );
}

function maybeDecompress(bytes: Uint8Array): Uint8Array {
  if (!isZstd(bytes)) return bytes;
  const out = fzstd.decompress(bytes);
  if (out.byteLength > MAX_DECOMPRESSED_BYTES) {
    throw new Error(
      "Decompressed Anki data exceeds maximum allowed size (200 MB).",
    );
  }
  return out;
}

function readVarintSafe(bytes: Uint8Array, state: { pos: number }): number {
  let result = 0;
  let multiplier = 1;
  let count = 0;
  while (state.pos < bytes.length && count < 10) {
    const b = bytes[state.pos++]!;
    if (count < 7) {
      result += (b & 0x7f) * multiplier;
      multiplier *= 128;
    }
    count++;
    if ((b & 0x80) === 0) return result;
  }
  throw new Error("Malformed varint in Anki protobuf data");
}

function skipProtobufField(
  bytes: Uint8Array,
  state: { pos: number },
  wireType: number,
  limit: number,
): void {
  if (wireType === 0) {
    readVarintSafe(bytes, state);
  } else if (wireType === 1) {
    state.pos = Math.min(limit, state.pos + 8);
  } else if (wireType === 2) {
    const len = readVarintSafe(bytes, state);
    if (len < 0 || state.pos + len > limit) {
      throw new Error("Truncated length-delimited field in Anki protobuf");
    }
    state.pos += len;
  } else if (wireType === 5) {
    state.pos = Math.min(limit, state.pos + 4);
  } else {
    throw new Error(`Unsupported protobuf wire type ${wireType}`);
  }
}

export function decodeProtobufMedia(
  bytes: Uint8Array,
): Record<string, string> {
  const map: Record<string, string> = {};
  const state = { pos: 0 };
  let entryIndex = 0;

  while (state.pos < bytes.length) {
    const tag = readVarintSafe(bytes, state);
    const fieldNum = tag >> 3;
    const wireType = tag & 0x07;

    if (fieldNum === 1 && wireType === 2) {
      const entryLen = readVarintSafe(bytes, state);
      if (entryLen < 0 || state.pos + entryLen > bytes.length) break;
      const endPos = state.pos + entryLen;
      let filename = "";

      while (state.pos < endPos) {
        const innerTag = readVarintSafe(bytes, state);
        const innerField = innerTag >> 3;
        const innerWire = innerTag & 0x07;

        if (innerField === 1 && innerWire === 2) {
          const fnLen = readVarintSafe(bytes, state);
          if (fnLen < 0 || state.pos + fnLen > endPos) break;
          filename = new TextDecoder().decode(
            bytes.slice(state.pos, state.pos + fnLen),
          );
          state.pos += fnLen;
        } else {
          skipProtobufField(bytes, state, innerWire, endPos);
        }
      }

      state.pos = endPos;
      if (filename) {
        map[String(entryIndex)] = filename;
      }
      entryIndex++;
    } else {
      skipProtobufField(bytes, state, wireType, bytes.length);
    }
  }

  return map;
}

function decodeTemplateConfig(bytes: Uint8Array): {
  qfmt: string;
  afmt: string;
} {
  let qfmt = "";
  let afmt = "";
  const state = { pos: 0 };

  while (state.pos < bytes.length) {
    const tag = readVarintSafe(bytes, state);
    const fieldNum = tag >> 3;
    const wireType = tag & 0x07;
    if (wireType === 2) {
      const len = readVarintSafe(bytes, state);
      if (len < 0 || state.pos + len > bytes.length) break;
      const slice = bytes.slice(state.pos, state.pos + len);
      if (fieldNum === 1) qfmt = new TextDecoder().decode(slice);
      else if (fieldNum === 2) afmt = new TextDecoder().decode(slice);
      state.pos += len;
    } else {
      skipProtobufField(bytes, state, wireType, bytes.length);
    }
  }
  return { qfmt, afmt };
}

const SQL_JS_VERSION = "1.16.0";
const WASM_CDN_URL = `https://cdn.jsdelivr.net/npm/sql.js@${SQL_JS_VERSION}/dist/sql-wasm.wasm`;

async function loadWasmBinary(): Promise<Uint8Array> {
  // Prefer the wasm file shipped inside the installed sql.js package.
  // (Embedding it as a base64 source file crashed the Vercel build
  // compiler with SIGSEGV, so it must not live in the bundle.)
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    let resolved: string | undefined;
    try {
      const mod = (await import("module")) as {
        createRequire?: (filename: string) => NodeRequire;
        default?: {
          createRequire?: (filename: string) => NodeRequire;
        };
      };
      const createRequireFn = mod.createRequire ?? mod.default?.createRequire;
      const basePath =
        typeof __filename === "string"
          ? __filename
          : path.join(process.cwd(), "package.json");
      resolved = createRequireFn?.(basePath).resolve(
        "sql.js/dist/sql-wasm.wasm",
      );
    } catch {
      // Not resolvable in bundled environment
    }
    const rel = path.join("sql.js", "dist", "sql-wasm.wasm");
    const candidates = [
      process.env.SQL_WASM_PATH,
      resolved,
      path.join(process.cwd(), "node_modules", rel),
      path.join(process.cwd(), "..", "..", "node_modules", rel),
      path.join("/var/task", "node_modules", rel),
    ].filter((c): c is string => !!c);
    for (const candidate of candidates) {
      try {
        return new Uint8Array(await fs.readFile(candidate));
      } catch {
        // Try next candidate
      }
    }
  } catch {
    // Fall through to the CDN copy.
  }
  const res = await fetch(WASM_CDN_URL, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok)
    throw new Error(`Could not load sql.js wasm (HTTP ${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

let sqlPromise: ReturnType<typeof initSqlJs> | null = null;
function getSql() {
  if (!sqlPromise) {
    sqlPromise = loadWasmBinary()
      .then((wasmBinary) => initSqlJs({ wasmBinary }))
      .catch((err) => {
        sqlPromise = null;
        throw err;
      });
  }
  return sqlPromise;
}

type Row = Record<string, unknown>;

function queryAll(db: Database, sql: string): Row[] {
  const results = db.exec(sql);
  const first = results[0];
  if (!first) return [];
  return first.values.map((values) => {
    const row: Row = {};
    first.columns.forEach((col, i) => {
      row[col] = values[i];
    });
    return row;
  });
}

function tableExists(db: Database, name: string): boolean {
  const rows = queryAll(
    db,
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`,
  );
  return rows.length > 0;
}

export async function extractCollection(
  apkgInput: Buffer | Uint8Array,
): Promise<RawExtractedCollection> {
  const zip = await JSZip.loadAsync(apkgInput);
  const names = Object.keys(zip.files);

  const dbEntry = names.includes("collection.anki21b")
    ? "collection.anki21b"
    : names.includes("collection.anki21")
      ? "collection.anki21"
      : "collection.anki2";
  const dbFile = zip.file(dbEntry);
  if (!dbFile) throw new Error("No Anki collection database found in package");
  const dbBytes = maybeDecompress(await dbFile.async("uint8array"));

  const SQL = await getSql();
  let db = new SQL.Database(dbBytes);
  try {
    // Anki's modern schema declares `COLLATE unicase` on several text
    // columns, and sql.js cannot register custom collations — any query
    // touching the fields/templates tables then fails ("no such collation
    // sequence" / "no query solution"). Rewrite the schema in-memory to the
    // built-in nocase collation and reopen from the exported bytes. We only
    // ever read (full scans, sorted in JS), so index key ordering built
    // under unicase does not affect results.
    try {
      db.exec("PRAGMA writable_schema=ON");
      db.exec(
        "UPDATE sqlite_master SET sql = replace(sql, 'COLLATE unicase', 'COLLATE nocase') WHERE sql LIKE '%unicase%'",
      );
      if (db.getRowsModified() > 0) {
        const exported = db.export();
        db.close();
        db = new SQL.Database(exported);
      }
    } catch {
      // Legacy databases without unicase: nothing to rewrite.
    }
    // 1. Decks
    const decks: Record<string, string> = {};
    if (tableExists(db, "decks")) {
      for (const row of queryAll(db, "SELECT id, name FROM decks")) {
        decks[String(row.id)] = String(row.name);
      }
    } else {
      const rows = queryAll(db, "SELECT decks FROM col");
      const parsed = JSON.parse(String(rows[0]?.decks ?? "{}")) as Record<
        string,
        { name: string }
      >;
      for (const [k, v] of Object.entries(parsed)) decks[k] = v.name;
    }

    // 2. Notetypes, fields, templates
    const notetypes: RawExtractedCollection["notetypes"] = {};
    if (tableExists(db, "notetypes")) {
      for (const row of queryAll(db, "SELECT id, name FROM notetypes")) {
        notetypes[String(row.id)] = {
          name: String(row.name),
          fields: [],
          templates: {},
        };
      }
      // Sort in JS rather than ORDER BY (matches extractor.py's ordering).
      const byNtidOrd = (a: Row, b: Row) =>
        Number(a.ntid) - Number(b.ntid) || Number(a.ord) - Number(b.ord);
      for (const row of queryAll(
        db,
        "SELECT ntid, ord, name FROM fields",
      ).sort(byNtidOrd)) {
        const nt = notetypes[String(row.ntid)];
        if (nt) nt.fields.push(String(row.name));
      }
      for (const row of queryAll(
        db,
        "SELECT ntid, ord, name, config FROM templates",
      ).sort(byNtidOrd)) {
        const nt = notetypes[String(row.ntid)];
        if (nt) {
          const config = row.config;
          const bytes =
            config instanceof Uint8Array
              ? config
              : new Uint8Array((config as ArrayLike<number>) ?? []);
          const { qfmt, afmt } = decodeTemplateConfig(bytes);
          nt.templates[Number(row.ord)] = {
            name: String(row.name),
            qfmt,
            afmt,
          };
        }
      }
    } else {
      const rows = queryAll(db, "SELECT models FROM col");
      const parsed = JSON.parse(String(rows[0]?.models ?? "{}")) as Record<
        string,
        {
          name: string;
          flds?: { name: string }[];
          tmpls?: { ord: number; name: string; qfmt: string; afmt: string }[];
        }
      >;
      for (const [mid, m] of Object.entries(parsed)) {
        const templates: RawExtractedCollection["notetypes"][string]["templates"] =
          {};
        for (const t of m.tmpls ?? []) {
          templates[t.ord] = { name: t.name, qfmt: t.qfmt, afmt: t.afmt };
        }
        notetypes[mid] = {
          name: m.name,
          fields: (m.flds ?? []).map((f) => f.name),
          templates,
        };
      }
    }

    // 3. Notes
    const notes: RawExtractedCollection["notes"] = {};
    for (const row of queryAll(db, "SELECT id, mid, flds, tags FROM notes")) {
      const fieldValues = String(row.flds).split("\x1f");
      const fieldNames = notetypes[String(row.mid)]?.fields ?? [];
      const fields: Record<string, string> = {};
      fieldValues.forEach((val, i) => {
        fields[fieldNames[i] ?? `Field${i}`] = val;
      });
      notes[String(row.id)] = {
        mid: String(row.mid),
        fields,
        tags: String(row.tags ?? "")
          .trim()
          .split(/\s+/)
          .filter(Boolean),
      };
    }

    // 4. Cards
    const cards: RawExtractedCollection["cards"] = queryAll(
      db,
      "SELECT id, nid, did, ord, type, queue, due, ivl, factor, reps, lapses FROM cards",
    ).map((row) => ({
      id: String(row.id),
      noteId: String(row.nid),
      deckId: String(row.did),
      ord: Number(row.ord),
      type: Number(row.type),
      queue: Number(row.queue),
      due: Number(row.due),
      interval: Number(row.ivl),
      factor: Number(row.factor),
      reps: Number(row.reps),
      lapses: Number(row.lapses),
    }));

    // 5. Media map
    let mediaMap: Record<string, string> = {};
    const mediaFile = zip.file("media");
    if (mediaFile) {
      const raw = maybeDecompress(await mediaFile.async("uint8array"));
      const text = new TextDecoder().decode(raw).trimStart();
      if (text.startsWith("{")) {
        mediaMap = JSON.parse(text) as Record<string, string>;
      } else {
        mediaMap = decodeProtobufMedia(raw);
      }
    }

    return { decks, notetypes, notes, cards, mediaMap };
  } finally {
    db.close();
  }
}
