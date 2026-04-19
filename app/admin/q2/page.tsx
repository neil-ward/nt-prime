"use client";

import { Fragment, useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { loadRecords } from "@/lib/data";
import type { NTRecord } from "@/lib/types";
import { makeYouVersionUrl } from "@/lib/youversion";
import { COMMONLY_CITED_COLOR, COMMONLY_CITED_COLOR_LIGHT } from "@/lib/constants";
import { track } from "@/lib/analytics";
import { useVerse } from "@/components/VerseProvider";
import Q2ParallelCoords from "@/components/visualizations/Q2ParallelCoords";
import Q2UnitGrid from "@/components/visualizations/Q2UnitGrid";
import Q2StrengthChart from "@/components/visualizations/Q2StrengthChart";
import Q2CitationParadox from "@/components/visualizations/Q2CitationParadox";
import AdminGate from "@/components/AdminGate";

// ---------------------------------------------------------------------------
// Shared palette
// ---------------------------------------------------------------------------

const RATINGS = ["CONSISTENT", "PARTIALLY CONSISTENT", "SELECTIVE", "INCONSISTENT"] as const;
type Rating = typeof RATINGS[number];

const RC: Record<Rating, { fill: string; bg: string; fg: string; label: string }> = {
  "CONSISTENT":           { fill: "#7fbf9e", bg: "#e6f0ea", fg: "#1e4d33", label: "Consistent"  },
  "PARTIALLY CONSISTENT": { fill: "#f0c040", bg: "#fef3c7", fg: "#92400e", label: "Partial"      },
  "SELECTIVE":            { fill: "#f09060", bg: "#fde8e2", fg: "#c2410c", label: "Selective"    },
  "INCONSISTENT":         { fill: "#d06060", bg: "#f0e4e4", fg: "#8b1c1c", label: "Inconsistent" },
};

const DIMS = [
  {
    key: "q2_crg", short: "CRG", long: "Congregational / Role Guidance",
    desc: "Is the command used to shape church governance, assign roles, or define authority structures within the congregation?",
    yLabel: "Actively applied to roles and governance",
    nLabel: "Not invoked in role or structural decisions",
  },
  {
    key: "q2_pfs", short: "PFS", long: "Preached From the Pulpit",
    desc: "Does the command appear regularly in sermons, Sunday teaching, or public proclamation — as distinct from being merely acknowledged?",
    yLabel: "Regularly preached as a live obligation",
    nLabel: "Absent from regular public teaching",
  },
  {
    key: "q2_uca", short: "UCA", long: "Used in Church Accountability",
    desc: "Is the command invoked when addressing member behavior, exercising church discipline, or holding leaders to account?",
    yLabel: "Cited in accountability or discipline processes",
    nLabel: "Not used as a basis for accountability",
  },
  {
    key: "q2_ic",  short: "IC",  long: "Institutional Consistency",
    desc: "Is the command applied evenhandedly — the same standard across different people, genders, and social positions — rather than selectively?",
    yLabel: "Applied with consistent, even-handed standards",
    nLabel: "Applied selectively or with double standards",
  },
  {
    key: "q2_mca", short: "MCA", long: "Ministerial / Cultural Acceptance",
    desc: "Is compliance with the command broadly expected and modeled by ministry leaders, or treated as optional within ministerial culture?",
    yLabel: "Expected and modeled by ministry leadership",
    nLabel: "Treated as optional or culturally awkward",
  },
];

function normCat(s: string) { return s.replace(/ — /g, " ").replace(/\s+/g, " ").trim(); }
function shortCat(s: string) { return normCat(s).replace(/^D\d+\s+/i, ""); }

// ---------------------------------------------------------------------------
// Small shared components
// ---------------------------------------------------------------------------

function RatingBadge({ rating }: { rating: string | null }) {
  if (!rating) return <span className="text-[9px] text-stone-400">—</span>;
  const c = RC[rating as Rating];
  if (!c) return null;
  return (
    <span className="inline-flex items-center px-1.5 py-px rounded text-[9px] font-semibold"
      style={{ backgroundColor: c.bg, color: c.fg }}>
      {c.label}
    </span>
  );
}

function DimDot({ score }: { score: string | null }) {
  const bg = score === "Y" ? "#7fbf9e" : score === "P" ? "#f0c040" : score === "N" ? "#d06060" : "#e7e5e4";
  return (
    <span className="inline-block w-2 h-2 rounded-full"
      style={{ backgroundColor: bg }}
      title={score === "Y" ? "Yes" : score === "P" ? "Partial" : score === "N" ? "No" : "—"} />
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ rating, count, total }: { rating: Rating; count: number; total: number }) {
  const c = RC[rating];
  return (
    <div className="rounded-md border p-4" style={{ borderColor: c.fill + "66", backgroundColor: c.bg }}>
      <p className="text-2xl font-serif leading-none mb-1" style={{ color: c.fg }}>{count}</p>
      <p className="text-[11px] font-semibold" style={{ color: c.fg }}>{c.label}</p>
      <p className="text-[10px] mt-0.5" style={{ color: c.fg + "aa" }}>
        {Math.round(count / total * 100)}% of Dataset D
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category stacked bar chart
// ---------------------------------------------------------------------------

function CategoryChart({ records }: { records: NTRecord[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => { if (e.contentRect.width > 0) setWidth(e.contentRect.width); });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const catMap = new Map<string, Record<Rating, number> & { display: string }>();
  records.forEach((r) => {
    if (!r.q2_consistency_rating) return;
    const key = normCat(r.category || "Other");
    if (!catMap.has(key)) catMap.set(key, { display: shortCat(r.category || "Other"), CONSISTENT: 0, "PARTIALLY CONSISTENT": 0, SELECTIVE: 0, INCONSISTENT: 0 });
    catMap.get(key)![r.q2_consistency_rating as Rating]++;
  });

  const rows = [...catMap.entries()].map(([key, v]) => ({
    key, display: v.display,
    counts: RATINGS.map((r) => v[r]),
    total: RATINGS.reduce((s, r) => s + v[r], 0),
    inconsistentPct: (v.INCONSISTENT + v.SELECTIVE) / RATINGS.reduce((s, r) => s + v[r], 0),
  })).filter((r) => r.total > 0).sort((a, b) => b.inconsistentPct - a.inconsistentPct);

  const LABEL_W = 180; const COUNT_W = 30; const BAR_W = width - LABEL_W - COUNT_W;
  const ROW_H = 26; const height = rows.length * ROW_H + 8;

  return (
    <div ref={containerRef} className="w-full">
      <svg width={width} height={height} className="overflow-visible">
        {rows.map((row, ri) => {
          const y = ri * ROW_H + 4; let x = LABEL_W;
          return (
            <g key={row.key}>
              <text x={LABEL_W - 8} y={y + ROW_H / 2} dy="0.35em" textAnchor="end"
                fontSize={10} fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#57534e">
                {row.display}
              </text>
              {RATINGS.map((rating, ri2) => {
                const pct = row.counts[ri2] / row.total; const segW = pct * BAR_W; const segX = x; x += segW;
                if (segW < 1) return null;
                return (
                  <g key={rating}>
                    <rect x={segX} y={y + 4} width={segW} height={ROW_H - 10}
                      fill={RC[rating].fill} opacity={0.85} rx={ri2 === 0 ? 2 : 0} />
                    {segW > 22 && (
                      <text x={segX + segW / 2} y={y + ROW_H / 2} dy="0.35em"
                        textAnchor="middle" fontSize={9}
                        fontFamily="ui-sans-serif,system-ui,sans-serif"
                        fill="white" className="pointer-events-none">
                        {row.counts[ri2]}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={LABEL_W + BAR_W + 6} y={y + ROW_H / 2} dy="0.35em"
                textAnchor="start" fontSize={9}
                fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#a8a29e">
                {row.total}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex gap-4 mt-3 pl-[180px]">
        {RATINGS.map((r) => (
          <div key={r} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block shrink-0" style={{ backgroundColor: RC[r].fill }} />
            <span className="text-[10px] text-stone-500">{RC[r].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable record matrix
// ---------------------------------------------------------------------------

type SortCol = "rating" | "q2_crg" | "q2_pfs" | "q2_uca" | "q2_ic" | "q2_mca";

function scoreVal(s: string | null) {
  return s === "Y" ? 2 : s === "P" ? 1 : s === "N" ? 0 : -1;
}

const RATING_RANK: Record<string, number> = {
  INCONSISTENT: 0, SELECTIVE: 1, "PARTIALLY CONSISTENT": 2, CONSISTENT: 3,
};

function RecordMatrix({ records }: { records: NTRecord[] }) {
  const [sortCol,      setSortCol]      = useState<SortCol>("rating");
  const [sortDir,      setSortDir]      = useState<1 | -1>(-1);
  const [ratingFilter, setRatingFilter] = useState<Rating | null>(null);
  const [expandedKey,  setExpandedKey]  = useState<string | null>(null);
  const { openVerse } = useVerse();

  const filtered = ratingFilter ? records.filter((r) => r.q2_consistency_rating === ratingFilter) : records;

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let diff = 0;
      if (sortCol === "rating") {
        diff = (RATING_RANK[a.q2_consistency_rating ?? ""] ?? 4) - (RATING_RANK[b.q2_consistency_rating ?? ""] ?? 4);
      } else {
        diff = scoreVal((a as unknown as Record<string, unknown>)[sortCol] as string | null)
             - scoreVal((b as unknown as Record<string, unknown>)[sortCol] as string | null);
      }
      return diff !== 0 ? diff * sortDir : 0;
    });
  }, [filtered, sortCol, sortDir]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortCol(col); setSortDir(-1); }
  };

  const SortIcon = ({ col }: { col: SortCol }) =>
    sortCol === col ? <span className="ml-0.5">{sortDir === -1 ? "↓" : "↑"}</span> : null;

  // Total column count: ref + 5 dims + rating + summary + ★
  const COL_COUNT = 9;

  return (
    <div>
      {/* Rating filter */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 shrink-0">Filter</span>
        <button onClick={() => setRatingFilter(null)}
          className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-all ${!ratingFilter ? "bg-stone-800 text-white border-transparent" : "bg-white text-stone-400 border-stone-200"}`}>
          All {records.length}
        </button>
        {RATINGS.map((r) => {
          const cnt = records.filter((rec) => rec.q2_consistency_rating === r).length;
          return (
            <button key={r} onClick={() => setRatingFilter(ratingFilter === r ? null : r)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${ratingFilter === r ? "text-white border-transparent" : "bg-white border-stone-200 hover:border-stone-300"}`}
              style={ratingFilter === r ? { backgroundColor: RC[r].fill } : { color: RC[r].fg }}>
              {RC[r].label} · {cnt}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-auto rounded border border-stone-200" style={{ maxHeight: 560 }}>
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-stone-100 border-b-2 border-stone-200">
            <tr>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-stone-400 w-32">Reference</th>
              {DIMS.map((dim) => (
                <th key={dim.key}
                  className={`py-2 text-center text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:text-stone-700 transition-colors w-10 ${sortCol === dim.key ? "text-stone-700" : "text-stone-400"}`}
                  onClick={() => handleSort(dim.key as SortCol)}
                  title={dim.long}>
                  {dim.short}<SortIcon col={dim.key as SortCol} />
                </th>
              ))}
              <th className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-widest cursor-pointer hover:text-stone-700 transition-colors w-24 ${sortCol === "rating" ? "text-stone-700" : "text-stone-400"}`}
                onClick={() => handleSort("rating")}>
                Rating<SortIcon col="rating" />
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                Summary
              </th>
              <th className="py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-stone-400 w-8">★</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const rowKey    = r.ref + r.dataset;
              const isExpanded = expandedKey === rowKey;
              const rating     = r.q2_consistency_rating as Rating | null;
              const rc         = rating ? RC[rating] : null;
              const rowBg      = isExpanded
                ? (rc ? rc.bg : "#f8f7f6")
                : i % 2 === 0 ? "white" : "rgb(250 249 248 / 0.4)";

              return (
                <Fragment key={rowKey}>
                  <tr
                    className="border-b border-stone-100 hover:bg-stone-50 transition-colors cursor-pointer"
                    style={{ backgroundColor: rowBg }}
                    onClick={() => {
                      if (!isExpanded) track("record_expand", { ref: r.ref, dataset: r.dataset, page: "/admin/q2" });
                      setExpandedKey(isExpanded ? null : rowKey);
                    }}
                  >
                    <td className="px-3 py-2">
                      <span className="text-[11px] font-serif font-semibold text-stone-800 leading-tight block">
                        {r.ref}
                      </span>
                      <span className="text-[9px] text-stone-400">{shortCat(r.category || "")}</span>
                    </td>
                    {DIMS.map((dim) => (
                      <td key={dim.key} className="text-center py-2">
                        <DimDot score={(r as unknown as Record<string, unknown>)[dim.key] as string | null} />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <RatingBadge rating={r.q2_consistency_rating} />
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      {r.summary ? (
                        <span
                          className="text-[11px] text-stone-500 leading-snug line-clamp-1 cursor-pointer hover:text-stone-800 transition-colors"
                          onClick={(e) => { e.stopPropagation(); openVerse(r.ref, { otAntecedent: r.ot_antecedent }); }}
                          title="View verse text"
                        >
                          {r.summary}
                        </span>
                      ) : (
                        <span className="text-[10px] text-stone-300">—</span>
                      )}
                    </td>
                    <td className="text-center py-2">
                      <div className="flex items-center justify-center gap-1">
                        {r.commonly_cited && (
                          <span style={{ color: COMMONLY_CITED_COLOR }} className="text-[10px]">★</span>
                        )}
                        <span className="text-[9px] text-stone-300 select-none">
                          {isExpanded ? "▴" : "▾"}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {isExpanded && (
                    <tr
                      className="border-b-2"
                      style={{ borderColor: rc?.fill ?? "#e7e5e4", backgroundColor: rowBg }}
                    >
                      <td colSpan={COL_COUNT} className="px-4 pb-4 pt-1">
                        <div
                          className="border-l-2 pl-3 space-y-1.5"
                          style={{ borderColor: rc?.fill ?? "#d6d3d1" }}
                        >
                          {r.summary && (
                            <p className="text-[12px] text-stone-700 leading-relaxed">
                              {r.summary}
                            </p>
                          )}
                          {r.q2_notes && (
                            <p className="text-[11px] text-stone-500 leading-relaxed italic">
                              {r.q2_notes}
                            </p>
                          )}
                          {r.q2_typical_application && (
                            <p className="text-[10px] text-stone-400 leading-relaxed">
                              <span className="font-semibold not-italic text-stone-500">Typical application: </span>
                              {r.q2_typical_application}
                            </p>
                          )}
                          {r.commonly_cited && (
                            <p className="text-[10px]" style={{ color: COMMONLY_CITED_COLOR }}>
                              ★ Cited in SBC doctrinal literature
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-2.5 text-[10px] text-stone-400">
        {[["Y","Yes","#7fbf9e"],["P","Partial","#f0c040"],["N","No","#d06060"]].map(([s,l,c]) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c as string }} />
            <span>{s} = {l}</span>
          </div>
        ))}
        <span className="text-stone-300">· ★ cited in SBC literature · click headers to sort · click rows to expand</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible record group
// ---------------------------------------------------------------------------

function RecordGroup({ rating, records }: { rating: Rating; records: NTRecord[] }) {
  const [open, setOpen] = useState(false);
  const c = RC[rating];
  const { openVerse } = useVerse();
  if (!records.length) return null;
  return (
    <div className="border border-stone-200 rounded-md overflow-hidden">
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-100/50 transition-colors text-left">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.fill }} />
          <span className="text-[13px] font-semibold" style={{ color: c.fg }}>{c.label}</span>
          <span className="text-[11px] text-stone-400">{records.length} passages</span>
        </div>
        <span className="text-stone-400 text-[11px]">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ul className="divide-y divide-stone-200/60 border-t border-stone-200">
          {records.map((p, i) => {
            const url = makeYouVersionUrl(p.book, p.chapter, p.verse_range);
            return (
              <li key={`${p.ref}-${i}`} className="px-4 py-3 bg-stone-50/50">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <span className="text-[12px] font-serif font-semibold text-stone-800">
                    {p.ref}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.commonly_cited && (
                      <span className="text-[9px] font-bold px-1.5 py-px rounded uppercase tracking-wide"
                        style={{ backgroundColor: COMMONLY_CITED_COLOR_LIGHT, color: COMMONLY_CITED_COLOR }}>
                        Cited
                      </span>
                    )}
                    {url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-stone-400 hover:text-stone-600">↗</a>}
                  </div>
                </div>
                <div className="flex items-center gap-3 mb-1.5">
                  {DIMS.map((dim) => (
                    <div key={dim.key} className="flex items-center gap-1" title={dim.long}>
                      <DimDot score={(p as unknown as Record<string, unknown>)[dim.key] as string | null} />
                      <span className="text-[9px] text-stone-400">{dim.short}</span>
                    </div>
                  ))}
                </div>
                {p.q2_notes ? (
                  <p
                    className="text-[11px] text-stone-500 leading-relaxed cursor-pointer hover:text-stone-800 transition-colors"
                    onClick={() => openVerse(p.ref, { otAntecedent: p.ot_antecedent })}
                    title="View verse text"
                  >
                    {p.q2_notes}
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
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Q2Page() {
  return (
    <AdminGate
      title="Q2 Review"
      subtitle="This dataset is under review and not yet public. Enter the admin token to continue."
    >
      <Q2PageContent />
    </AdminGate>
  );
}

function Q2PageContent() {
  const [records, setRecords] = useState<NTRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [parallelFilter, setParallelFilter] = useState<Rating | null>(null);

  useEffect(() => {
    loadRecords()
      .then((r) => { setRecords(r); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const dRecords = useMemo(() => records.filter((r) => r.dataset === "D"), [records]);

  const ratingCounts = useMemo(() => {
    const c = { CONSISTENT: 0, "PARTIALLY CONSISTENT": 0, SELECTIVE: 0, INCONSISTENT: 0 } as Record<Rating, number>;
    dRecords.forEach((r) => { if (r.q2_consistency_rating) c[r.q2_consistency_rating as Rating]++; });
    return c;
  }, [dRecords]);

  const citedD = useMemo(() => dRecords.filter((r) => r.commonly_cited), [dRecords]);
  const citedRatings = useMemo(() => {
    const c = { CONSISTENT: 0, "PARTIALLY CONSISTENT": 0, SELECTIVE: 0, INCONSISTENT: 0 } as Record<Rating, number>;
    citedD.forEach((r) => { if (r.q2_consistency_rating) c[r.q2_consistency_rating as Rating]++; });
    return c;
  }, [citedD]);

  const byRating = useMemo(() =>
    Object.fromEntries(RATINGS.map((r) => [r, dRecords.filter((p) => p.q2_consistency_rating === r)])) as Record<Rating, NTRecord[]>,
  [dRecords]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-stone-50"><p className="text-stone-400 text-sm font-serif italic">Loading…</p></div>;
  if (error)   return <div className="min-h-screen flex items-center justify-center bg-stone-50"><p className="text-red-500 text-sm">Error: {error}</p></div>;

  const total = dRecords.length;
  const inconsistentPct = Math.round((ratingCounts.INCONSISTENT + ratingCounts.SELECTIVE) / total * 100);
  const citedInconsistentPct = Math.round((citedRatings.INCONSISTENT + citedRatings.SELECTIVE) / citedD.length * 100);

  return (
    <main className="flex-1 bg-stone-50">
      <div className="max-w-4xl mx-auto px-6 lg:px-10 pb-24">

        {/* ── Header ── */}
        <div className="pt-12 pb-8 border-b border-stone-200">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-3">
            Q2 Analysis · Dataset D
          </p>
          <h1 className="text-3xl font-serif text-stone-900 leading-tight mb-3">
            Application Consistency
          </h1>
          <p className="text-stone-500 text-sm leading-relaxed max-w-2xl">
            How consistently do SBC-aligned institutions apply the 100 Social Codes &amp;
            Liturgy commands? Each record is scored across five institutional dimensions
            and assigned an overall consistency rating.
          </p>
          <p className="text-[11px] text-stone-400 mt-3 max-w-2xl leading-relaxed border-l-2 border-stone-200 pl-3 italic">
            {inconsistentPct}% of Dataset D commands are rated Selective or Inconsistent —
            despite 79% being framed as Explicit Commands, the clearest rhetorical form
            in the NT.
          </p>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-8 border-b border-stone-200">
          {RATINGS.map((r) => (
            <StatCard key={r} rating={r} count={ratingCounts[r]} total={total} />
          ))}
        </div>

        {/* ── Sortable record matrix ── */}
        <div className="py-8 border-b border-stone-200">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">
            All records · dimension matrix
          </p>
          <p className="text-sm text-stone-500 leading-relaxed mb-6 max-w-2xl">
            Every Dataset D record with its five dimension scores. Sort by any
            column to surface structural patterns — the IC column in particular
            reveals where institutional consistency breaks down.
          </p>

          {/* Dimension definition cards */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-6">
            {DIMS.map((dim) => (
              <div
                key={dim.key}
                className="rounded-md border border-stone-200 bg-white px-3 py-3"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 tracking-wide">
                    {dim.short}
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-stone-700 leading-snug mb-1.5">
                  {dim.long}
                </p>
                <p className="text-[10px] text-stone-500 leading-relaxed mb-2">
                  {dim.desc}
                </p>
                <div className="space-y-0.5 border-t border-stone-100 pt-2">
                  <div className="flex items-start gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: "#7fbf9e" }} />
                    <span className="text-[9px] text-stone-400 leading-tight">{dim.yLabel}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: "#d06060" }} />
                    <span className="text-[9px] text-stone-400 leading-tight">{dim.nLabel}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: "#f0c040" }} />
                    <span className="text-[9px] text-stone-400 leading-tight">P = partially or inconsistently so</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <RecordMatrix records={dRecords} />
        </div>

        {/* ── Unit grid ── */}
        <div className="py-10 border-b border-stone-200">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">
            All 100 records
          </p>
          <h2 className="text-xl font-serif text-stone-900 mb-2 leading-snug">
            Every command, counted
          </h2>
          <p className="text-sm text-stone-500 leading-relaxed mb-6 max-w-2xl">
            One square per Dataset D record (100 total), grouped by category and sorted
            worst-first within each group. An amber pip marks passages cited
            in SBC doctrinal literature. Hover any square for the full record.
            Categories are ordered by their proportion of Inconsistent or
            Selective ratings — Household Code (Slaves) leads at 100%.
          </p>
          <Q2UnitGrid records={dRecords} />
        </div>

        {/* ── Command strength paradox ── */}
        <div className="py-10 border-b border-stone-200">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">
            Grammatical form vs. application
          </p>
          <h2 className="text-xl font-serif text-stone-900 mb-2 leading-snug">
            The command strength paradox
          </h2>
          <p className="text-sm text-stone-500 leading-relaxed mb-6 max-w-2xl">
            Dataset D records classified by rhetorical form — how directly the
            text issues the directive. Explicit Commands are the clearest,
            most unambiguous form. Each bar shows what proportion of that
            form&apos;s records received each consistency rating.
          </p>
          <Q2StrengthChart records={dRecords} />
        </div>

        {/* ── Citation paradox ── */}
        <div className="py-10 border-b border-stone-200">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">
            Citation vs. application
          </p>
          <h2 className="text-xl font-serif text-stone-900 mb-2 leading-snug">
            Cited, but not applied consistently
          </h2>
          <p className="text-sm text-stone-500 leading-relaxed mb-6 max-w-2xl">
            Of the 94 Dataset D records, 54 appear as supporting references in
            SBC doctrinal literature (Baptist Faith &amp; Message and related
            documents). Comparing those cited passages against the uncited ones
            reveals a specific pattern in how selective enforcement relates to
            institutional endorsement.
          </p>
          <Q2CitationParadox records={dRecords} />
        </div>

        {/* ── Parallel coordinates ── */}
        <div className="py-10 border-b border-stone-200">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">
            Five dimensions · all 94 records
          </p>
          <h2 className="text-xl font-serif text-stone-900 mb-2 leading-snug">
            Tracing each command across the institutional dimensions
          </h2>
          <p className="text-sm text-stone-500 leading-relaxed mb-2 max-w-2xl">
            Each line is one Dataset D record, tracing its score (Yes / Partial / No)
            across all five dimensions from left to right. Lines that climb on PFS
            (preached) but fall on IC (institutionally consistent) reveal the core
            finding: commands actively preached but inconsistently applied.
          </p>
          <p className="text-[10px] text-stone-400 mb-6 max-w-2xl leading-relaxed">
            <span className="font-semibold">CRG</span> — applied to roles/governance ·{" "}
            <span className="font-semibold">PFS</span> — preached from pulpit ·{" "}
            <span className="font-semibold">UCA</span> — used in accountability ·{" "}
            <span className="font-semibold">IC</span> — institutionally consistent ·{" "}
            <span className="font-semibold">MCA</span> — accepted in ministerial culture
          </p>

          {/* Filter by rating */}
          <div className="flex items-center gap-2 mb-5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Show</span>
            <button onClick={() => setParallelFilter(null)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-all ${!parallelFilter ? "bg-stone-800 text-white border-transparent" : "bg-white text-stone-400 border-stone-200"}`}>
              All {total}
            </button>
            {RATINGS.map((r) => (
              <button key={r} onClick={() => setParallelFilter(parallelFilter === r ? null : r)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${parallelFilter === r ? "text-white border-transparent" : "bg-white border-stone-200 hover:border-stone-300"}`}
                style={parallelFilter === r ? { backgroundColor: RC[r].fill } : { color: RC[r].fg }}>
                {RC[r].label} · {ratingCounts[r]}
              </button>
            ))}
          </div>

          <Q2ParallelCoords records={dRecords} filterRating={parallelFilter} />
        </div>

        {/* ── Cited vs applied ── */}
        <div className="py-8 border-b border-stone-200">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">
            Cited passages
          </p>
          <p className="text-sm text-stone-600 leading-relaxed mb-4 max-w-2xl">
            Of the {citedD.length} Dataset D passages cited in SBC doctrinal
            literature, <strong>{citedInconsistentPct}%</strong> are Selective or
            Inconsistent — meaning they appear in founding documents as authoritative
            while not being applied evenly in practice.
          </p>
          <div className="flex h-6 rounded overflow-hidden max-w-md">
            {RATINGS.map((r) => {
              const pct = citedRatings[r] / citedD.length * 100;
              if (!pct) return null;
              return (
                <div key={r} style={{ width: `${pct}%`, backgroundColor: RC[r].fill }}
                  className="flex items-center justify-center"
                  title={`${RC[r].label}: ${citedRatings[r]}`}>
                  {pct > 10 && <span className="text-[9px] font-semibold text-white">{citedRatings[r]}</span>}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-stone-400 mt-1.5">
            {citedD.length} cited passages out of {total} total
          </p>
        </div>

        {/* ── Category chart ── */}
        <div className="py-8 border-b border-stone-200">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">
            By category · sorted by inconsistency rate
          </p>
          <p className="text-sm text-stone-500 leading-relaxed mb-5 max-w-2xl">
            Household codes for slaves and servants are 100% Inconsistent — no
            contemporary institution applies them. Sexual purity commands are
            uniformly Selective: broadly preached, but enforcement varies by sin
            type and social standing.
          </p>
          <CategoryChart records={dRecords} />
        </div>

        {/* ── Records by rating ── */}
        <div className="py-8">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-4">
            All records · grouped by rating
          </p>
          <div className="flex flex-col gap-3">
            {RATINGS.map((r) => (
              <RecordGroup key={r} rating={r} records={byRating[r] ?? []} />
            ))}
          </div>
        </div>

        {/* Footer nav */}
        <div className="pt-6 border-t border-stone-200 flex flex-wrap gap-3">
          <Link href="/compare" className="inline-flex items-center gap-2 px-4 py-2 rounded border border-stone-300 text-stone-600 text-sm font-medium hover:border-stone-400 hover:text-stone-900 transition-colors">← Compare</Link>
          <Link href="/browse"  className="inline-flex items-center gap-2 px-4 py-2 rounded border border-stone-300 text-stone-600 text-sm font-medium hover:border-stone-400 hover:text-stone-900 transition-colors">Browse passages</Link>
          <Link href="/about"   className="inline-flex items-center gap-2 px-4 py-2 rounded border border-stone-300 text-stone-600 text-sm font-medium hover:border-stone-400 hover:text-stone-900 transition-colors">Methodology</Link>
        </div>

      </div>
    </main>
  );
}
