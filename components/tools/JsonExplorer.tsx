"use client";

import * as React from "react";
import { getDict, type Locale } from "@/lib/i18n";
import SpotlightCard from "../visuals/spotlight-card";

export type JsonExplorerHandle = {
  scrollToLine: (line: number) => void;
  scrollToPointer: (pointer: string) => void;
};

type Props = {
  value: unknown | null;
  className?: string;
  locale?: Locale;
  performanceMode?: boolean;
};

type Region = {
  startLine: number;
  endLine: number;
  openChar: "{" | "[";
  closeChar: "}" | "]";
  startCol: number;
  trailingComma?: boolean;
  depth: number; // ajout pour Collapse by level
};

type MatchPos = { line: number; start: number; end: number };

export default React.forwardRef<JsonExplorerHandle, Props>(function JsonExplorer(
  { value, className, locale = "fr", performanceMode = false },
  ref
) {
  const dict = getDict(locale);
  void performanceMode;

  const fm = React.useMemo(() => formatWithMap(value, 2), [value]);
  const pretty = fm.text;
  const pathToLine = fm.pathToLine;
  const lines = React.useMemo(() => pretty.split(/\r?\n/), [pretty]);

  const regions = React.useMemo(() => {
    const r = buildFoldRegions(pretty);
    for (const reg of r.values()) reg.trailingComma = /,\s*$/.test(lines[reg.endLine] ?? "");
    return r;
  }, [pretty, lines]);

  const [collapsed, setCollapsed] = React.useState<Set<number>>(new Set());

  const toggle = React.useCallback(
    (line: number, opts?: { recursive?: boolean }) => {
      const region = regions.get(line) ?? findEnclosingRegion(regions, line);
      if (!region) return;
      const start = region.startLine;
      setCollapsed((prev) => {
        const next = new Set(prev);
        const nested = collectNestedStarts(regions, region);
        const wasCollapsed = next.has(start);
        const recursive = !!opts?.recursive;
        if (wasCollapsed) {
          if (recursive) for (const l of nested) next.delete(l);
          else next.delete(start);
        } else {
          if (recursive) for (const l of nested) next.add(l);
          else next.add(start);
        }
        return next;
      });
    },
    [regions]
  );

  // --- Actions barre outils ---
  const expandAll = React.useCallback(() => setCollapsed(new Set()), []);
  const collapseAll = React.useCallback(
    () => setCollapsed(new Set(Array.from(regions.keys()))),
    [regions]
  );
  const collapseToLevel = React.useCallback(
    (lvl: number) => {
      const set = new Set<number>();
      for (const [start, r] of regions.entries()) if (r.depth >= lvl) set.add(start);
      setCollapsed(set);
    },
    [regions]
  );

  const visibleLines = React.useMemo(() => {
    if (!collapsed.size) return lines.map((_, i) => i);
    const hidden = new Array<boolean>(lines.length).fill(false);
    for (const start of collapsed) {
      const reg = regions.get(start);
      if (!reg) continue;
      for (let i = reg.startLine + 1; i <= reg.endLine; i++) hidden[i] = true;
    }
    const vis: number[] = [];
    for (let i = 0; i < lines.length; i++) if (!hidden[i]) vis.push(i);
    return vis;
  }, [collapsed, lines, regions]);

  const [findOpen, setFindOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [matchCase, setMatchCase] = React.useState(false);
  const [useRegex, setUseRegex] = React.useState(false);
  const [wholeWord, setWholeWord] = React.useState(false);
  const [matches, setMatches] = React.useState<MatchPos[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [regexError, setRegexError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindOpen(true);
        setTimeout(() => inputRef.current?.select(), 0);
      } else if (e.key === "Escape" && findOpen) {
        e.preventDefault();
        setFindOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [findOpen]);

  React.useEffect(() => {
    if (!query) {
      setMatches([]);
      setActiveIndex(0);
      setRegexError(null);
      return;
    }
    const pattern = buildPattern(query, { useRegex, matchCase, wholeWord });
    if (!pattern.ok) {
      setMatches([]);
      setActiveIndex(0);
      setRegexError(pattern.error ?? "Invalid pattern");
      return;
    }
    setRegexError(null);
    const regs: MatchPos[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      pattern.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.re.exec(line))) {
        const text = m[0];
        const start = m.index;
        const end = start + (text?.length || 1);
        regs.push({ line: i, start, end });
        if (pattern.re.lastIndex === m.index) pattern.re.lastIndex++;
      }
    }
    setMatches(regs);
    setActiveIndex(regs.length ? 0 : 0);
  }, [query, useRegex, matchCase, wholeWord, lines]);

  const matchesByLine = React.useMemo(() => {
    const map = new Map<number, { start: number; end: number }[]>();
    matches.forEach((m) => {
      const arr = map.get(m.line) ?? [];
      arr.push({ start: m.start, end: m.end });
      map.set(m.line, arr);
    });
    for (const arr of map.values()) arr.sort((a, b) => a.start - b.start);
    return map;
  }, [matches]);

  const goTo = React.useCallback(
    (delta: number) => {
      if (!matches.length) return;
      setActiveIndex((prev) => {
        const next = (prev + delta + matches.length) % matches.length;
        const target = matches[next];
        setCollapsed((prevSet) => {
          const nextSet = new Set(prevSet);
          for (const r of regions.values())
            if (r.startLine <= target.line && target.line <= r.endLine) nextSet.delete(r.startLine);
          return nextSet;
        });
        setTimeout(() => scrollToLineInternal(target.line, "center"), 0);
        return next;
      });
    },
    [matches, regions]
  );

  const minimapMarkers = React.useMemo(() => {
    if (!matches.length) return [] as number[];
    const total = lines.length || 1;
    return matches.map((m) => Math.max(0, Math.min(1, m.line / total)));
  }, [matches, lines.length]);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const itemSize = 20; // px

  const scrollToLineInternal = (
    lineNo: number,
    align: "start" | "center" | "end" | "auto" = "center"
  ) => {
    const idx = visibleLines.indexOf(lineNo);
    if (idx < 0) return;
    const el = containerRef.current;
    if (!el) return;
    const targetTop = idx * itemSize;
    const h = el.clientHeight;
    let top = targetTop;
    if (align === "center") top = targetTop - Math.max(0, (h - itemSize) / 2);
    else if (align === "end") top = targetTop - Math.max(0, h - itemSize);
    const maxTop = Math.max(0, visibleLines.length * itemSize - h);
    el.scrollTo({ top: Math.max(0, Math.min(top, maxTop)) });
  };

  React.useImperativeHandle(
    ref,
    () => ({
      scrollToLine: (line) => scrollToLineInternal(line, "center"),
      scrollToPointer: (ptr) => {
        const ln = pathToLine.get(ptr);
        if (typeof ln === "number") {
          setCollapsed((prev) => {
            const next = new Set(prev);
            for (const r of regions.values()) if (r.startLine <= ln && ln <= r.endLine) next.delete(r.startLine);
            return next;
          });
          setTimeout(() => scrollToLineInternal(ln, "center"), 16);
        }
      },
    }),
    [visibleLines, regions, pathToLine]
  );

  return (
    <SpotlightCard
      className="mt-10 rounded-2xl border p-4 dark:border-white/10 backdrop-blur max-w-full"
      aria-label="JSON Analyzer"
    >
      <div className={`relative ${className ?? ""}`} role="treegrid" aria-label={dict["json.preview"] ?? "Aperçu JSON"}>
        {/* Barre d’actions */}
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs opacity-80">
          <button onClick={expandAll} className="rounded border px-2 py-1 dark:border-white/10">
            {dict["json.explorer.expandAll"] ?? "Expand all"}
          </button>
          <button onClick={collapseAll} className="rounded border px-2 py-1 dark:border-white/10">
            {dict["json.explorer.collapseAll"] ?? "Collapse all"}
          </button>
          <span className="mx-1 opacity-50">|</span>
          <button onClick={() => collapseToLevel(1)} className="rounded border px-2 py-1 dark:border-white/10">
            {dict["json.explorer.level1"] ?? "Level 1"}
          </button>
          <button onClick={() => collapseToLevel(2)} className="rounded border px-2 py-1 dark:border-white/10">
            {dict["json.explorer.level2"] ?? "Level 2"}
          </button>
          <button onClick={() => collapseToLevel(3)} className="rounded border px-2 py-1 dark:border-white/10">
            {dict["json.explorer.level3"] ?? "Level 3"}
          </button>
          <span className="mx-1 opacity-50">|</span>
          <button onClick={() => setFindOpen((v) => !v)} className="rounded border px-2 py-1 dark:border-white/10">
            {findOpen ? (dict["find.close"] ?? "Close Find") : (dict["find.open"] ?? "Find")}
          </button>
          <span className="ml-auto rounded border px-2 py-0.5 dark:border-white/10">
            {Intl.NumberFormat().format(lines.length)} {dict["json.lines"] ?? "lines"}
          </span>
        </div>

        {/* Find overlay */}
        {findOpen && (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-lg border bg-white/90 px-2 py-1 shadow-md backdrop-blur dark:border-white/10 dark:bg-neutral-900/90">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dict["find.placeholder"] ?? "Rechercher…"}
              className="w-48 rounded-md border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-sky-400/40 dark:border-white/10 dark:bg白/5"
            />
            <button
              type="button"
              onClick={() => goTo(-1)}
              disabled={!matches.length}
              className="rounded-md border px-2 py-1 text-xs disabled:opacity-40 dark:border-white/10"
              title={dict["find.prev"] ?? "Previous (Shift+Enter)"}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => goTo(1)}
              disabled={!matches.length}
              className="rounded-md border px-2 py-1 text-xs disabled:opacity-40 dark:border-white/10"
              title={dict["find.next"] ?? "Next (Enter)"}
            >
              ↓
            </button>
            <span className="px-1 text-xs tabular-nums opacity-70">
              {matches.length ? `${activeIndex + 1} / ${matches.length}` : "0 / 0"}
            </span>
            <label className="flex items-center gap-1 text-xs opacity-80">
              <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} />
              Aa
            </label>
            <label className="flex items-center gap-1 text-xs opacity-80">
              <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} />
              .*
            </label>
            <label className="flex items-center gap-1 text-xs opacity-80">
              <input type="checkbox" checked={wholeWord} onChange={(e) => setWholeWord(e.target.checked)} />
              W
            </label>
            <button
              type="button"
              onClick={() => setFindOpen(false)}
              className="rounded-md border px-2 py-1 text-xs dark:border-white/10"
              title={dict["find.close"] ?? "Close (Esc)"}
            >
              ✕
            </button>
          </div>
        )}

        <div className="relative">
          <div
            ref={containerRef}
            className="h-[600px] min-h-[200px] max-h-[80vh] w-full overflow-auto overscroll-contain resize-y"
            role="rowgroup"
            aria-rowcount={visibleLines.length}
          >
            {visibleLines.map((lineNo, visIdx) => {
              const regionAtStart = regions.get(lineNo);
              const enclosing = findEnclosingRegion(regions, lineNo);
              const isClickable = !!enclosing;
              const hasChevron = !!regionAtStart;
              const isCollapsed = enclosing ? collapsed.has(enclosing.startLine) : false;
              const startForToggle = regionAtStart ? lineNo : enclosing?.startLine ?? lineNo;
              const ranges = matchesByLine.get(lineNo) ?? [];

              return (
                <div
                  key={lineNo}
                  className="grid grid-cols-[3rem,1fr] gap-3 px-3 py-0.5"
                  style={{ height: itemSize, lineHeight: `${itemSize}px` }}
                  role="row"
                  aria-rowindex={lineNo + 1}
                  data-vis-index={visIdx}
                >
                  <div className="flex select-none items-center justify-center pr-2 text-right text-xs opacity-45 tabular-nums">
                    {lineNo + 1}
                  </div>

                  {/* IMPORTANT: min-w-0 pour autoriser la colonne à rétrécir et utiliser le scroll du conteneur */}
                  <div
                    role={isClickable ? "button" : undefined}
                    tabIndex={isClickable ? 0 : -1}
                    aria-expanded={isClickable ? !isCollapsed : undefined}
                    // onClick={
                    //   isClickable
                    //     ? (e) => toggle(startForToggle, { recursive: !!(e.altKey || e.metaKey || e.ctrlKey) })
                    //     : undefined
                    // }
                    onKeyDown={(e) => {
                      if (!isClickable) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(startForToggle, { recursive: !!(e.altKey || e.metaKey || e.ctrlKey) });
                      }
                    }}
                    className={`min-w-0 ${isClickable ? "cursor-pointer" : ""}`}
                    title={
                      isClickable
                        ? isCollapsed
                          ? dict["json.explorer.expand"] ?? "Expand"
                          : dict["json.explorer.collapse"] ?? "Collapse"
                        : ""
                    }
                  >
                    <span className="inline-flex items-start gap-1">
                      {hasChevron ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(startForToggle, { recursive: !!(e.altKey || e.metaKey || e.ctrlKey) });
                          }}
                          className="-ml-1 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10"
                          aria-label={
                            isCollapsed ? dict["json.explorer.expand"] ?? "Expand" : dict["json.explorer.collapse"] ?? "Collapse"
                          }
                          title={
                            isCollapsed ? dict["json.explorer.expand"] ?? "Expand" : dict["json.explorer.collapse"] ?? "Collapse"
                          }
                        >
                          <span className="inline-block text-[10px]">{isCollapsed ? "▶" : "▼"}</span>
                        </button>
                      ) : (
                        <span className="inline-block h-4 w-4 -ml-1" aria-hidden />
                      )}
                      <code className="whitespace-pre tabular-nums text-[11px]">{renderLine(lines[lineNo], ranges)}</code>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Minimap + match markers */}
          <div className="absolute right-1 top-2 bottom-2 w-1 rounded bg-black/10 dark:bg-white/10">
            {minimapMarkers.map((p, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 h-0.5"
                style={{ top: `calc(${p * 100}% - 1px)` }}
              />
            ))}
          </div>
        </div>

        <div className="mt-2 text-right text-xs opacity-60">
          {dict["find.hint"] ?? "Press Ctrl/⌘+F to search"}
          {regexError ? (
            <span className="ml-2 rounded bg-red-500/10 px-2 py-0.5 text-red-700 dark:text-red-300">{regexError}</span>
          ) : null}
        </div>
      </div>
    </SpotlightCard>
  );
});

