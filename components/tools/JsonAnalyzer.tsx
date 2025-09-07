"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileJson, CheckCircle2, XCircle } from "lucide-react";

import { Stat, StatSmall } from "./JsonStats";
import SpotlightCard from "../visuals/spotlight-card";
import { getDict, type Locale } from "@/lib/i18n";

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

function decodeBase64Unicode(b64: string) {
  try {
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return atob(b64);
  }
}

export function safeDecode(input: string): string {
  try {
    if (input.startsWith("b64:")) return decodeBase64Unicode(input.slice(4));
    return decodeURIComponent(input);
  } catch {
    return input;
  }
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

  if (Array.isArray(root) && root.length && root.every((x) => x && typeof x === "object" && !Array.isArray(x))) {
    const limit = Math.min(root.length, limitForKeyStats);
    const countsPerKey: Record<string, number> = {};
    for (let i = 0; i < limit; i++) {
      const obj = root[i] as Record<string, unknown>;
      for (const k of Object.keys(obj)) {
        countsPerKey[k] = (countsPerKey[k] || 0) + 1;
      }
    }
    overview.topKeys = Object.keys(countsPerKey)
      .map((k) => ({ key: k, presencePct: (countsPerKey[k] / limit) * 100 }))
      .sort((a, b) => b.presencePct - a.presencePct);
  }

  return overview;
}

function pretty(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

type JsonErrLoc = { line: number; col: number; pos: number } | null;

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
function ErrorSnippet({ text, line, col }: { text: string; line: number; col: number }) {
  const L = (text.split(/\r?\n/)[line - 1] ?? "").replace(/\t/g, "  ");
  const caret = " ".repeat(Math.max(0, col - 1)) + "^";
  return (
    <pre className="mt-2 overflow-auto rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
      <code className="whitespace-pre-wrap break-words">
        {L}
        {"\n"}
        {caret}
      </code>
    </pre>
  );
}

/* =========================
 * Toast (léger, sans lib)
 * ========================= */

type Toast = { id: number; type: "success" | "error"; title: string; desc?: string };

function useToasts() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const push = React.useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, ...t }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 3200);
  }, []);
  const remove = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);
  return { toasts, push, remove };
}

