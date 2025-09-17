/// <reference lib="webworker" />

import { JSONPath } from "jsonpath-plus";
import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";

export type Counts = {
  objects: number;
  arrays: number;
  strings: number;
  numbers: number;
  booleans: number;
  nulls: number;
};
export type Overview = {
  totalNodes: number;
  maxDepth: number;
  counts: Counts;
  numberStats?: { count: number; min: number; max: number; mean: number };
  arrayStats?: { count: number; avgLen: number };
  topKeys?: Array<{ key: string; presencePct: number }>;
};

type JsonErrLoc = { line: number; col: number; pos: number } | null;

type ParseMode = "strict" | "jsonc";

type InMsg =
  | { type: "parse"; text: string; mode: ParseMode; topKeysSampleLimit?: number }
  | { type: "jsonpath"; query: string; resultType?: "value" | "pointer" }
  | { type: "validate"; schema: any };

type OutMsg =
  | {
      type: "result";
      ok: true;
      value: unknown;
      overview: Overview;
      error: null;
      errorLoc: null;
      timings: { parseMs: number; summarizeMs: number; totalMs: number };
      size: number;
    }
  | {
      type: "result";
      ok: false;
      value: null;
      overview: null;
      error: string;
      errorLoc: JsonErrLoc;
      timings: { parseMs: number; summarizeMs: number; totalMs: number };
      size: number;
    }
  | { type: "jsonpath:result"; query: string; resultType: "value" | "pointer"; values: unknown[]; pointers: string[] }
  | { type: "validate:result"; valid: boolean; errors: Array<{ path: string; message: string }> };

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

let LAST_VALUE: unknown | null = null;

function stripCommentsAndTrailingCommas(input: string): string {
  let out = "";
  let inStr = false;
  let esc = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];
    if (inLine) {
      if (ch === "\n") {
        inLine = false;
        out += ch;
      }
      continue;
    }
    if (inBlock) {
      if (ch === "*" && next === "/") {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inStr) {
      out += ch;
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLine = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlock = true;
      i++;
      continue;
    }
    out += ch;
  }
  let res = "";
  inStr = false;
  esc = false;
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (inStr) {
      res += ch;
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      res += ch;
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      while (j < out.length && /\s/.test(out[j])) j++;
      const nxt = out[j];
      if (nxt === "]" || nxt === "}") continue; // drop trailing comma
    }
    res += ch;
  }
  return res;
}

function lineColFromIndex(text: string, index: number) {
  let line = 1;
  let col = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      col = 1;
    } else col++;
  }
  return { line, col };
}
function indexFromLineCol(text: string, line: number, col: number) {
  const lines = text.split(/\r?\n/);
  let idx = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) idx += lines[i].length + 1;
  return idx + Math.max(0, col - 1);
}
function locateJsonError(text: string, err: unknown): JsonErrLoc {
  const msg = (err as any)?.message ?? "";
  const mLC = /line\s+(\d+)\s+column\s+(\d+)/i.exec(msg);
  if (mLC) {
    const line = Number(mLC[1]);
    const col = Number(mLC[2]);
    const pos = indexFromLineCol(text, line, col);
    return { line, col, pos };
  }
  const mPos = /position\s+(\d+)/i.exec(msg);
  if (mPos) {
    const pos = Number(mPos[1]);
    const { line, col } = lineColFromIndex(text, pos);
    return { line, col, pos };
  }
  return null;
}

