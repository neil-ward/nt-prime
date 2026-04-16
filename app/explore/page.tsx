"use client";

/**
 * /explore — three complementary views of the NT commands dataset.
 *
 * 1. Canon Arc       — where commands concentrate across the NT narrative arc
 * 2. Speaker Profile — whose voice dominates each dataset
 * 3. Strength Profile — the rhetorical register of each dataset
 *
 * Clicking any bar segment opens a passage sidebar showing the records
 * that belong to that specific (book/speaker/strength) × dataset slice.
 */

import { useEffect, useState } from "react";
import { loadRecords } from "@/lib/data";
import type { NTRecord, Dataset } from "@/lib/types";
import { DATASET_COLORS, DATASET_LABELS } from "@/lib/constants";
import { track } from "@/lib/analytics";
import { useVerse } from "@/components/VerseProvider";
import { makeYouVersionUrl } from "@/lib/youversion";
import CanonArc from "@/components/visualizations/CanonArc";
import SpeakerProfile from "@/components/visualizations/SpeakerProfile";
import StrengthProfile from "@/components/visualizations/StrengthProfile";

// ---------------------------------------------------------------------------
// Section wrapper — consistent heading + chart container
// ---------------------------------------------------------------------------
function VizSection({
  num, title, subtitle, insight, children,
}: {
  num: string;
  title: string;
  subtitle: string;
  insight: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-stone-200 py-12">
      <div className="flex items-start gap-6 mb-7">
        <span className="text-[10px] font-bold text-stone-300 tabular-nums pt-1 w-4 shrink-0 select-none">
          {num}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-serif text-stone-900 leading-snug mb-1">{title}</h2>
          <p className="text-sm text-stone-500 leading-relaxed max-w-2xl">{subtitle}</p>
          <p className="mt-2 text-[11px] text-stone-400 leading-relaxed max-w-2xl border-l-2 border-stone-200 pl-3 italic">
            {insight}
          </p>
        </div>
      </div>
      <div className="pl-10">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Dataset filter pill
// ---------------------------------------------------------------------------
function DsPill({
  ds, active, onToggle,
}: {
  ds: Dataset; active: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all duration-150 ${
        active ? "text-white border-transparent" : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"
      }`}
      style={active ? { backgroundColor: DATASET_COLORS[ds] } : {}}
    >
      {ds}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Passage sidebar panel
// ---------------------------------------------------------------------------
function PassagePanel({
  label, records, onClose,
}: {
  label: string;
  records: NTRecord[];
  onClose: () => void;
}) {
  const { openVerse } = useVerse();
  // Extract dataset from first record for accent colour, or use neutral
  const accentDs = records[0]?.dataset;
  const accentColor = accentDs ? DATASET_COLORS[accentDs] : "#78716c";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-none px-4 pt-4 pb-3 border-b border-stone-200">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
            Selection
          </p>
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="text-stone-300 hover:text-stone-600 transition-colors text-base leading-none mt-px"
          >
            ×
          </button>
        </div>
        <p className="text-[13px] font-serif text-stone-800 leading-snug">{label}</p>
        <p className="text-[10px] text-stone-400 mt-1">
          {records.length} passage{records.length !== 1 ? "s" : ""}
          {accentDs && (
            <span
              className="ml-2 font-semibold"
              style={{ color: accentColor }}
            >
              · {DATASET_LABELS[accentDs]}
            </span>
          )}
        </p>
      </div>

      {/* Record list */}
      <div className="flex-1 overflow-y-auto">
        {records.length === 0 ? (
          <div className="flex items-center justify-center h-20">
            <p className="text-[11px] text-stone-400">No passages in this selection.</p>
          </div>
        ) : (
          <ul className="divide-y divide-stone-200/60">
            {records.map((p) => {
              const url = makeYouVersionUrl(p.book, p.chapter, p.verse_range);
              return (
                <li
                  key={p.ref + p.dataset + p.category_code}
                  className="px-4 py-3 hover:bg-stone-50/80 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-[12px] font-semibold text-stone-800 font-serif leading-tight">
                      {p.ref}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="text-[9px] font-bold px-1.5 py-px rounded"
                        style={{
                          backgroundColor: DATASET_COLORS[p.dataset] + "22",
                          color: DATASET_COLORS[p.dataset],
                        }}
                      >
                        {p.dataset}
                      </span>
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-stone-300 hover:text-stone-500 transition-colors"
                          title="Open in YouVersion"
                          onClick={() => track("verse_link_click", { ref: p.ref, dataset: p.dataset, page: "/explore" })}
                        >
                          ↗
                        </a>
                      )}
                    </div>
                  </div>
                  {p.category && (
                    <p className="text-[9px] text-stone-400 mb-0.5 leading-snug">
                      {p.category}
                    </p>
                  )}
                  {p.summary ? (
                    <p
                      className="text-[11px] text-stone-500 leading-relaxed line-clamp-2 mt-0.5 cursor-pointer hover:text-stone-800 transition-colors"
                      onClick={() => openVerse(p.ref)}
                      title="View verse text"
                    >
                      {p.summary}
                    </p>
                  ) : (
                    <button
                      onClick={() => openVerse(p.ref)}
                      className="text-[10px] text-stone-400 hover:text-stone-600 italic transition-colors mt-0.5"
                    >
                      View verse text &rarr;
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ExplorePage() {
  const [records,     setRecords]     = useState<NTRecord[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [activeDs,    setActiveDs]    = useState<Set<Dataset>>(new Set(["A", "B", "D"]));
  const [sidebarInfo, setSidebarInfo] = useState<{ records: NTRecord[]; label: string } | null>(null);

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
    // Clear sidebar when dataset filter changes — selection may no longer apply
    setSidebarInfo(null);
    track("filter_change", { page: "/explore", dataset: ds, metadata: { action: "dataset_toggle" } });
  };

  const filtered = records.filter((r) => activeDs.has(r.dataset));

  const handleSelect = (recs: NTRecord[], label: string) => {
    // Toggle: clicking the same label again closes the sidebar
    setSidebarInfo((prev) => {
      if (prev?.label === label) return null;
      track("viz_segment_click", { page: "/explore", metadata: { label } });
      track("sidebar_open", { page: "/explore", metadata: { label, count: recs.length } });
      return { records: recs, label };
    });
  };

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

  return (
    // h-[calc(100vh-3rem)] locks the page to the viewport below the nav so
    // the sidebar and content scroll independently.
    <main className="bg-stone-50 flex overflow-hidden" style={{ height: "calc(100vh - 3rem)" }}>

      {/* ── Scrollable main content ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 pb-20">

          {/* Page header */}
          <div className="pt-12 pb-8">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-3">
              Exploratory Analysis
            </p>
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <div>
                <h1 className="text-3xl font-serif text-stone-900 leading-tight">
                  Patterns in NT Commands
                </h1>
                <p className="text-stone-500 text-sm leading-relaxed max-w-xl mt-1.5">
                  Three perspectives on the same 385-record dataset — where commands
                  concentrate, who speaks them, and how directly they are framed.
                  Click any bar segment to see its passages.
                </p>
              </div>
              {/* Global dataset filter */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mr-1">
                  Datasets
                </span>
                {(["A", "B", "D"] as Dataset[]).map((ds) => (
                  <DsPill key={ds} ds={ds} active={activeDs.has(ds)} onToggle={() => toggleDs(ds)} />
                ))}
                <span className="text-[11px] text-stone-400 ml-1">
                  {filtered.length.toLocaleString()} records
                </span>
              </div>
            </div>
          </div>

          {/* ── 1. Canon Arc ── */}
          <VizSection
            num="01"
            title="Where do commands concentrate?"
            subtitle="Each bar represents one NT book, stacked by dataset. The x-axis follows canonical order, left to right from Matthew to Revelation."
            insight="Matthew leads all Gospels books with 48 commands. Mark, despite its narrative energy, contributes only 13 — most parallel Matthew or Luke. The Pauline corpus (Romans through Philemon) accounts for roughly a third of all commands, with 1 Corinthians alone matching the entire General Epistles section."
          >
            <CanonArc records={filtered} onSelect={handleSelect} />
          </VizSection>

          {/* ── 2. Speaker Profile ── */}
          <VizSection
            num="02"
            title="Whose voice shapes each dataset?"
            subtitle="Horizontal bars show total commands per speaker, segmented by dataset. Ordered by canonical speaker prominence."
            insight="Jesus accounts for 63 % of all Dataset A commands — mercy and justice are overwhelmingly his voice. Paul dominates Dataset D (Social Codes), contributing 52 % of those records, including the household codes and liturgical directives that have been most selectively applied in contemporary church practice."
          >
            <SpeakerProfile records={filtered} onSelect={handleSelect} />
          </VizSection>

          {/* ── 3. Strength Profile ── */}
          <VizSection
            num="03"
            title="How directly are the commands framed?"
            subtitle="Proportional bars show the rhetorical register of each dataset — from Explicit Command (unambiguous directive) to Narrative Example (story-shaped teaching)."
            insight="Dataset D stands apart: 79 % of its records are classified as Explicit Command, the highest-certainty rhetorical form — direct, unambiguous, first-person directives. Yet these are the passages most flagged for inconsistent application in the Q2 analysis. Datasets A and B lean on Direct Imperatives and Narrative Examples, suggesting their commands are often embedded in story or argument rather than rule."
          >
            <StrengthProfile records={filtered} onSelect={handleSelect} />
          </VizSection>

        </div>
      </div>

      {/* ── Passage sidebar ── */}
      {sidebarInfo && (
        <aside className="w-72 xl:w-80 shrink-0 border-l border-stone-200 bg-white flex flex-col overflow-hidden">
          <PassagePanel
            label={sidebarInfo.label}
            records={sidebarInfo.records}
            onClose={() => setSidebarInfo(null)}
          />
        </aside>
      )}

    </main>
  );
}
