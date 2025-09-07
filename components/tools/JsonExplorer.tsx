"use client";

import * as React from "react";
import SpotlightCard from "../visuals/spotlight-card";
import { getDict, type Locale } from "@/lib/i18n";

type Props = {
  value: unknown | null;
  className?: string;
  locale?: Locale;
};

type Region = {
  startLine: number;
  endLine: number;
  openChar: "{" | "[";
  closeChar: "}" | "]";
  startCol: number;
  trailingComma?: boolean;
};

type MatchPos = { line: number; start: number; end: number };

export default function JsonExplorer({ value, className, locale = "fr" }: Props) {
  const dict = getDict(locale);

  const pretty = React.useMemo(() => safeStringify(value, 2), [value]);
  const lines = React.useMemo(() => pretty.split(/\r?\n/), [pretty]);

  const regions = React.useMemo(() => {
    const r = buildFoldRegions(pretty);
    for (const reg of r.values()) reg.trailingComma = /,\s*$/.test(lines[reg.endLine] ?? "");
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pretty]);

  const containerRef = React.useRef<HTMLDivElement>(null);

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

  const collapseAll = React.useCallback(() => {
    const allStarts = new Set<number>();
    for (const k of regions.keys()) allStarts.add(k);
    setCollapsed(allStarts);
  }, [regions]);

  const expandAll = React.useCallback(() => {
    setCollapsed(new Set());
  }, []);

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
          for (const r of regions.values()) {
            if (r.startLine <= target.line && target.line <= r.endLine) nextSet.delete(r.startLine);
          }
          return nextSet;
        });
        setTimeout(() => {
          const el = containerRef.current?.querySelector<HTMLElement>(
            `[data-line="${target.line}"]`
          );
          el?.scrollIntoView({ block: "center" });
        }, 0);
        return next;
      });
    },
    [matches, regions]
  );

  const onFindKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      goTo(e.shiftKey ? -1 : 1);
    }
  };

  const renderedRows = React.useMemo(() => {
    const rows: React.ReactNode[] = [];
    const active = matches[activeIndex];

    for (let i = 0; i < lines.length; i++) {
      const regionAtStart = regions.get(i);

      if (regionAtStart && collapsed.has(i)) {
        rows.push(
          <CodeRow
            key={`row-${i}-collapsed`}
            lineNo={i}
            isClickable
            showChevron
            isCollapsed
            onToggle={(opts) => toggle(i, opts)}
            dict={dict}
            dataLine={i}
          >
            {renderCollapsedLineWithGuides(lines, regionAtStart)}
          </CodeRow>
        );
        i = regionAtStart.endLine;
        continue;
      }

      const enclosing = findEnclosingRegion(regions, i);
      const isClickable = !!enclosing;
      const hasChevron = !!regionAtStart;
      const startForToggle = regionAtStart ? i : enclosing?.startLine ?? i;

      const ranges = matchesByLine.get(i) ?? [];
      const activeStartOnThisLine =
        active && active.line === i ? active.start : undefined;

      rows.push(
        <CodeRow
          key={`row-${i}`}
          lineNo={i}
          isClickable={isClickable}
          showChevron={hasChevron}
          isCollapsed={enclosing ? collapsed.has(enclosing.startLine) : false}
          onToggle={isClickable ? (opts) => toggle(startForToggle, opts) : undefined}
          dict={dict}
          dataLine={i}
        >
          {renderLineWithGuides(lines[i], ranges, activeStartOnThisLine)}
        </CodeRow>
      );
    }
    return rows;
  }, [lines, regions, collapsed, toggle, dict, matchesByLine, matches, activeIndex]);

  return (
    <SpotlightCard className={`rounded-2xl border p-4 dark:border-white/10 backdrop-blur w-full ${className ?? ""}`}>
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={expandAll}
          className="rounded-full border px-3 py-1.5 text-xs hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
          title={dict["json.explorer.expand_all"] ?? "Expand all"}
        >
          {dict["json.explorer.expand_all"] ?? "Expand all"}
        </button>
        <button
          type="button"
          onClick={collapseAll}
          className="rounded-full border px-3 py-1.5 text-xs hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
          title={dict["json.explorer.collapse_all"] ?? "Collapse all"}
        >
          {dict["json.explorer.collapse_all"] ?? "Collapse all"}
        </button>
        <span className="ml-2 text-xs opacity-60">
          {dict["json.explorer.tip_recursive"] ?? "Tip: Alt/⌘/Ctrl+click = recursive toggle"}
        </span>
      </div>

      <div className="relative">
        {findOpen && (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-lg border bg-white/90 px-2 py-1 shadow-md backdrop-blur dark:border-white/10 dark:bg-neutral-900/90">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onFindKeyDown}
              placeholder={dict["find.placeholder"] ?? "Rechercher…"}
              className="w-48 rounded-md border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-sky-400/40 dark:border-white/10 dark:bg-white/5"
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
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
              />
              Aa
            </label>
            <label className="flex items-center gap-1 text-xs opacity-80">
              <input
                type="checkbox"
                checked={useRegex}
                onChange={(e) => setUseRegex(e.target.checked)}
              />
              .*
            </label>
            <label className="flex items-center gap-1 text-xs opacity-80">
              <input
                type="checkbox"
                checked={wholeWord}
                onChange={(e) => setWholeWord(e.target.checked)}
              />
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

        <div
          ref={containerRef}
          className="max-h-[70vh] overflow-auto rounded-lg border dark:border-white/10 dark:bg-white/5"
        >
          <div className="min-w-full font-mono text-[12px] leading-relaxed">
            {renderedRows}
          </div>
        </div>
      </div>

      <div className="mt-2 text-right text-xs opacity-60">
        {dict["find.hint"] ?? "Press Ctrl/⌘+F to search"}
        {regexError ? (
          <span className="ml-2 rounded bg-red-500/10 px-2 py-0.5 text-red-700 dark:text-red-300">
            {regexError}
          </span>
        ) : null}
      </div>
    </SpotlightCard>
  );
}

function CodeRow({
  lineNo,
  isClickable,
  showChevron,
  isCollapsed,
  onToggle,
  children,
  dict,
  dataLine,
}: {
  lineNo: number;
  isClickable: boolean;
  showChevron: boolean;
  isCollapsed: boolean;
  onToggle?: (opts: { recursive: boolean }) => void;
  children: React.ReactNode;
  dict: ReturnType<typeof getDict>;
  dataLine: number;
}) {
  const handleClickLine = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isClickable || !onToggle) return;
    onToggle({ recursive: !!(e.altKey || e.metaKey || e.ctrlKey) });
  };

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isClickable || !onToggle) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle({ recursive: !!(e.altKey || e.metaKey || e.ctrlKey) });
    }
  };

  const handleChevronClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isClickable || !onToggle) return;
    e.stopPropagation();
    onToggle({ recursive: !!(e.altKey || e.metaKey || e.ctrlKey) });
  };

  return (
    <div className="grid grid-cols-[3rem,1fr] gap-3 px-3 py-0.5" data-line={dataLine}>
      <div className="flex select-none items-center justify-center pr-2 text-right text-xs opacity-45 tabular-nums">
        {lineNo + 1}
      </div>

      <div
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : -1}
        aria-expanded={isClickable ? !isCollapsed : undefined}
        onClick={isClickable ? handleClickLine : undefined}
        onKeyDown={handleKey}
        className={`break-words ${isClickable ? "cursor-pointer" : ""}`}
        title={isClickable ? (isCollapsed ? (dict["json.explorer.expand"] ?? "Expand") : (dict["json.explorer.collapse"] ?? "Collapse")) : ""}
      >
        <span className="inline-flex items-start gap-1">
          {showChevron ? (
            <button
              type="button"
              onClick={handleChevronClick}
              className="-ml-1 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10"
              aria-label={isCollapsed ? (dict["json.explorer.expand"] ?? "Expand") : (dict["json.explorer.collapse"] ?? "Collapse")}
              title={isCollapsed ? (dict["json.explorer.expand"] ?? "Expand") : (dict["json.explorer.collapse"] ?? "Collapse")}
            >
              <span className="inline-block text-[10px]">{isCollapsed ? "▶" : "▼"}</span>
            </button>
          ) : (
            <span className="inline-block h-4 w-4 -ml-1" aria-hidden />
          )}
          <code className="whitespace-pre tabular-nums">{children}</code>
        </span>
      </div>
    </div>
  );
}

