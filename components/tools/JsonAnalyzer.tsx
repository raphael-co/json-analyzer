"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileJson,
  CheckCircle2,
  XCircle,
  Download,
  Link2,
  Paintbrush,   // remplace Broom
  Minimize2,
  ArrowUpAZ,    // remplace ArrowUpZA
  Search,
  Diff,
  CheckCheck,
  Trash2,
  FileCode2     // remplace FileType2
} from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Stat, StatSmall } from "./JsonStats";
import SpotlightCard from "../visuals/spotlight-card";
import { getDict, type Locale } from "@/lib/i18n";
import { compressToParam, decompressFromParam } from "@/lib/share";
import { JsonExplorerHandle } from "./JsonExplorer";

/* ----------------------- AJOUT: util JSON Pointer (RFC 6901) ----------------------- */
function jsonPointerGet(root: unknown, pointer: string): unknown {
  if (pointer === "" || pointer === "/") return root;
  const parts = pointer.split("/").slice(1).map(seg => seg.replace(/~1/g, "/").replace(/~0/g, "~"));
  let node: any = root;
  for (const raw of parts) {
    if (node == null) return undefined;
    const key = Array.isArray(node) && /^\d+$/.test(raw) ? Number(raw) : raw;
    node = node[key as any];
  }
  return node;
}
function previewValue(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    return s.length > 240 ? s.slice(0, 237) + "…" : s;
  } catch {
    return String(v);
  }
}
/* ----------------------------------------------------------------------------------- */

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

type WorkerResultOk = {
  type: "result";
  ok: true;
  value: unknown;
  overview: Overview;
  error: null;
  errorLoc: null;
  timings: { parseMs: number; summarizeMs: number; totalMs: number };
  size: number;
};
type WorkerResultErr = {
  type: "result";
  ok: false;
  value: null;
  overview: null;
  error: string;
  errorLoc: JsonErrLoc;
  timings: { parseMs: number; summarizeMs: number; totalMs: number };
  size: number;
};

type WorkerResult = WorkerResultOk | WorkerResultErr;

type ParseMode = "strict" | "jsonc";

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
  const remove = React.useCallback(
    (id: number) => setToasts((prev) => prev.filter((x) => x.id !== id)),
    []
  );
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

function TBtn({
  onClick,
  title,
  children,
  disabled,
}: React.PropsWithChildren<{
  onClick?: () => void;
  title: string;
  disabled?: boolean;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10"
    >
      {children}
    </button>
  );
}

/* ---------- util JSONC (pour Diff) ---------- */
function stripJsonc(input: string): string {
  // retire BOM
  let s = input.replace(/^\uFEFF/, "");
  // commentaires bloc
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  // commentaires ligne (évite http://, https:// grossièrement)
  s = s.replace(/(^|[^:\\])\/\/.*$/gm, "$1");
  // virgules traînantes
  s = s.replace(/,\s*([}\]])/g, "$1");
  return s;
}

function parseMaybeJsonc(text: string, mode: ParseMode): { ok: true; value: any } | { ok: false; error: string } {
  try {
    const src = mode === "jsonc" ? stripJsonc(text) : text;
    return { ok: true, value: JSON.parse(src) };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Invalid JSON" };
  }
}