function renderLine(line: string, ranges: { start: number; end: number }[]) {
  const out: React.ReactNode[] = [];
  let last = 0;
  const TOKEN_RE =
    /(\{|\}|\[|\]|:|,)|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b/gmu;
  const emit = (text: string, start: number, cls: string | null) => {
    if (!text) return;
    const segs = decorateWithSearch(text, start, ranges);
    if (!cls) segs.forEach((seg, i) => out.push(<React.Fragment key={`${start}-plain-${i}`}>{seg}</React.Fragment>));
    else out.push(<span key={`${start}-${cls}`} className={cls}>{segs}</span>);
  };
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(line))) {
    const idx = m.index;
    if (idx > last) emit(line.slice(last, idx), last, null);
    if (m[1]) emit(m[1], idx, "text-slate-500 dark:text-slate-400");
    else if (m[2]) emit(m[2], idx, isKeyString(line, TOKEN_RE.lastIndex) ? "text-sky-700 dark:text-sky-300" : "text-emerald-700 dark:text-emerald-300");
    else if (m[3]) emit(m[3], idx, "text-fuchsia-700 dark:text-fuchsia-300");
    else if (m[4]) emit(m[4], idx, "text-amber-700 dark:text-amber-300");
    else if (m[5]) emit(m[5], idx, "opacity-60");
    last = TOKEN_RE.lastIndex;
  }
  if (last < line.length) emit(line.slice(last), last, null);
  return out;
}

