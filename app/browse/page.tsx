"use client";

import { useEffect, useState, useMemo } from "react";
import { loadRecords } from "@/lib/data";
import type { NTRecord, Dataset, SpeakerGroup, NTSection } from "@/lib/types";
import {
  DATASET_COLORS,
  DATASET_COLORS_LIGHT,
  DATASET_LABELS,
  BOOK_ORDER,
  SPEAKER_ORDER,
  NT_SECTION_ORDER,
  COMMONLY_CITED_COLOR,
  COMMONLY_CITED_COLOR_LIGHT,
} from "@/lib/constants";
import { makeYouVersionUrl } from "@/lib/youversion";
import { useVerse } from "@/components/VerseProvider";

// ---------------------------------------------------------------------------
// Tag style maps (shared with PassageSidebar)
// ---------------------------------------------------------------------------

const STRENGTH_STYLE: Record<string, { bg: string; fg: string }> = {
  "Explicit Command":   { bg: "#44403c", fg: "#fafaf9" },
  "Direct Imperative":  { bg: "#78716c", fg: "#fafaf9" },
  "Implicit Command":   { bg: "#e7e5e4", fg: "#78716c" },
  "Implied Command":    { bg: "#e7e5e4", fg: "#a8a29e" },
  "Warning":            { bg: "#fef3c7", fg: "#92400e" },
  "Narrative Example":  { bg: "#f5f5f4", fg: "#a8a29e" },
};

const Q2_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  "CONSISTENT":           { bg: "#e6f0ea", fg: "#1e4d33", label: "Consistent"   },
  "PARTIALLY CONSISTENT": { bg: "#fef3c7", fg: "#92400e", label: "Partial"      },
  "SELECTIVE":            { bg: "#fde8e2", fg: "#c2410c", label: "Selective"    },
  "INCONSISTENT":         { bg: "#f0e4e4", fg: "#8b1c1c", label: "Inconsistent" },
};

const STRENGTH_GROUPS = [
  "Explicit Command", "Direct Imperative", "Implicit Command",
  "Implied Command", "Warning", "Narrative Example",
] as const;

// ---------------------------------------------------------------------------
// Passage row
// ---------------------------------------------------------------------------

function PassageRow({ p }: { p: NTRecord }) {
  const { openVerse, version } = useVerse();
  const url      = makeYouVersionUrl(p.book, p.chapter, p.verse_range, version);
  const dsFg     = DATASET_COLORS[p.dataset];
  const dsBg     = DATASET_COLORS_LIGHT[p.dataset];
  const strength = p.command_strength_group ? STRENGTH_STYLE[p.command_strength_group] : null;
  const q2       = p.q2_consistency_rating   ? Q2_STYLE[p.q2_consistency_rating]        : null;

  return (
    <li className="flex gap-4 px-5 py-3.5 hover:bg-stone-100/60 transition-colors border-b border-stone-200/50 last:border-0">

      {/* Ref + meta */}
      <div className="w-[140px] shrink-0 pt-px">
        <p className="text-[13px] font-serif font-semibold text-stone-800 leading-tight">
          {p.ref}
        </p>
        <p className="text-[10px] text-stone-400 mt-0.5">{p.speaker_group}</p>
      </div>

      {/* Badges */}
      <div className="w-[110px] shrink-0 flex flex-col gap-1 pt-0.5">
        <span
          className="inline-flex items-center self-start px-1.5 py-px rounded text-[9px] font-bold"
          style={{ backgroundColor: dsBg, color: dsFg }}
        >
          {p.dataset} — {DATASET_LABELS[p.dataset]}
        </span>
        {strength && (
          <span
            className="inline-flex items-center self-start px-1.5 py-px rounded text-[9px] font-semibold"
            style={{ backgroundColor: strength.bg, color: strength.fg }}
          >
            {p.command_strength_group}
          </span>
        )}
        {q2 && (
          <span
            className="inline-flex items-center self-start px-1.5 py-px rounded text-[9px] font-semibold"
            style={{ backgroundColor: q2.bg, color: q2.fg }}
          >
            {q2.label}
          </span>
        )}
      </div>

      {/* Summary + category */}
      <div className="flex-1 min-w-0 pt-px">
        {p.category && (
          <p className="text-[10px] text-stone-400 mb-0.5">
            {p.category}{p.theme && p.theme !== p.category ? ` · ${p.theme}` : ""}
          </p>
        )}
        {p.summary ? (
          <p
            className="text-[12px] text-stone-600 leading-relaxed line-clamp-2 cursor-pointer hover:text-stone-900 transition-colors"
            onClick={() => openVerse(p.ref, { otAntecedent: p.ot_antecedent })}
            title="View verse text"
          >
            {p.summary}
          </p>
        ) : (
          <button
            onClick={() => openVerse(p.ref, { otAntecedent: p.ot_antecedent })}
            className="text-[11px] text-stone-400 hover:text-stone-600 italic transition-colors"
          >
            View verse text &rarr;
          </button>
        )}
      </div>

      {/* Right: cited + link */}
      <div className="shrink-0 flex flex-col items-end gap-1.5 pt-0.5">
        {p.commonly_cited && (
          <span
            className="inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: COMMONLY_CITED_COLOR_LIGHT, color: COMMONLY_CITED_COLOR }}
          >
            Cited
          </span>
        )}
        {url && (
          <a
            href={url} target="_blank" rel="noopener noreferrer"
            className="text-[10px] font-medium text-stone-400 hover:text-stone-600 transition-colors"
            title={`Open ${version} in YouVersion`}
          >
            ↗
          </a>
        )}
      </div>

    </li>
  );
}