function renderLineWithGuides(
  line: string,
  ranges: { start: number; end: number }[],
  activeStart?: number
): React.ReactNode[] {
  const m = line.match(/^\s*/);
  const lead = m ? m[0] : "";
  const rest = line.slice(lead.length);

  const rangesForRest = ranges
    .map((r) => ({ start: r.start - lead.length, end: r.end - lead.length }))
    .filter((r) => r.end > 0);

  const guides = renderIndentGuides(lead);
  const highlighted = renderHighlightedLine(rest, rangesForRest, activeStart !== undefined ? activeStart - lead.length : undefined);
  return [...guides, ...highlighted];
}

function renderCollapsedLineWithGuides(lines: string[], region: Region) {
  const startLineText = lines[region.startLine] ?? "";
  const prefix = startLineText.slice(0, region.startCol);
  const hasComma = !!region.trailingComma;

  const out: React.ReactNode[] = [];
  out.push(...renderIndentGuides(prefix));
  const rest = prefix.replace(/^\s*/, "");
  out.push(...renderHighlightedLine(rest));
  out.push(
    <span key="brace-open" className="text-slate-500 dark:text-slate-400">
      {region.openChar}
    </span>
  );
  out.push(
    <span key="dots" className="opacity-60">
      …
    </span>
  );
  out.push(
    <span key="brace-close" className="text-slate-500 dark:text-slate-400">
      {region.closeChar}
      {hasComma ? "," : ""}
    </span>
  );
  return out;
}