function decorateWithSearch(text: string, globalStart: number, ranges: { start: number; end: number }[]) {
  if (!ranges.length) return [text] as React.ReactNode[];
  const localRanges = ranges
    .map((r) => ({ start: r.start - globalStart, end: r.end - globalStart }))
    .filter((r) => r.end > 0 && r.start < text.length)
    .sort((a, b) => a.start - b.start);
  if (!localRanges.length) return [text] as React.ReactNode[];
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const r of localRanges) {
    const s = Math.max(0, r.start);
    const e = Math.min(text.length, r.end);
    if (s > cursor) out.push(text.slice(cursor, s));
    out.push(
      <mark key={`${globalStart}-${s}`} className="rounded px-0.5 bg-yellow-200 text-black dark:bg-yellow-300">
        {text.slice(s, e)}
      </mark>
    );
    cursor = e;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function isKeyString(fullLine: string, endIndex: number) {
  let j = endIndex;
  while (j < fullLine.length) {
    const ch = fullLine[j];
    if (ch === " " || ch === "\t") {
      j++;
      continue;
    }
    return ch === ":";
  }
  return false;
}

function buildPattern(
  q: string,
  opts: { useRegex: boolean; matchCase: boolean; wholeWord: boolean }
): { ok: true; re: RegExp } | { ok: false; error?: string } {
  try {
    let source = q;
    if (!opts.useRegex) {
      source = escapeRegExp(q);
      if (opts.wholeWord) source = `\\b${source}\\b`;
    } else {
      if (opts.wholeWord) source = `\\b(?:${source})\\b`;
    }
    const flags = `${opts.matchCase ? "" : "i"}gu`;
    const re = new RegExp(source, flags);
    return { ok: true, re };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Invalid regex" };
  }
}
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFoldRegions(text: string) {
  const regions = new Map<number, Region>();
  let line = 0;
  let col = 0;
  const stack: Array<{ openChar: "{" | "["; line: number; col: number; depth: number }> = [];
  let inStr = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\n") {
      line++;
      col = 0;
      continue;
    }
    if (inStr) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inStr = false;
      }
      col++;
      continue;
    } else {
      if (ch === '"') {
        inStr = true;
        col++;
        continue;
      }
      if (ch === "{") {
        stack.push({ openChar: "{", line, col, depth: stack.length });
      } else if (ch === "[") {
        stack.push({ openChar: "[", line, col, depth: stack.length });
      } else if (ch === "}") {
        const open = stack.pop();
        if (open) {
          regions.set(open.line, {
            startLine: open.line,
            endLine: line,
            openChar: open.openChar,
            closeChar: "}",
            startCol: open.col,
            depth: open.depth,
          });
        }
      } else if (ch === "]") {
        const open = stack.pop();
        if (open) {
          regions.set(open.line, {
            startLine: open.line,
            endLine: line,
            openChar: open.openChar,
            closeChar: "]",
            startCol: open.col,
            depth: open.depth,
          });
        }
      }
      col++;
    }
  }
  return regions;
}
function collectNestedStarts(regions: Map<number, Region>, root: Region): number[] {
  const starts: number[] = [];
  for (const [start, r] of regions.entries())
    if (r.startLine >= root.startLine && r.endLine <= root.endLine) starts.push(start);
  starts.sort((a, b) => a - b);
  return starts;
}
function findEnclosingRegion(regions: Map<number, Region>, line: number): Region | undefined {
  let winner: Region | undefined;
  for (const r of regions.values())
    if (r.startLine <= line && line <= r.endLine) {
      if (!winner || (r.startLine >= winner.startLine && r.endLine <= winner.endLine)) winner = r;
    }
  return winner;
}

