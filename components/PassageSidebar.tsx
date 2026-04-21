"use client";

/**
 * PassageSidebar — always-visible right panel.
 *
 * Two modes:
 *  - All   (selection === null): every record that passes the pill filters,
 *           grouped by book in canonical order.
 *  - Cohort (selection set):     only the ribbon's passages, flat list.
 *           A "← All" button returns to all-mode.
 *
 * Layout / sizing is the parent's responsibility.
 */

import { useEffect } from "react";
import type { NTRecord, SpeakerGroup, Dataset, NTSection } from "@/lib/types";
import {
  DATASET_COLORS,
  DATASET_COLORS_LIGHT,
  DATASET_LABELS,
  COMMONLY_CITED_COLOR,
  COMMONLY_CITED_COLOR_LIGHT,
  BOOK_ORDER,
} from "@/lib/constants";
import { makeYouVersionUrl } from "@/lib/youversion";
import { track } from "@/lib/analytics";
import { useVerse } from "@/components/VerseProvider";

// ---------------------------------------------------------------------------
// Tag color maps
// ---------------------------------------------------------------------------

const STRENGTH_STYLE: Record<string, { bg: string; fg: string }> = {
  "Explicit Command":   { bg: "#44403c", fg: "#fafaf9" },
  "Direct Imperative":  { bg: "#78716c", fg: "#fafaf9" },
  "Implicit Command":   { bg: "#e7e5e4", fg: "#78716c" },
  "Implied Command":    { bg: "#e7e5e4", fg: "#a8a29e" },
  "Warning":            { bg: "#fef3c7", fg: "#92400e" },
  "Narrative Example":  { bg: "#f5f5f4", fg: "#a8a29e" },
};


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RibbonSelection {
  key:     string;
  otRoot:  string;      // "" when the OT Root axis is disabled
  speaker: SpeakerGroup;
  section: NTSection;
  book:    string;      // "" when the Book axis is disabled
  dataset: Dataset;
  count:   number;
}

interface PassageSidebarProps {
  selection:        RibbonSelection | null;
  records:          NTRecord[];          // already filtered by the pill controls
  onClearSelection: () => void;
}

// ---------------------------------------------------------------------------
// Shared passage row
// ---------------------------------------------------------------------------