export default function JsonAnalyzer({
  initialText,
  onParsed,
  locale = "fr",
}: {
  initialText?: string;
  onParsed?: (payload: {
    text: string;
    value: unknown | null;
    error: string | null;
  }) => void;
  locale?: Locale;
}) {
  const dict = getDict(locale);
  const searchParams = useSearchParams();

  const explorerRef = React.useRef<JsonExplorerHandle>(null);

  const urlText = React.useMemo(() => {
    const p = searchParams?.get("json");
    if (!p) return null;
    try {
      return decompressFromParam(p);
    } catch {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    }
  }, [searchParams]);

  const [text, setText] = React.useState<string>(
    urlText ??
      initialText ??
      (typeof window !== "undefined" ? localStorage.getItem("json.text") || "" : "")
  );
  const [value, setValue] = React.useState<unknown | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [errorLoc, setErrorLoc] = React.useState<JsonErrLoc>(null);
  const [overview, setOverview] = React.useState<Overview | null>(null);

  const [parseMode, setParseMode] = React.useState<ParseMode>(
    (typeof window !== "undefined"
      ? (localStorage.getItem("json.mode") as ParseMode)
      : null) || "strict"
  );
  const [timings, setTimings] =
    React.useState<{ parseMs: number; summarizeMs: number; totalMs: number } | null>(null);
  const [size, setSize] = React.useState<number>(0);
  const [largeMode, setLargeMode] = React.useState(false);

  const [panel, setPanel] = React.useState<null | "jsonpath" | "schema" | "diff">(null);

  /* ------------------ CHANGEMENT: états JSONPath ------------------ */
  const [jsonPathQuery, setJsonPathQuery] = React.useState<string>("");
  const [jsonPathPointers, setJsonPathPointers] = React.useState<string[]>([]);
  const [jsonPathItems, setJsonPathItems] = React.useState<Array<{ pointer: string; value: unknown }>>([]);
  /* ---------------------------------------------------------------- */

  const [schemaText, setSchemaText] = React.useState<string>(
    "{\n  \"type\": \"object\"\n}"
  );
  const [schemaErrors, setSchemaErrors] = React.useState<
    Array<{ path: string; message: string }>
  >([]);

  const [diffText, setDiffText] = React.useState<string>("{");

  const { toasts, push, remove } = useToasts();
  const fileRef = React.useRef<HTMLInputElement>(null);

  // ---- Refs pour stabiliser le worker et garder la dernière valeur ----
  const workerRef = React.useRef<Worker | null>(null);
  const latestTextRef = React.useRef(text);
  const dictRef = React.useRef(dict);
  const localeRef = React.useRef(locale);
  const onParsedRef = React.useRef(onParsed);

  React.useEffect(() => {
    latestTextRef.current = text;
  }, [text]);
  React.useEffect(() => {
    dictRef.current = dict;
  }, [dict]);
  React.useEffect(() => {
    localeRef.current = locale;
  }, [locale]);
  React.useEffect(() => {
    onParsedRef.current = onParsed;
  }, [onParsed]);

  // ---- Crée le worker une seule fois ----
  React.useEffect(() => {
    const w = new Worker(new URL("../../lib/workers/jsonWorker.ts", import.meta.url), {
      type: "module",
    });
    const onMsg = (ev: MessageEvent) => {
      const data = ev.data as any;
      if (data?.type === "jsonpath:result") {
        // Ancien comportement: le worker renvoie { pointers: string[] }
        setJsonPathPointers(data.pointers || []);
        return;
      }
      if (data?.type === "validate:result") {
        setSchemaErrors(data.errors || []);
        return;
      }
      if (data?.type === "result") {
        const res = data as WorkerResult;
        setSize(res.size);
        setTimings(res.timings);
        setLargeMode(
          res.size > 1_500_000 || (res.timings.totalMs > 200 && res.size > 300_000)
        );
        if (res.ok) {
          setValue(res.value);
          setOverview(res.overview);
          setError(null);
          setErrorLoc(null);
          onParsedRef.current?.({ text: latestTextRef.current, value: res.value, error: null });
        } else {
          const base = (dictRef.current["json.error.invalid"] as string) ?? "JSON invalide";
          const loc = res.errorLoc;
          const withWhere = loc
            ? `${base} — ${localeRef.current === "fr" ? "ligne" : "line"} ${loc.line}, ${
                localeRef.current === "fr" ? "colonne" : "column"
              } ${loc.col}`
            : base;
          setValue(null);
          setOverview(null);
          setError(withWhere);
          setErrorLoc(loc);
          onParsedRef.current?.({ text: latestTextRef.current, value: null, error: withWhere });
        }
      }
    };
    w.addEventListener("message", onMsg);
    workerRef.current = w;
    return () => {
      w.removeEventListener("message", onMsg);
      w.terminate();
    };
  }, []);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      if (!text.trim()) {
        setValue(null);
        setOverview(null);
        setError(null);
        setErrorLoc(null);
        setTimings(null);
        setSize(0);
        return;
      }
      workerRef.current?.postMessage({
        type: "parse",
        text,
        mode: parseMode,
        topKeysSampleLimit: 800,
      });
    }, 250);
    return () => window.clearTimeout(id);
  }, [text, parseMode]);

  React.useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("json.text", text);
  }, [text]);
  React.useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("json.mode", parseMode);
  }, [parseMode]);

  /* ------------------- AJOUT: calcul des valeurs JSONPath ------------------- */
  React.useEffect(() => {
    if (!jsonPathPointers.length || value == null) {
      setJsonPathItems([]);
      return;
    }
    const items = jsonPathPointers.map((p) => ({
      pointer: p,
      value: jsonPointerGet(value, p),
    }));
    setJsonPathItems(items);
  }, [jsonPathPointers, value]);
  /* ------------------------------------------------------------------------- */

  const beautify = () => {
    try {
      const v = JSON.parse(text);
      setText(JSON.stringify(v, null, 2));
    } catch {}
  };
  const minify = () => {
    try {
      const v = JSON.parse(text);
      setText(JSON.stringify(v));
    } catch {}
  };
  const sortKeys = () => {
    try {
      const v = JSON.parse(text);
      const s = sortDeep(v);
      setText(JSON.stringify(s, null, 2));
    } catch {}
  };
  const sortDeep = (v: any): any => {
    if (Array.isArray(v)) return v.map(sortDeep);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .map((k) => [k, sortDeep((v as any)[k])])
      );
    return v;
  };
  const download = () => {
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "data.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const share = () => {
    try {
      const param = compressToParam(text);
      const url = new URL(window.location.href);
      url.searchParams.set("json", param);
      history.replaceState(null, "", url.toString());
      navigator.clipboard?.writeText(url.toString());
      push({ type: "success", title: (dict["json.share.copied"] as string) ?? "Lien copié" });
    } catch {
      push({ type: "error", title: (dict["json.share.fail"] as string) ?? "Partage impossible" });
    }
  };
  const clearSession = () => {
    setText("");
    setPanel(null);
    setSchemaErrors([]);
    setJsonPathPointers([]);
    setJsonPathItems([]);
    localStorage.removeItem("json.text");
  };

  const [dragDepth, setDragDepth] = React.useState(0);
  const isDragging = dragDepth > 0;
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
    const dictLoaded = (dict["json.toast.loaded"] as string) ?? "Fichier chargé";
    const dictError = (dict["json.toast.error"] as string) ?? "Échec du chargement du fichier";
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
        desc: `${file.name} — ${Intl.NumberFormat().format(raw.length)} ${
          locale === "fr" ? "caractères" : "chars"
        }`,
      });
    };
    reader.onerror = () => push({ type: "error", title: dictError, desc: file.name });
    reader.readAsText(file);
  };

  const runJsonPath = () => {
    if (!jsonPathQuery.trim()) return;
    workerRef.current?.postMessage({
      type: "jsonpath",
      query: jsonPathQuery,
      resultType: "pointer", // on garde le worker tel quel
    });
  };
  const gotoPointer = (p: string) => explorerRef.current?.scrollToPointer(p);
  const copyPointers = () =>
    navigator.clipboard?.writeText(jsonPathPointers.join("\n"));
  const copyValues = () =>
    navigator.clipboard?.writeText(JSON.stringify(jsonPathItems.map(i => i.value), null, 2));

  const runValidate = () => {
    try {
      const schema = JSON.parse(schemaText);
      workerRef.current?.postMessage({ type: "validate", schema });
    } catch {
      setSchemaErrors([{ path: "/", message: "Schema JSON invalide" }]);
    }
  };

  const a11y = { inputLabel: dict["json.input"], previewLabel: dict["json.preview"] };
  const performanceNote = largeMode
    ? ((dict["json.large.mode"] as string) ?? "Mode grande taille activé : rendu allégé")
    : null;

  return (
    <>
      <SpotlightCard
        className="mt-10 rounded-2xl border p-4 dark:border-white/10 backdrop-blur w-full"
        aria-label="JSON Analyzer"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">{dict["json.title"]}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs opacity-80">
            <TBtn title={(dict["json.tool.import"] as string) ?? "Importer"} onClick={handleBrowse}>
              <Upload className="h-3.5 w-3.5" />
              {dict["json.tool.import"] ?? "Importer"}
            </TBtn>
            <TBtn title={(dict["json.tool.beautify"] as string) ?? "Beautify"} onClick={beautify}>
              <Paintbrush className="h-3.5 w-3.5" />
              {dict["json.tool.beautify"] ?? "Beautify"}
            </TBtn>
            <TBtn title={(dict["json.tool.minify"] as string) ?? "Minify"} onClick={minify}>
              <Minimize2 className="h-3.5 w-3.5" />
              {dict["json.tool.minify"] ?? "Minify"}
            </TBtn>
            <TBtn title={(dict["json.tool.sort"] as string) ?? "Trier clés"} onClick={sortKeys}>
              <ArrowUpAZ className="h-3.5 w-3.5" />
              {dict["json.tool.sort"] ?? "Trier clés"}
            </TBtn>
            <TBtn
              title={(dict["json.tool.jsonpath"] as string) ?? "JSONPath"}
              onClick={() => setPanel(panel === "jsonpath" ? null : "jsonpath")}
            >
              <Search className="h-3.5 w-3.5" />
              JSONPath
            </TBtn>
            <TBtn
              title={(dict["json.tool.schema"] as string) ?? "Schéma"}
              onClick={() => setPanel(panel === "schema" ? null : "schema")}
            >
              <FileCode2 className="h-3.5 w-3.5" />
              Schema
            </TBtn>
            <TBtn
              title={(dict["json.tool.diff"] as string) ?? "Comparer"}
              onClick={() => setPanel(panel === "diff" ? null : "diff")}
            >
              <Diff className="h-3.5 w-3.5" />
              Diff
            </TBtn>
            <TBtn title={(dict["json.tool.download"] as string) ?? "Télécharger"} onClick={download}>
              <Download className="h-3.5 w-3.5" />
              {dict["json.tool.download"] ?? "Télécharger"}
            </TBtn>
            <TBtn title={(dict["json.tool.share"] as string) ?? "Partager"} onClick={share}>
              <Link2 className="h-3.5 w-3.5" />
              {dict["json.tool.share"] ?? "Partager"}
            </TBtn>
            <TBtn title={(dict["json.tool.clear"] as string) ?? "Effacer"} onClick={clearSession}>
              <Trash2 className="h-3.5 w-3.5" />
              {dict["json.tool.clear"] ?? "Effacer"}
            </TBtn>
            <label className="ml-2 inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={parseMode === "jsonc"}
                onChange={(e) => setParseMode(e.target.checked ? "jsonc" : "strict")}
              />{" "}
              <span>{dict["json.mode.jsonc"] ?? "Tolérer commentaires"}</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.jsonc,application/json,text/json"
              onChange={onFileInput}
              hidden
            />
          </div>
        </div>

        {panel === "jsonpath" && (
          <div className="mb-3 rounded-lg border p-3 dark:border-white/10" role="region" aria-label="JSONPath">
            <div className="flex items-center gap-2">
              <input
                value={jsonPathQuery}
                onChange={(e) => setJsonPathQuery(e.target.value)}
                placeholder={(dict["jsonpath.placeholder"] as string) ?? "$.items[*].id"}
                className="flex-1 rounded-md border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-sky-400/40 dark:border-white/10 dark:bg-white/5"
              />
              <TBtn title="Run JSONPath" onClick={runJsonPath}>
                <Search className="h-3.5 w-3.5" />
                Run
              </TBtn>
              <span className="text-xs opacity-70">
                {jsonPathPointers.length} {dict["json.matches"] ?? "résultats"}
              </span>
              {/* AJOUT: actions copier */}
              <TBtn title="Copier les pointeurs" onClick={copyPointers} disabled={!jsonPathPointers.length}>
                /#
              </TBtn>
              <TBtn title="Copier les valeurs" onClick={copyValues} disabled={!jsonPathItems.length}>
                {}
              </TBtn>
            </div>

            {/* AJOUT: Liste pointer + valeur */}
            {jsonPathPointers.length > 0 && (
              <div className="mt-2 max-h-60 overflow-auto rounded border p-2 text-xs dark:border-white/10">
                <ul className="space-y-1">
                  {jsonPathItems.slice(0, 200).map(({ pointer, value }) => (
                    <li key={pointer} className="flex items-start gap-2">
                      <button
                        className="shrink-0 rounded px-1 py-0.5 hover:bg-black/5 dark:hover:bg-white/10"
                        onClick={() => gotoPointer(pointer)}
                        title="Go to"
                      >
                        {pointer}
                      </button>
                      <code className="block min-w-0 flex-1 truncate">{previewValue(value)}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {panel === "schema" && (
          <div className="mb-3 rounded-lg border p-3 dark:border-white/10" role="region" aria-label="Schema">
            <div className="flex items-center gap-2">
              <textarea
                value={schemaText}
                onChange={(e) => setSchemaText(e.target.value)}
                className="h-28 flex-1 rounded-md border p-2 font-mono text-xs outline-none focus:ring-2 focus:ring-sky-400/40 dark:border-white/10 dark:bg-white/5"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                autoComplete="off"
                lang="zxx"
                wrap="off"
              />
              <TBtn title="Validate" onClick={runValidate}>
                <CheckCheck className="h-3.5 w-3.5" />
                Validate
              </TBtn>
            </div>
            {schemaErrors.length > 0 && (
              <div className="mt-2 max-h-44 overflow-auto rounded border p-2 text-xs dark:border-white/10">
                {schemaErrors.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 border-b py-1 last:border-none dark:border-white/10"
                  >
                    <button
                      className="truncate text-left hover:underline"
                      onClick={() => gotoPointer(e.path || "/")}
                    >
                      {e.path || "/"}
                    </button>
                    <span className="opacity-80">{e.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {panel === "diff" && (
          <div className="mb-3 rounded-lg border p-3 dark:border-white/10" role="region" aria-label="Diff">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="flex flex-col">
                <label className="mb-1 text-xs opacity-70">
                  {dict["json.diff.right"] ?? "JSON B (à comparer)"}
                </label>
                <textarea
                  value={diffText}
                  onChange={(e) => setDiffText(e.target.value)}
                  className="h-40 w-full rounded-md border p-2 font-mono text-xs outline-none focus:ring-2 focus:ring-sky-400/40 dark:border-white/10 dark:bg-white/5"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  autoComplete="off"
                  lang="zxx"
                  wrap="off"
                />
              </div>
              <div>
                <label className="mb-1 text-xs opacity-70">
                  {dict["json.diff.result"] ?? "Résultat"}
                </label>
                <DiffBox
                  a={value}
                  bText={diffText}
                  parseMode={parseMode}
                  dict={dict}
                  onGoto={gotoPointer}
                />
              </div>
            </div>
          </div>
        )}

        {performanceNote && (
          <div className="mb-3 rounded-md border border-amber-300/30 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-200">
            {performanceNote}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div
            className="relative flex min-h-[220px] flex-col"
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <label className="mb-2 flex items-center justify-between text-xs font-medium opacity-70">
              <span>{a11y.inputLabel}</span>
            </label>
            <div className="relative" >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label={a11y.inputLabel}
                className="min-h-[480px] w-full resize-y rounded-lg border p-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand/40 dark:border-white/10 dark:bg-white/5"
                placeholder={dict["json.placeholder"] as string}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                autoComplete="off"
                lang="zxx"
                wrap="off"
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
              <div className="mt-2 text-xs" aria-live="polite">
                <div className="rounded-md bg-red-50 p-2 text-red-700 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </div>
                {errorLoc && <ErrorSnippet text={text} line={errorLoc.line} col={errorLoc.col} />}
              </div>
            )}
          </div>

          <div className="flex min-h-[220px] flex-col">
            <label className="mb-2 text-xs font-medium opacity-70">{a11y.previewLabel}</label>
            <div className="max-h-[60vh] flex-1 overflow-hidden rounded-lg border p-0 dark:border-white/10 dark:bg-white/5">
              {!overview ? (
                <div className="p-3 text-sm opacity-60">{dict["json.empty"]}</div>
              ) : (
                <div className="flex h-full flex-col">
                  <div className="space-y-4 p-3 text-sm">
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
                    <div className="grid grid-cols-2 gap-2">
                      {overview.numberStats && (
                        <div className="rounded-lg border p-3 dark:border-white/10">
                          <div className="mb-2 text-xs font-semibold opacity-80">
                            {dict["json.numbers.title"]}
                          </div>
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
                          <div className="mb-2 text-xs font-semibold opacity-80">
                            {dict["json.arrays.title"]}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <StatSmall label={dict["json.arrays.count"]} value={overview.arrayStats.count} />
                            <StatSmall
                              label={dict["json.arrays.avg_len"]}
                              value={Number(overview.arrayStats.avgLen.toFixed(2))}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] opacity-70">
                      {typeof size === "number" && size > 0 && (
                        <span className="rounded border px-2 py-0.5 dark:border-white/10">
                          {dict["json.size"] ?? "Taille"}: {Intl.NumberFormat().format(size)}{" "}
                          {dict["json.chars"] ?? "caractères"}
                        </span>
                      )}
                      {timings && (
                        <>
                          <span className="rounded border px-2 py-0.5 dark:border-white/10">
                            parse: {timings.parseMs.toFixed(1)} ms
                          </span>
                          <span className="rounded border px-2 py-0.5 dark:border-white/10">
                            stats: {timings.summarizeMs.toFixed(1)} ms
                          </span>
                          <span className="rounded border px-2 py-0.5 dark:border-white/10">
                            total: {timings.totalMs.toFixed(1)} ms
                          </span>
                        </>
                      )}
                    </div>
                  </div>
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

function ErrorSnippet({
  text,
  line,
  col,
}: {
  text: string;
  line: number;
  col: number;
}) {
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

export type DiffOp = { op: "add" | "remove" | "replace"; path: string; value?: unknown };

function diffJson(a: any, b: any, base: string = ""): DiffOp[] {
  if (Object.is(a, b)) return [];
  const aIsObj = a && typeof a === "object";
  const bIsObj = b && typeof b === "object";
  if (Array.isArray(a) && Array.isArray(b)) {
    const ops: DiffOp[] = [];
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) ops.push(...diffJson(a[i], b[i], base + "/" + i));
    return ops;
  }
  if (aIsObj && bIsObj && !Array.isArray(a) && !Array.isArray(b)) {
    const ops: DiffOp[] = [];
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    keys.forEach((k) => {
      if (!(k in b)) ops.push({ op: "remove", path: base + "/" + k });
      else if (!(k in a)) ops.push({ op: "add", path: base + "/" + k, value: (b as any)[k] });
      else ops.push(...diffJson((a as any)[k], (b as any)[k], base + "/" + k));
    });
    return ops;
  }
  return [
    {
      op: a === undefined ? "add" : b === undefined ? "remove" : "replace",
      path: base || "/",
      value: b,
    },
  ];
}

function DiffBox({
  a,
  bText,
  parseMode,
  dict,
  onGoto,
}: {
  a: unknown;
  bText: string;
  parseMode: ParseMode;
  dict: any;
  onGoto: (p: string) => void;
}) {
  const parsedB = React.useMemo(() => parseMaybeJsonc(bText, parseMode), [bText, parseMode]);

  const ops = React.useMemo(() => {
    if (!parsedB.ok) return [];
    return diffJson(a ?? null, parsedB.value);
  }, [a, parsedB]);

  return (
    <div className="h-40 overflow-auto rounded border p-2 text-xs dark:border-white/10">
      {!parsedB.ok ? (
        <div className="opacity-80">
          {(dict["json.diff.invalidB"] as string) ?? "JSON B invalide"} — {parsedB.error}
        </div>
      ) : ops.length === 0 ? (
        <div className="opacity-60">
          {dict["json.diff.none"] ?? "Aucune différence."}
        </div>
      ) : (
        <ul className="space-y-1">
          {ops.slice(0, 500).map((op, i) => (
            <li key={i} className="flex items-center gap-2">
              <span
                className={`rounded px-1 py-0.5 ${
                  op.op === "add"
                    ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-200"
                    : op.op === "remove"
                    ? "bg-rose-200 text-rose-900 dark:bg-rose-400/20 dark:text-rose-200"
                    : "bg-amber-200 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200"
                }`}
              >
                {op.op}
              </span>
              <button className="truncate hover:underline" onClick={() => onGoto(op.path)}>
                {op.path}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