function formatWithMap(val: unknown, space = 2): { text: string; pathToLine: Map<string, number> } {
  const lines: string[] = [];
  const pathToLine = new Map<string, number>();
  const indent = (n: number) => " ".repeat(n);
  const esc = (s: string) => JSON.stringify(s);
  const ptrSeg = (s: string) => s.replace(/~/g, "~0").replace(/\//g, "~1");

  const write = (v: any, d: number, ptr: string) => {
    if (v === null) {
      push("null");
      return;
    }
    const t = typeof v;
    if (t === "number" || t === "boolean") {
      push(String(v));
      return;
    }
    if (t === "string") {
      push(JSON.stringify(v));
      return;
    }
    if (typeof v === "bigint") {
      push(JSON.stringify(`BigInt(${v.toString()})`));
      return;
    }
    if (typeof v === "function") {
      push(JSON.stringify(`[Function ${v.name || "anonymous"}]`));
      return;
    }
    if (Array.isArray(v)) {
      push("[");
      nl();
      for (let i = 0; i < v.length; i++) {
        linebuf += indent(d + space);
        pathToLine.set(`${ptr}/${i}`, lines.length);
        write(v[i], d + space, `${ptr}/${i}`);
        if (i < v.length - 1) linebuf += ",";
        nl();
      }
      linebuf += indent(d) + "]";
      return;
    }
    if (v && typeof v === "object") {
      const ks = Object.keys(v);
      push("{");
      nl();
      ks.forEach((k, idx) => {
        linebuf += indent(d + space);
        const keyStr = `${esc(k)}: `;
        linebuf += keyStr;
        pathToLine.set(`${ptr}/${ptrSeg(k)}`, lines.length);
        write((v as any)[k], d + space, `${ptr}/${ptrSeg(k)}`);
        if (idx < ks.length - 1) linebuf += ",";
        nl();
      });
      linebuf += indent(d) + "}";
      return;
    }
    push(JSON.stringify(String(v)));
  };

  let linebuf = "";
  const push = (s: string) => {
    linebuf += s;
  };
  const nl = () => {
    lines.push(linebuf);
    linebuf = "";
  };

  write(val, 0, "");
  nl();
  return { text: lines.join("\n"), pathToLine };
}
