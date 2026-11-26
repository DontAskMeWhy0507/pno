import type { SqlTableData } from "../types";

export interface SqlRunResult {
  columns: string[];
  rows: string[][];
  executionMs: number;
  error?: string;
}

export interface ScriptRunResult {
  logs: string[];
  returnValue?: string;
  executionMs: number;
  error?: string;
}

interface SqlJsDatabase {
  run: (sql: string, params?: unknown[]) => void;
  exec: (sql: string) => Array<{ columns: string[]; values: unknown[][] }>;
  close: () => void;
}

interface SqlJsModule {
  Database: new () => SqlJsDatabase;
}

type InitSqlJsFn = (config: {
  locateFile: (file: string) => string;
}) => Promise<SqlJsModule>;

interface PyodideInstance {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (msg: string) => void }) => void;
  setStderr: (opts: { batched: (msg: string) => void }) => void;
}

declare global {
  interface Window {
    initSqlJs?: InitSqlJsFn;
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInstance>;
  }
}

let sqlModulePromise: Promise<SqlJsModule> | null = null;
let pyodidePromise: Promise<PyodideInstance> | null = null;

function loadExternalScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if ((existing as HTMLScriptElement).dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load script: ${src}`)),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => reject(new Error(`Failed to load script: ${src}`)),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

async function getSqlModule(): Promise<SqlJsModule> {
  if (!sqlModulePromise) {
    sqlModulePromise = (async () => {
      await loadExternalScript("/api/courses/sql-js");
      if (!window.initSqlJs) {
        throw new Error("SQLite runtime failed to initialize.");
      }
      return window.initSqlJs({
        locateFile: () => "/api/courses/sql-wasm",
      });
    })();
  }
  return sqlModulePromise;
}

function inferColumnType(
  rows: string[][],
  colIdx: number,
): "INTEGER" | "REAL" | "TEXT" {
  let hasNonNull = false;
  let allInt = true;
  let allFloat = true;

  for (const row of rows) {
    const raw = (row[colIdx] ?? "").trim();
    if (!raw || raw.toUpperCase() === "NULL") continue;
    hasNonNull = true;
    if (!/^-?\d+$/.test(raw)) allInt = false;
    if (!/^-?\d+(\.\d+)?$/.test(raw)) allFloat = false;
  }

  if (!hasNonNull) return "TEXT";
  if (allInt) return "INTEGER";
  if (allFloat) return "REAL";
  return "TEXT";
}

function coerceSqlValue(
  raw: string,
  colType: "INTEGER" | "REAL" | "TEXT",
): unknown {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed.toUpperCase() === "NULL") return null;
  if (colType === "INTEGER") {
    const n = Number.parseInt(trimmed, 10);
    return Number.isNaN(n) ? trimmed : n;
  }
  if (colType === "REAL") {
    const n = Number.parseFloat(trimmed);
    return Number.isNaN(n) ? trimmed : n;
  }
  return trimmed;
}

function sanitizeIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export async function runSqlInBrowser(
  tables: SqlTableData[],
  query: string,
): Promise<SqlRunResult> {
  const started = performance.now();
  try {
    const SQL = await getSqlModule();
    const db = new SQL.Database();
    try {
      for (const tbl of tables) {
        const colTypes = tbl.columns.map((_, idx) =>
          inferColumnType(tbl.rows, idx),
        );
        const colsDef = tbl.columns
          .map((c, idx) => `${sanitizeIdent(c)} ${colTypes[idx]}`)
          .join(", ");
        db.run(`CREATE TABLE ${sanitizeIdent(tbl.name)} (${colsDef});`);

        if (tbl.rows.length > 0) {
          const placeholders = tbl.columns.map(() => "?").join(", ");
          const insertSql = `INSERT INTO ${sanitizeIdent(
            tbl.name,
          )} VALUES (${placeholders});`;
          for (const row of tbl.rows) {
            const values = tbl.columns.map((_, idx) =>
              coerceSqlValue(row[idx] ?? "", colTypes[idx]!),
            );
            db.run(insertSql, values);
          }
        }
      }

      const results = db.exec(query);
      const executionMs = Math.round(performance.now() - started);
      if (!results.length) {
        return { columns: [], rows: [], executionMs };
      }
      const last = results[results.length - 1]!;
      return {
        columns: last.columns,
        rows: last.values.map((r) =>
          r.map((cell) =>
            cell === null || cell === undefined ? "NULL" : String(cell),
          ),
        ),
        executionMs,
      };
    } finally {
      db.close();
    }
  } catch (err) {
    return {
      columns: [],
      rows: [],
      executionMs: Math.round(performance.now() - started),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function normalizeCellForCompare(val: string): string {
  const t = val.trim();
  if (t.toUpperCase() === "NULL") return "NULL";
  if (/^-?\d+(\.\d+)?$/.test(t)) {
    const num = Number(t);
    if (Number.isFinite(num)) return String(num);
  }
  return t;
}

export function compareTableResults(
  actual: { columns: string[]; rows: string[][] },
  expected: { columns: string[]; rows: string[][] },
): { matched: boolean; reason?: string } {
  if (actual.columns.length !== expected.columns.length) {
    return {
      matched: false,
      reason: `Column count mismatch (got ${actual.columns.length}, expected ${expected.columns.length}).`,
    };
  }
  const colMismatch = actual.columns.some(
    (c, i) =>
      c.trim().toLowerCase() !== expected.columns[i]!.trim().toLowerCase(),
  );
  if (colMismatch) {
    return {
      matched: false,
      reason: `Column names do not match (${actual.columns.join(
        ", ",
      )} vs ${expected.columns.join(", ")}).`,
    };
  }
  if (actual.rows.length !== expected.rows.length) {
    return {
      matched: false,
      reason: `Row count mismatch (got ${actual.rows.length}, expected ${expected.rows.length}).`,
    };
  }

  const normalizeRow = (r: string[]) =>
    r.map(normalizeCellForCompare).join("||");
  const actualSet = actual.rows.map(normalizeRow).toSorted();
  const expectedSet = expected.rows.map(normalizeRow).toSorted();
  for (let i = 0; i < actualSet.length; i++) {
    if (actualSet[i] !== expectedSet[i]) {
      return {
        matched: false,
        reason: "Row values do not match Expected output.",
      };
    }
  }
  return { matched: true };
}

function formatJsVal(val: unknown): string {
  if (typeof val === "string") return val;
  if (val === undefined) return "undefined";
  if (val === null) return "null";
  if (typeof val === "object") {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

export async function runJsInBrowser(code: string): Promise<ScriptRunResult> {
  const started = performance.now();
  const logs: string[] = [];
  const capture =
    (prefix = "") =>
    (...args: unknown[]) => {
      logs.push(prefix + args.map(formatJsVal).join(" "));
    };

  const sandboxConsole = {
    log: capture(),
    info: capture(),
    warn: capture("[warn] "),
    error: capture("[error] "),
    table: (data: unknown) => logs.push(formatJsVal(data)),
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function("console", `"use strict";\n${code}`) as (
      c: typeof sandboxConsole,
    ) => unknown;
    const ret: unknown = await Promise.resolve(fn(sandboxConsole));
    return {
      logs,
      returnValue: ret !== undefined ? formatJsVal(ret) : undefined,
      executionMs: Math.round(performance.now() - started),
    };
  } catch (err) {
    return {
      logs,
      executionMs: Math.round(performance.now() - started),
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  }
}

export async function runPythonInBrowser(
  code: string,
): Promise<ScriptRunResult> {
  const started = performance.now();
  const logs: string[] = [];
  try {
    if (!pyodidePromise) {
      pyodidePromise = (async () => {
        const base = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
        await loadExternalScript(`${base}pyodide.js`);
        if (!window.loadPyodide) {
          throw new Error("Failed to load Pyodide runtime from CDN.");
        }
        return window.loadPyodide({ indexURL: base });
      })();
    }

    const pyodide = await pyodidePromise;
    pyodide.setStdout({
      batched: (msg: string) => logs.push(msg),
    });
    pyodide.setStderr({
      batched: (msg: string) => logs.push(`[stderr] ${msg}`),
    });

    const res = await pyodide.runPythonAsync(code);
    return {
      logs,
      returnValue: res !== undefined && res !== null ? String(res) : undefined,
      executionMs: Math.round(performance.now() - started),
    };
  } catch (err) {
    return {
      logs,
      executionMs: Math.round(performance.now() - started),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