export function summarizeJson(root: unknown, limitForKeyStats = 500): Overview {
  let totalNodes = 0;
  let maxDepth = 0;
  const counts: Counts = { objects: 0, arrays: 0, strings: 0, numbers: 0, booleans: 0, nulls: 0 };
  let numSum = 0;
  let numMin = Number.POSITIVE_INFINITY;
  let numMax = Number.NEGATIVE_INFINITY;
  let numCount = 0;
  let arrCount = 0;
  let arrLenSum = 0;

  const stack: Array<{ v: unknown; d: number }> = [{ v: root, d: 1 }];
  const sampler: Record<string, number> = {};
  const reservoirSize = limitForKeyStats;
  let sampled = 0;

  while (stack.length) {
    const { v, d } = stack.pop()!;
    totalNodes++;
    if (d > maxDepth) maxDepth = d;
    if (v === null) {
      counts.nulls++;
      continue;
    }
    const t = typeof v;
    if (Array.isArray(v)) {
      counts.arrays++;
      arrCount++;
      arrLenSum += v.length;
      for (let i = 0; i < v.length; i++) stack.push({ v: v[i], d: d + 1 });
      continue;
    }
    if (t === "object") {
      counts.objects++;
      const obj = v as Record<string, unknown>;
      if (Array.isArray(root) && obj && !Array.isArray(obj)) {
        if (sampled < reservoirSize) {
          for (const k of Object.keys(obj)) sampler[k] = (sampler[k] || 0) + 1;
          sampled++;
        } else {
          const j = Math.floor(Math.random() * (sampled + 1));
          if (j < reservoirSize) {
            for (const k of Object.keys(obj)) sampler[k] = (sampler[k] || 0) + 1;
          }
          sampled++;
        }
      }
      for (const k in obj) stack.push({ v: obj[k], d: d + 1 });
      continue;
    }
    if (t === "string") counts.strings++;
    else if (t === "number") {
      counts.numbers++;
      numCount++;
      const n = v as number;
      if (n < numMin) numMin = n;
      if (n > numMax) numMax = n;
      numSum += n;
    } else if (t === "boolean") counts.booleans++;
  }

  const overview: Overview = {
    totalNodes,
    maxDepth,
    counts,
    numberStats: numCount > 0 ? { count: numCount, min: numMin, max: numMax, mean: numSum / numCount } : undefined,
    arrayStats: arrCount > 0 ? { count: arrCount, avgLen: arrLenSum / arrCount } : undefined,
  };

  if (Object.keys(sampler).length) {
    const limit = Math.min(sampled, reservoirSize || sampled);
    overview.topKeys = Object.keys(sampler)
      .map((k) => ({ key: k, presencePct: (sampler[k] / limit) * 100 }))
      .sort((a, b) => b.presencePct - a.presencePct);
  }
  return overview;
}

/** Ajv v6/v8 error path compatibility */
type AjvError = ErrorObject & { instancePath?: string; dataPath?: string };
const getErrPath = (e: AjvError) => e.instancePath || e.dataPath || "/";

self.addEventListener("message", (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  if (!msg) return;

  if (msg.type === "parse") {
    const t0 = now();
    const raw = msg.text ?? "";
    const mode = msg.mode ?? "strict";
    const size = raw.length;
    try {
      const source = mode === "jsonc" ? stripCommentsAndTrailingCommas(raw) : raw;
      const t1 = now();
      const value = JSON.parse(source);
      const t2 = now();
      LAST_VALUE = value;
      const overview = summarizeJson(value, msg.topKeysSampleLimit ?? 500);
      const t3 = now();
      const out: OutMsg = {
        type: "result",
        ok: true,
        value,
        overview,
        error: null,
        errorLoc: null,
        size,
        timings: { parseMs: t2 - t1, summarizeMs: t3 - t2, totalMs: t3 - t0 },
      };
      (self as any).postMessage(out);
    } catch (e: any) {
      const loc = locateJsonError(raw, e);
      const out: OutMsg = {
        type: "result",
        ok: false,
        value: null,
        overview: null,
        error: e?.message || "Invalid JSON",
        errorLoc: loc,
        size,
        timings: { parseMs: 0, summarizeMs: 0, totalMs: now() - t0 },
      };
      (self as any).postMessage(out);
    }
    return;
  }

  if (msg.type === "jsonpath") {
    try {
      const json = LAST_VALUE ?? null;
      const values = JSONPath({ path: msg.query, json, resultType: "value" }) as unknown[];
      const pointers = JSONPath({ path: msg.query, json, resultType: "pointer" }) as string[];
      (self as any).postMessage({
        type: "jsonpath:result",
        query: msg.query,
        resultType: msg.resultType ?? "value",
        values,
        pointers,
      });
    } catch (_e) {
      (self as any).postMessage({
        type: "jsonpath:result",
        query: msg.query,
        resultType: msg.resultType ?? "value",
        values: [],
        pointers: [],
      });
    }
    return;
  }

  if (msg.type === "validate") {
    try {
      // Ajv options compatible avec v6 et v8 (pas de 'strict' ici)
      const ajv = new Ajv({ allErrors: true } as any);
      // Évite les conflits de types entre différentes versions
      addFormats(ajv as any);

      const validate = ajv.compile(msg.schema);
      const ok = validate(LAST_VALUE);
      const errors = (validate.errors || []).map((e) => ({
        path: getErrPath(e as AjvError),
        message: (e as AjvError).message || "error",
      }));
      (self as any).postMessage({ type: "validate:result", valid: !!ok, errors });
    } catch (e: any) {
      (self as any).postMessage({
        type: "validate:result",
        valid: false,
        errors: [{ path: "/", message: e?.message || "validator error" }],
      });
    }
    return;
  }
});