function ToastViewport({
  toasts,
  remove,
}: {
  toasts: Toast[];
  remove: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className={`pointer-events-auto rounded-xl border p-3 shadow-lg backdrop-blur ${
              t.type === "success"
                ? "border-emerald-300/30 bg-emerald-100/70 text-emerald-900 dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                : "border-red-300/30 bg-red-100/70 text-red-900 dark:border-red-300/20 dark:bg-red-400/10 dark:text-red-200"
            }`}
            onClick={() => remove(t.id)}
          >
            <div className="flex items-start gap-2">
              {t.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div className="flex-1">
                <div className="text-sm font-semibold">{t.title}</div>
                {t.desc && <div className="mt-0.5 text-xs opacity-80">{t.desc}</div>}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function JsonAnalyzer({
  initialText,
  onParsed,
  locale = "fr",
}: {
  initialText?: string;
  onParsed?: (payload: { text: string; value: unknown | null; error: string | null }) => void;
  locale?: Locale;
}) {
  const dict = getDict(locale);

  const [text, setText] = React.useState<string>(initialText ?? "");
  const [value, setValue] = React.useState<unknown | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [errorLoc, setErrorLoc] = React.useState<JsonErrLoc>(null);
  const [overview, setOverview] = React.useState<Overview | null>(null);

  const [dragDepth, setDragDepth] = React.useState(0);
  const isDragging = dragDepth > 0;

  const { toasts, push, remove } = useToasts();

  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const id = setTimeout(() => {
      if (!text.trim()) {
        setValue(null);
        setOverview(null);
        setError(null);
        setErrorLoc(null);
        onParsed?.({ text, value: null, error: null });
        return;
      }
      try {
        const parsed = JSON.parse(text);
        setValue(parsed);
        setOverview(summarizeJson(parsed));
        setError(null);
        setErrorLoc(null);
        onParsed?.({ text, value: parsed, error: null });
      } catch (e: any) {
        setValue(null);
        setOverview(null);
        const loc = locateJsonError(text, e);
        setErrorLoc(loc);
        const base = dict["json.error.invalid"] ?? "JSON invalide";
        const withWhere = loc
          ? `${base} — ${locale === "fr" ? "ligne" : "line"} ${loc.line}, ${locale === "fr" ? "colonne" : "column"} ${loc.col}`
          : base;
        setError(withWhere);
        onParsed?.({ text, value: null, error: withWhere });
      }
    }, 250);
    return () => clearTimeout(id);
  }, [text, onParsed, dict, locale]);

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragDepth((d) => d + 1);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragDepth((d) => Math.max(0, d - 1));
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragDepth(0);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    handleFile(file);
  };

  const handleBrowse = () => fileRef.current?.click();
  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  const handleFile = (file: File) => {
    const dictLoaded = dict["json.toast.loaded"] ?? "Fichier chargé";
    const dictError = dict["json.toast.error"] ?? "Échec du chargement du fichier";
    if (file.size > 15 * 1024 * 1024) {
      push({ type: "error", title: dictError, desc: "Max 15MB" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      setText(raw);
      push({
        type: "success",
        title: dictLoaded,
        desc: `${file.name} — ${Intl.NumberFormat().format(raw.length)} ${locale === "fr" ? "caractères" : "chars"}`,
      });
    };
    reader.onerror = () => push({ type: "error", title: dictError, desc: file.name });
    reader.readAsText(file);
  };

  return (
    <>
      <SpotlightCard className="mt-10 rounded-2xl border p-4 dark:border-white/10 backdrop-blur w-full">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">{dict["json.title"]}</h3>
          <div className="text-xs opacity-70">{dict["json.hint"]}</div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div
            className="relative flex min-h-[220px] flex-col"
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <label className="mb-2 flex items-center justify-between text-xs font-medium opacity-70">
              <span>{dict["json.input"]}</span>
              <button
                type="button"
                onClick={handleBrowse}
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
              >
                <Upload className="h-3.5 w-3.5" />
                {dict["json.drop.browse"] ?? "Parcourir…"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                onChange={onFileInput}
                hidden
              />
            </label>

            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[220px] w-full resize-y rounded-lg border p-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand/40 dark:border-white/10 dark:bg-white/5"
                placeholder={dict["json.placeholder"]}
              />
              <AnimatePresence>
                {isDragging && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg border-2 border-dashed border-sky-500/60 bg-sky-500/5 backdrop-blur-sm"
                  >
                    <motion.div
                      initial={{ scale: 0.96 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 18 }}
                      className="pointer-events-none flex flex-col items-center gap-2"
                    >
                      <FileJson className="h-8 w-8 opacity-80" />
                      <div className="text-sm font-semibold">
                        {dict["json.drop.title"] ?? "Déposez votre fichier JSON ici"}
                      </div>
                      <div className="text-xs opacity-80">
                        {dict["json.drop.hint"] ?? "ou relâchez pour le charger"}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {error && (
              <div className="mt-2 text-xs">
                <div className="rounded-md bg-red-50 p-2 text-red-700 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </div>
                {errorLoc && <ErrorSnippet text={text} line={errorLoc.line} col={errorLoc.col} />}
              </div>
            )}
          </div>

          {/* Overview */}
          <div className="flex min-h-[220px] flex-col">
            <label className="mb-2 text-xs font-medium opacity-70">{dict["json.preview"]}</label>
            <div className="max-h-[60vh] flex-1 overflow-auto rounded-lg border p-3 dark:border-white/10 dark:bg-white/5">
              {!overview ? (
                <div className="text-sm opacity-60">{dict["json.empty"]}</div>
              ) : (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Stat label={dict["json.stats.nodes"]} value={overview.totalNodes} />
                    <Stat label={dict["json.stats.depth"]} value={overview.maxDepth} />
                    <Stat label={dict["json.stats.objects"]} value={overview.counts.objects} />
                    <Stat label={dict["json.stats.arrays"]} value={overview.counts.arrays} />
                    <Stat label={dict["json.stats.numbers"]} value={overview.counts.numbers} />
                    <Stat label={dict["json.stats.strings"]} value={overview.counts.strings} />
                    <Stat label={dict["json.stats.booleans"]} value={overview.counts.booleans} />
                    <Stat label={dict["json.stats.nulls"]} value={overview.counts.nulls} />
                  </div>

                  {overview.numberStats && (
                    <div className="rounded-lg border p-3 dark:border-white/10">
                      <div className="mb-2 text-xs font-semibold opacity-80">{dict["json.numbers.title"]}</div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <StatSmall label={dict["json.numbers.min"]} value={overview.numberStats.min} />
                        <StatSmall label={dict["json.numbers.max"]} value={overview.numberStats.max} />
                        <StatSmall
                          label={dict["json.numbers.mean"]}
                          value={Number(overview.numberStats.mean.toFixed(3))}
                        />
                      </div>
                    </div>
                  )}

                  {overview.arrayStats && (
                    <div className="rounded-lg border p-3 dark:border-white/10">
                      <div className="mb-2 text-xs font-semibold opacity-80">{dict["json.arrays.title"]}</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <StatSmall label={dict["json.arrays.count"]} value={overview.arrayStats.count} />
                        <StatSmall
                          label={dict["json.arrays.avg_len"]}
                          value={Number(overview.arrayStats.avgLen.toFixed(2))}
                        />
                      </div>
                    </div>
                  )}

                  {overview.topKeys && overview.topKeys.length > 0 && (
                    <div className="rounded-lg border p-3 dark:border-white/10">
                      <div className="mb-2 text-xs font-semibold opacity-80">{dict["json.top_keys.title"]}</div>
                      <div className="max-h-[240px] overflow-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-white/80 backdrop-blur dark:bg-neutral-900/80">
                            <tr>
                              <th className="py-1 pr-2 font-medium opacity-70">{dict["json.top_keys.key"]}</th>
                              <th className="py-1 pl-2 font-medium opacity-70">{dict["json.top_keys.presence"]}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {overview.topKeys.map((k) => (
                              <tr key={k.key} className="border-t dark:border-white/10">
                                <td className="py-1 pr-2 font-mono">{k.key}</td>
                                <td className="py-1 pl-2">{k.presencePct.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </SpotlightCard>

      <ToastViewport toasts={toasts} remove={remove} />
    </>
  );
}
