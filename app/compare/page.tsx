"use client";

import { useEffect, useState } from "react";
import ParallelSets, { type RibbonClickPayload } from "@/components/visualizations/ParallelSets";
import PassageSidebar, { type RibbonSelection } from "@/components/PassageSidebar";
import { loadRecords, loadAggregates } from "@/lib/data";
import type { NTRecord, Aggregates, Dataset } from "@/lib/types";
import { DATASET_COLORS, DATASET_LABELS, COMMONLY_CITED_COLOR } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Tooltip wrapper
// ---------------------------------------------------------------------------
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="relative group/tip inline-flex">
      {children}
      <span
        role="tooltip"
        className="
          pointer-events-none absolute z-50
          bottom-full left-1/2 -translate-x-1/2 mb-2
          w-max max-w-[260px] text-left
          px-3 py-2 text-[11px] leading-relaxed
          bg-stone-800 text-stone-200 rounded shadow-xl
          opacity-0 group-hover/tip:opacity-100
          transition-opacity duration-150 delay-500
          whitespace-normal
        "
      >
        {label}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-800" />
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stat cell
// ---------------------------------------------------------------------------
function Stat({ label, value, sub, accent = false }: {
  label: string; value: string; sub: string; accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">{label}</p>
      <p className="text-2xl font-serif font-semibold leading-none"
        style={{ color: accent ? COMMONLY_CITED_COLOR : "#1c1917" }}>
        {value}
      </p>
      <p className="text-[11px] text-stone-400 leading-snug">{sub}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const SIDEBAR_W = 300;

export default function ComparePage() {
  const [records,    setRecords]    = useState<NTRecord[]>([]);
  const [aggregates, setAggregates] = useState<Aggregates | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const [activeDatasets,    setActiveDatasets]    = useState<Set<Dataset>>(new Set(["A", "B", "D"]));
  const [commonlyCitedOnly, setCommonlyCitedOnly] = useState(false);
  const [primaryOnly,       setPrimaryOnly]       = useState(false);
  const [showBook,          setShowBook]          = useState(false);
  const [showOTRoot,        setShowOTRoot]        = useState(false);
  const [colorBy,           setColorBy]           = useState<"dataset" | "speaker" | "otRoot">("dataset");
  const [selectedRibbon,    setSelectedRibbon]    = useState<RibbonSelection | null>(null);
  const [showStats,         setShowStats]         = useState(false);

  useEffect(() => {
    Promise.all([loadRecords(), loadAggregates()])
      .then(([recs, agg]) => { setRecords(recs); setAggregates(agg); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const toggleDataset = (ds: Dataset) => {
    setActiveDatasets((prev) => {
      const next = new Set(prev);
      if (next.has(ds)) { if (next.size > 1) next.delete(ds); }
      else next.add(ds);
      return next;
    });
  };

  const vizRecords = records
    .filter((r) => activeDatasets.has(r.dataset))
    .filter((r) => !primaryOnly || r.primary_record);

  const visibleCount = commonlyCitedOnly
    ? vizRecords.filter((r) => r.commonly_cited).length
    : vizRecords.length;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100">
      <p className="text-stone-400 text-sm font-serif italic">Loading…</p>
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100">
      <p className="text-red-500 text-sm">Error: {error}</p>
    </div>
  );

  const ratios = aggregates?.key_ratios;

  const extraHeight = (showBook ? 80 : 0) + (showOTRoot ? 40 : 0);
  const vizHeight = 600 + extraHeight;

  return (
    <div className="min-h-screen bg-stone-100">
      <main className="flex flex-col px-6 py-8 lg:px-10">

        {/* Header */}
        <header className="mb-6 pb-5 border-b border-stone-200">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2">
            NT Commands Research
          </p>
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <h1 className="text-3xl font-serif text-stone-900 leading-tight">
              What Does the New Testament Emphasize?
            </h1>
            {/* Stats toggle */}
            <button
              onClick={() => setShowStats((v) => !v)}
              className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors shrink-0 flex items-center gap-1"
            >
              <span>{showStats ? "▾" : "▸"}</span>
              <span>Key statistics</span>
            </button>
          </div>
          <p className="text-stone-500 text-sm max-w-2xl leading-relaxed mt-1.5">
            Each ribbon traces a cohort of passages from their speaker through their NT location
            and command dataset. Width is proportional to record count. Click any ribbon to
            browse its passages.
          </p>

          {/* Collapsible stats */}
          {showStats && ratios && (
            <div className="flex flex-wrap gap-8 mt-5 pt-5 border-t border-stone-100">
              <Stat
                label="Mercy vs. Doctrine"
                value={`${ratios.mercy_vs_doctrine.toFixed(2)}:1`}
                sub="Dataset A vs. B overall"
              />
              <div className="w-px bg-stone-200 self-stretch hidden sm:block" />
              <Stat
                label="In the Gospels"
                value={`${ratios.gospels_mercy_vs_doctrine.toFixed(2)}:1`}
                sub="Mercy vs. Doctrine"
              />
              <div className="w-px bg-stone-200 self-stretch hidden sm:block" />
              <Stat
                label="Jesus speaks mercy"
                value={`${Math.round(ratios.jesus_mercy_pct * 100)}%`}
                sub="of all Dataset A commands"
              />
              <div className="w-px bg-stone-200 self-stretch hidden sm:block" />
              <Stat
                label="Commonly cited"
                value={`${ratios.commonly_cited_total}`}
                sub="commands tagged across A, B & D"
                accent
              />
            </div>
          )}
        </header>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 mb-5">

          <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mr-1 self-center">
            Datasets
          </span>

          <Tip label="Mercy, Justice & Generosity · 136 commands. Passages where NT authors command compassion, care for the poor, forgiveness, and economic justice. Primarily drawn from Jesus's Sermon on the Mount, the prophetic ethics tradition, and Pauline social teaching.">
            <button onClick={() => toggleDataset("A")}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all duration-150 ${activeDatasets.has("A") ? "text-white border-transparent" : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"}`}
              style={activeDatasets.has("A") ? { backgroundColor: DATASET_COLORS.A } : {}}>
              A — {DATASET_LABELS.A}
            </button>
          </Tip>

          <Tip label="Core Doctrine & Belief · 149 commands. Commands grounding the faith itself: repentance, belief, baptism, perseverance, sound doctrine, and spiritual warfare. These form the backbone of evangelical catechesis and are heavily cited in confessional documents like the Baptist Faith & Message.">
            <button onClick={() => toggleDataset("B")}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all duration-150 ${activeDatasets.has("B") ? "text-white border-transparent" : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"}`}
              style={activeDatasets.has("B") ? { backgroundColor: DATASET_COLORS.B } : {}}>
              B — {DATASET_LABELS.B}
            </button>
          </Tip>

          <Tip label="Social Codes & Liturgy · 100 commands. Commands governing community life: household relationships (the 'household codes'), church order, worship practices, and moral purity. Includes directives on marriage, gender roles, congregational conduct, and liturgical practice.">
            <button onClick={() => toggleDataset("D")}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all duration-150 ${activeDatasets.has("D") ? "text-white border-transparent" : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"}`}
              style={activeDatasets.has("D") ? { backgroundColor: DATASET_COLORS.D } : {}}>
              D — {DATASET_LABELS.D}
            </button>
          </Tip>

          <span className="text-stone-200 self-center select-none mx-1">|</span>

          <Tip label="183 of 385 commands appear in SBC doctrinal literature — the Baptist Faith & Message and related confessional texts. The amber sub-ribbon shows what proportion of each cohort those passages represent. Ghost ribbons show the full cohort for reference.">
            <button
              onClick={() => setCommonlyCitedOnly((v) => !v)}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all duration-150 ${commonlyCitedOnly ? "text-white border-transparent" : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"}`}
              style={commonlyCitedOnly ? { backgroundColor: COMMONLY_CITED_COLOR } : {}}>
              Cited overlay
            </button>
          </Tip>

          <Tip label="Many commands appear in multiple Gospels. 'Love your neighbor' is recorded in Matt 22:39, Mark 12:31, and Luke 10:27 — three records, one command. Toggle to count each unique command once (385 → 311 records). Largest effect in the Gospels where parallel accounts are most common.">
            <button
              onClick={() => setPrimaryOnly((v) => !v)}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all duration-150 ${primaryOnly ? "bg-stone-800 text-white border-transparent" : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"}`}>
              Primary only
            </button>
          </Tip>

          <span className="text-stone-200 self-center select-none mx-1">|</span>

          <Tip label="Adds an OT Root axis as the leftmost axis, tracing each command from its OT/ANE ethical register (Justice & Mercy, Covenant Loyalty, Economic Compassion, etc.) through speaker, section, and dataset. Useful for seeing where commands originated — e.g. Dataset D 'Social Codes' actually fans out across all 7 registers.">
            <button
              onClick={() => setShowOTRoot((v) => !v)}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all duration-150 ${showOTRoot ? "bg-emerald-600 text-white border-transparent" : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"}`}>
              {showOTRoot ? "Hide OT root" : "Show OT root"}
            </button>
          </Tip>

          <Tip label="Adds a Book axis between NT Section and Dataset, expanding across all 27 NT books. Reveals that Mark contributes only 4 unique commands (most parallel Matthew/Luke), while Matthew, Luke, and the Pauline corpus each dominate their sections.">
            <button
              onClick={() => setShowBook((v) => !v)}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all duration-150 ${showBook ? "bg-violet-600 text-white border-transparent" : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"}`}>
              {showBook ? "Hide books" : "Show books"}
            </button>
          </Tip>

          <Tip label={
            colorBy === "dataset"
              ? "Currently coloring by Dataset (teal = Mercy, blue = Doctrine, coral = Social). Click to cycle: Dataset → Speaker → OT Root."
              : colorBy === "speaker"
                ? "Currently coloring by Speaker (violet = Jesus, blue = Paul, green = Peter, etc.). Click to cycle to OT Root coloring."
                : "Currently coloring by OT Root (violet = Covenant, teal = Justice & Mercy, amber = Economic Compassion, etc.). Click to cycle back to Dataset."
          }>
            <button
              onClick={() => setColorBy((v) =>
                v === "dataset" ? "speaker"
                : v === "speaker" ? "otRoot"
                : "dataset"
              )}
              className="px-3 py-1.5 rounded text-xs font-semibold border transition-all duration-150 bg-white text-stone-500 border-stone-200 hover:border-stone-300">
              Color: {colorBy === "dataset" ? "Dataset" : colorBy === "speaker" ? "Speaker" : "OT Root"}
            </button>
          </Tip>

          <span className="text-[11px] text-stone-400 self-center ml-1">
            {visibleCount.toLocaleString()} records
          </span>
        </div>

        {/* Visualization + inline passage list */}
        <div className="pl-6 flex gap-4 items-start">
          <div className="flex-1 min-w-0">
            <ParallelSets
              records={vizRecords}
              height={vizHeight}
              showBook={showBook}
              showOTRoot={showOTRoot}
              commonlyCitedOnly={commonlyCitedOnly}
              colorBy={colorBy}
              onRibbonClick={(payload: RibbonClickPayload) =>
                setSelectedRibbon({
                  key:     payload.key,
                  otRoot:  payload.otRoot,
                  speaker: payload.speaker,
                  section: payload.section,
                  book:    payload.book,
                  dataset: payload.dataset,
                  count:   payload.count,
                })
              }
              connector={{
                gap:          16,   // gap-4 = 1rem = 16px
                headerHeight: 82,   // approx height of the sidebar header block
                selectedKey:  selectedRibbon?.key ?? null,
              }}
            />
          </div>

          <div
            className="shrink-0 rounded border border-stone-200 overflow-hidden"
            style={{ width: SIDEBAR_W, height: vizHeight }}
          >
            <PassageSidebar
              selection={selectedRibbon}
              records={vizRecords}
              onClearSelection={() => setSelectedRibbon(null)}
            />
          </div>
        </div>

      </main>
    </div>
  );
}