function renderIndentGuides(lead: string): React.ReactNode[] {
  const vis = lead.replace(/\t/g, "  ").length;
  const levels = Math.floor(vis / 2);
  const leftover = vis % 2;

  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < levels; i++) {
    nodes.push(
      <span key={`g-${i}`} aria-hidden className="select-none text-slate-500/30 dark:text-slate-400/30">
        {"│ "}
      </span>
    );
  }
  if (leftover) {
    nodes.push(
      <span key="g-half" aria-hidden className="select-none text-slate-500/30 dark:text-slate-400/30">
        {"·"}
      </span>
    );
  }
  return nodes;
}

function buildFoldRegions(text: string) {
  const regions = new Map<number, Region>();
  let line = 0;
  let col = 0;
  const stack: Array<{ openChar: "{" | "["; line: number; col: number }> = [];
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

      if (ch === "{" || ch === "[") {
        stack.push({ openChar: ch as "{" | "[", line, col });
      } else if (ch === "}" || ch === "]") {
        const open = stack.pop();
        if (open) {
          const closeChar = ch === "}" ? "}" : "]";
          const openChar = open.openChar;
          regions.set(open.line, {
            startLine: open.line,
            endLine: line,
            openChar,
            closeChar,
            startCol: open.col,
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
  for (const [start, r] of regions.entries()) {
    if (r.startLine >= root.startLine && r.endLine <= root.endLine) starts.push(start);
  }
  starts.sort((a, b) => a - b);
  return starts;
}

function findEnclosingRegion(regions: Map<number, Region>, line: number): Region | undefined {
  let winner: Region | undefined;
  for (const r of regions.values()) {
    if (r.startLine <= line && line <= r.endLine) {
      if (!winner || (r.startLine >= winner.startLine && r.endLine <= winner.endLine)) {
        winner = r;
      }
    }
  }
  return winner;
}

const TOKEN_RE =
  /(\{|\}|\[|\]|:|,)|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b|(BigInt\([^)]+\))|(\[Function [^\]]+\])|(\[Circular\])/g;

function renderHighlightedLine(
  line: string,
  searchRanges?: { start: number; end: number }[],
  activeStart?: number
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;

  const emit = (text: string, start: number, cls: string | null) => {
    if (!text) return;
    const segments = decorateWithSearch(text, start, searchRanges ?? [], activeStart);
    if (!cls) {
      segments.forEach((seg, i) =>
        out.push(<React.Fragment key={`${start}-plain-${i}`}>{seg}</React.Fragment>)
      );
    } else {
      out.push(
        <span key={`${start}-${cls}`} className={cls}>
          {segments}
        </span>
      );
    }
  };

  while ((m = TOKEN_RE.exec(line))) {
    const idx = m.index;
    if (idx > last) {
      const plain = line.slice(last, idx);
      emit(plain, last, null);
    }

    if (m[1]) {
      emit(m[1], idx, "text-slate-500 dark:text-slate-400");
    } else if (m[2]) {
      const end = TOKEN_RE.lastIndex;
      const cls = isKeyString(line, end) ? "text-sky-700 dark:text-sky-300" : "text-emerald-700 dark:text-emerald-300";
      emit(m[2], idx, cls);
    } else if (m[3]) {
      emit(m[3], idx, "text-fuchsia-700 dark:text-fuchsia-300");
    } else if (m[4]) {
      emit(m[4], idx, "text-amber-700 dark:text-amber-300");
    } else if (m[5]) {
      emit(m[5], idx, "opacity-60");
    } else if (m[6] || m[7] || m[8]) {
      emit(m[6] || m[7] || m[8], idx, "text-violet-700 dark:text-violet-300");
    }
    last = TOKEN_RE.lastIndex;
  }
  if (last < line.length) emit(line.slice(last), last, null);
  return out;
}

function decorateWithSearch(
  text: string,
  globalStart: number,
  ranges: { start: number; end: number }[],
  activeStart?: number
): React.ReactNode[] {
  if (!ranges.length) return [text];

  const localRanges = ranges
    .map((r) => ({ start: r.start - globalStart, end: r.end - globalStart }))
    .filter((r) => r.end > 0 && r.start < text.length)
    .sort((a, b) => a.start - b.start);

  if (!localRanges.length) return [text];

  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const r of localRanges) {
    const s = Math.max(0, r.start);
    const e = Math.min(text.length, r.end);
    if (s > cursor) out.push(text.slice(cursor, s));
    const isActive = activeStart !== undefined && globalStart + s === activeStart;
    out.push(
      <mark
        key={`${globalStart}-${s}`}
        className={`rounded px-0.5 ${
          isActive
            ? "bg-amber-300 text-black dark:bg-amber-400"
            : "bg-yellow-200 text-black dark:bg-yellow-300"
        }`}
      >
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

function safeStringify(val: unknown, space = 2): string {
  try {
    const seen = new WeakSet<object>();
    const replacer = (_key: string, v: any) => {
      if (typeof v === "bigint") return `BigInt(${v.toString()})`;
      if (typeof v === "function") return `[Function ${v.name || "anonymous"}]`;
      if (typeof v === "symbol") return v.toString();
      if (v && typeof v === "object") {
        if (seen.has(v)) return "[Circular]";
        seen.add(v);
      }
      return v;
    };
    return JSON.stringify(val, replacer, space) ?? "null";
  } catch {
    try {
      return String(val);
    } catch {
      return "« unable to render JSON »";
    }
  }
}