// ---------------------------------------------------------------------------
// Filter pill
// ---------------------------------------------------------------------------

function Pill({
  active, onClick, children, color,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all duration-150 ${
        active ? "text-white border-transparent" : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"
      }`}
      style={active && color ? { backgroundColor: color } : {}}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type SortKey = "canonical" | "dataset" | "speaker" | "strength";

export default function BrowsePage() {
  const [records,  setRecords]  = useState<NTRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // Filters
  const [search,         setSearch]         = useState("");
  const [activeDs,       setActiveDs]       = useState<Set<Dataset>>(new Set(["A","B","D"]));
  const [speakerFilter,  setSpeakerFilter]  = useState<string>("");
  const [sectionFilter,  setSectionFilter]  = useState<string>("");
  const [strengthFilter, setStrengthFilter] = useState<string>("");
  const [citedOnly,      setCitedOnly]      = useState(false);
  const [sortBy,         setSortBy]         = useState<SortKey>("canonical");

  useEffect(() => {
    loadRecords()
      .then((r) => { setRecords(r); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const toggleDs = (ds: Dataset) => {
    setActiveDs((prev) => {
      const next = new Set(prev);
      if (next.has(ds)) { if (next.size > 1) next.delete(ds); }
      else next.add(ds);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records
      .filter((r) => activeDs.has(r.dataset))
      .filter((r) => !speakerFilter  || r.speaker_group          === speakerFilter)
      .filter((r) => !sectionFilter  || r.nt_section             === sectionFilter)
      .filter((r) => !strengthFilter || r.command_strength_group === strengthFilter)
      .filter((r) => !citedOnly      || r.commonly_cited)
      .filter((r) => !q || [r.ref, r.summary, r.category, r.theme, r.speaker]
        .some((v) => v?.toLowerCase().includes(q)));
  }, [records, activeDs, speakerFilter, sectionFilter, strengthFilter, citedOnly, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    if (sortBy === "canonical") {
      copy.sort((a, b) => {
        const di = BOOK_ORDER.indexOf(a.book) - BOOK_ORDER.indexOf(b.book);
        if (di !== 0) return di;
        return parseInt(a.chapter || "0") - parseInt(b.chapter || "0");
      });
    } else if (sortBy === "dataset") {
      copy.sort((a, b) => a.dataset.localeCompare(b.dataset) || BOOK_ORDER.indexOf(a.book) - BOOK_ORDER.indexOf(b.book));
    } else if (sortBy === "speaker") {
      copy.sort((a, b) => {
        const si = SPEAKER_ORDER.indexOf(a.speaker_group as SpeakerGroup) - SPEAKER_ORDER.indexOf(b.speaker_group as SpeakerGroup);
        return si || BOOK_ORDER.indexOf(a.book) - BOOK_ORDER.indexOf(b.book);
      });
    } else if (sortBy === "strength") {
      copy.sort((a, b) => {
        const si = STRENGTH_GROUPS.indexOf(a.command_strength_group as typeof STRENGTH_GROUPS[number])
                 - STRENGTH_GROUPS.indexOf(b.command_strength_group as typeof STRENGTH_GROUPS[number]);
        return si || BOOK_ORDER.indexOf(a.book) - BOOK_ORDER.indexOf(b.book);
      });
    }
    return copy;
  }, [filtered, sortBy]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <p className="text-stone-400 text-sm font-serif italic">Loading…</p>
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <p className="text-red-500 text-sm">Error: {error}</p>
    </div>
  );

  const activeFilterCount = [speakerFilter, sectionFilter, strengthFilter, citedOnly ? "cited" : ""]
    .filter(Boolean).length + (activeDs.size < 3 ? 1 : 0);

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <div className="flex flex-1 min-h-0 max-w-screen-xl mx-auto w-full">

        {/* ── Filter sidebar ── */}
        <aside className="w-56 shrink-0 border-r border-stone-200 flex flex-col py-8 px-5 gap-6">

          {/* Search */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Reference, topic…"
              className="w-full px-3 py-1.5 text-[12px] bg-white border border-stone-200 rounded text-stone-700 placeholder-stone-300 focus:outline-none focus:border-stone-400 transition-colors"
            />
          </div>

          {/* Datasets */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2">
              Dataset
            </p>
            <div className="flex flex-col gap-1.5">
              {(["A","B","D"] as Dataset[]).map((ds) => (
                <Pill key={ds} active={activeDs.has(ds)} onClick={() => toggleDs(ds)} color={DATASET_COLORS[ds]}>
                  <span className="font-bold">{ds}</span>
                  <span className="font-normal ml-1 opacity-80">— {DATASET_LABELS[ds]}</span>
                </Pill>
              ))}
            </div>
          </div>

          {/* Speaker */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2">
              Speaker
            </p>
            <select
              value={speakerFilter}
              onChange={(e) => setSpeakerFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-[12px] bg-white border border-stone-200 rounded text-stone-600 focus:outline-none focus:border-stone-400 transition-colors appearance-none"
            >
              <option value="">All speakers</option>
              {SPEAKER_ORDER.map((sp) => (
                <option key={sp} value={sp}>{sp}</option>
              ))}
            </select>
          </div>

          {/* NT Section */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2">
              NT Section
            </p>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-[12px] bg-white border border-stone-200 rounded text-stone-600 focus:outline-none focus:border-stone-400 transition-colors appearance-none"
            >
              <option value="">All sections</option>
              {NT_SECTION_ORDER.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Strength */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2">
              Command Strength
            </p>
            <select
              value={strengthFilter}
              onChange={(e) => setStrengthFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-[12px] bg-white border border-stone-200 rounded text-stone-600 focus:outline-none focus:border-stone-400 transition-colors appearance-none"
            >
              <option value="">All strengths</option>
              {STRENGTH_GROUPS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Cited */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2">
              SBC Cited
            </p>
            <Pill
              active={citedOnly}
              onClick={() => setCitedOnly((v) => !v)}
              color={COMMONLY_CITED_COLOR}
            >
              Cited passages only
            </Pill>
          </div>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setSpeakerFilter(""); setSectionFilter(""); setStrengthFilter("");
                setCitedOnly(false); setActiveDs(new Set(["A","B","D"])); setSearch("");
              }}
              className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors text-left"
            >
              ✕ Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
            </button>
          )}

        </aside>

        {/* ── Main list ── */}
        <main className="flex-1 min-w-0 flex flex-col">

          {/* List header */}
          <div className="flex items-center justify-between gap-4 px-5 py-5 border-b border-stone-200">
            <div>
              <h1 className="text-2xl font-serif text-stone-900 leading-tight">Browse Passages</h1>
              <p className="text-[11px] text-stone-400 mt-0.5">
                {sorted.length.toLocaleString()} of {records.length} passages
              </p>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Sort</span>
              {(["canonical","dataset","speaker","strength"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-all duration-150 ${
                    sortBy === key
                      ? "bg-stone-800 text-white border-transparent"
                      : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"
                  }`}
                >
                  {key === "canonical" ? "Canonical" : key === "dataset" ? "Dataset" : key === "speaker" ? "Speaker" : "Strength"}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-stone-400">
                <p className="text-sm">No passages match these filters.</p>
                <button
                  onClick={() => {
                    setSpeakerFilter(""); setSectionFilter(""); setStrengthFilter("");
                    setCitedOnly(false); setActiveDs(new Set(["A","B","D"])); setSearch("");
                  }}
                  className="mt-2 text-xs text-stone-400 underline hover:text-stone-600"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <ul>
                {sorted.map((p, i) => <PassageRow key={`${i}-${p.ref}-${p.dataset}`} p={p} />)}
              </ul>
            )}
          </div>

        </main>
      </div>
    </div>
  );
}