function PassageRow({ p, dsFg }: { p: NTRecord; dsFg: string }) {
  const { openVerse, version } = useVerse();
  const url      = makeYouVersionUrl(p.book, p.chapter, p.verse_range, version);
  const strength = p.command_strength_group ? STRENGTH_STYLE[p.command_strength_group] : null;

  return (
    <li className="px-4 py-3 hover:bg-stone-100/70 transition-colors">
      {/* Ref + read link */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="text-[12px] font-semibold text-stone-800 font-serif leading-tight">
            {p.ref}
          </span>
          {p.commonly_cited && (
            <span
              className="inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold tracking-wide uppercase"
              style={{ backgroundColor: COMMONLY_CITED_COLOR_LIGHT, color: COMMONLY_CITED_COLOR }}
            >
              Cited
            </span>
          )}
        </div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ${version} in YouVersion`}
            className="flex-none text-[10px] font-medium px-1.5 py-px rounded border transition-opacity hover:opacity-70 shrink-0"
            style={{ borderColor: dsFg + "33", color: dsFg + "bb" }}
            onClick={() => track("verse_link_click", { ref: p.ref, dataset: p.dataset })}
          >
            ↗
          </a>
        )}
      </div>

      {/* Tags */}
      {strength && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          <span
            className="inline-flex items-center px-1.5 py-px rounded text-[9px] font-semibold"
            style={{ backgroundColor: strength.bg, color: strength.fg }}
          >
            {p.command_strength_group}
          </span>
        </div>
      )}

      {/* Category line */}
      {p.category && (
        <p className="text-[10px] text-stone-400 mb-0.5 leading-snug">
          {p.category}{p.theme && p.theme !== p.category ? ` · ${p.theme}` : ""}
        </p>
      )}

      {/* Summary — click to open verse text modal */}
      {p.summary ? (
        <p
          className="text-[11px] text-stone-500 leading-relaxed line-clamp-2 cursor-pointer hover:text-stone-800 transition-colors"
          onClick={() => openVerse(p.ref, { otAntecedent: p.ot_antecedent })}
          title="View verse text"
        >
          {p.summary}
        </p>
      ) : (
        <button
          onClick={() => openVerse(p.ref, { otAntecedent: p.ot_antecedent })}
          className="text-[10px] text-stone-400 hover:text-stone-600 italic transition-colors"
        >
          View verse text &rarr;
        </button>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PassageSidebar({ selection, records, onClearSelection }: PassageSidebarProps) {
  // Esc clears selection (if any)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && selection) onClearSelection(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [selection, onClearSelection]);

  // ── Cohort mode ────────────────────────────────────────────────────────────
  if (selection) {
    const cohort = records.filter(
      (r) =>
        r.speaker_group === selection.speaker &&
        r.dataset       === selection.dataset &&
        r.nt_section    === selection.section &&
        (!selection.book   || r.book              === selection.book)   &&
        (!selection.otRoot || (r.ot_root_category ?? "(uncategorized)") === selection.otRoot)
    );
    const dsBg    = DATASET_COLORS_LIGHT[selection.dataset];
    const dsFg    = DATASET_COLORS[selection.dataset];
    const dsLabel = DATASET_LABELS[selection.dataset];

    return (
      <div className="h-full flex flex-col bg-stone-50">
        {/* Header */}
        <div className="flex-none px-4 pt-4 pb-3 border-b border-stone-200">
          {/* Back button */}
          <button
            onClick={onClearSelection}
            className="flex items-center gap-1 text-[10px] font-medium text-stone-400 hover:text-stone-600 transition-colors mb-3"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M6.5 1.5 3 5l3.5 3.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            All passages
          </button>

          <h2 className="text-[14px] font-serif font-semibold text-stone-800 leading-snug">
            {selection.speaker}
            {selection.book && (
              <>
                <span className="text-stone-300 font-sans font-normal"> · </span>
                {selection.book}
              </>
            )}
          </h2>
          <p className="text-[10px] text-stone-400 mt-0.5">{selection.section}</p>

          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold"
              style={{ backgroundColor: dsBg, color: dsFg }}
            >
              {selection.dataset} — {dsLabel}
            </span>
            {selection.otRoot && selection.otRoot !== "(uncategorized)" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-200 text-stone-700">
                {selection.otRoot}
              </span>
            )}
            <span className="text-[10px] text-stone-400">
              {cohort.length} passage{cohort.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {cohort.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-xs text-stone-400">
              No passages found.
            </div>
          ) : (
            <ul className="divide-y divide-stone-200/60">
              {cohort.map((p) => (
                <PassageRow key={p.ref + p.dataset + p.category_code} p={p} dsFg={dsFg} />
              ))}
            </ul>
          )}
        </div>

        <SidebarFooter />
      </div>
    );
  }

  // ── All mode ───────────────────────────────────────────────────────────────
  // Group records by book in canonical order
  const byBook: { book: string; passages: NTRecord[] }[] = BOOK_ORDER
    .map((book) => ({ book, passages: records.filter((r) => r.book === book) }))
    .filter((g) => g.passages.length > 0);

  return (
    <div className="h-full flex flex-col bg-stone-50">
      {/* Header */}
      <div className="flex-none px-4 pt-4 pb-3 border-b border-stone-200">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">
          All Passages
        </p>
        <p className="text-[13px] font-serif text-stone-700 leading-snug">
          {records.length.toLocaleString()} record{records.length !== 1 ? "s" : ""}
        </p>
        <p className="text-[10px] text-stone-400 mt-0.5">
          Click a ribbon to filter to a cohort
        </p>
      </div>

      {/* Book-grouped list */}
      <div className="flex-1 overflow-y-auto">
        {byBook.map(({ book, passages }) => {
          // Use the dataset color of the majority dataset for this book's link tint
          const counts = { A: 0, B: 0, D: 0 } as Record<Dataset, number>;
          passages.forEach((p) => { counts[p.dataset] = (counts[p.dataset] || 0) + 1; });
          const dominant = (["A","B","D"] as Dataset[]).reduce((a, b) => counts[a] >= counts[b] ? a : b);
          const dsFg = DATASET_COLORS[dominant];

          return (
            <div key={book}>
              {/* Book header */}
              <div className="sticky top-0 z-10 px-4 py-1.5 bg-stone-100/95 border-b border-stone-200/60 backdrop-blur-sm flex items-baseline justify-between">
                <span className="text-[11px] font-semibold text-stone-600">{book}</span>
                <span className="text-[10px] text-stone-400">{passages.length}</span>
              </div>
              <ul className="divide-y divide-stone-200/40">
                {passages.map((p) => (
                  <PassageRow key={p.ref + p.dataset + p.category_code} p={p} dsFg={dsFg} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <SidebarFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared footer
// ---------------------------------------------------------------------------
function SidebarFooter() {
  const { version } = useVerse();
  return (
    <div className="flex-none px-4 py-2.5 border-t border-stone-200 bg-stone-100/80">
      <p className="text-[10px] text-stone-400">
        ↗ opens <span className="font-medium text-stone-500">{version}</span> in{" "}
        <a href="https://www.bible.com" target="_blank" rel="noopener noreferrer"
          className="text-stone-500 hover:text-stone-700 underline underline-offset-2">
          YouVersion
        </a>
        {" "}·{" "}
        <kbd className="font-mono bg-white border border-stone-200 px-1 rounded text-[9px]">Esc</kbd>{" "}
        clears selection
      </p>
    </div>
  );
}
