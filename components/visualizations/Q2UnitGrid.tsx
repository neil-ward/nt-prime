"use client";

/**
 * Q2UnitGrid — one square per Dataset D record, grouped by category.
 *
 * Each square is colored by consistency rating.  A narrow stacked bar
 * beside the category label shows the rating breakdown at a glance.
 * Commonly-cited records get an amber corner pip.
 * Hover any square to highlight its siblings and read the full record.
 *
 * Categories are sorted by descending (Inconsistent + Selective) rate,
 * so the most problematic categories appear first.
 * Within each category, records are sorted Inconsistent → Selective →
 * Partial → Consistent, then by PFS score (preached first within group).
 */

import { useState, useMemo } from "react";
import type { NTRecord } from "@/lib/types";
import { COMMONLY_CITED_COLOR, COMMONLY_CITED_COLOR_LIGHT } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const RATINGS = ["CONSISTENT", "PARTIALLY CONSISTENT", "SELECTIVE", "INCONSISTENT"] as const;
type Rating = (typeof RATINGS)[number];

const RATING_FILL: Record<Rating, string> = {
  "CONSISTENT":           "#7fbf9e",
  "PARTIALLY CONSISTENT": "#f0c040",
  "SELECTIVE":            "#f09060",
  "INCONSISTENT":         "#d06060",
};
const RATING_LABEL: Record<Rating, string> = {
  "CONSISTENT":           "Consistent",
  "PARTIALLY CONSISTENT": "Partial",
  "SELECTIVE":            "Selective",
  "INCONSISTENT":         "Inconsistent",
};
const RATING_RANK: Record<Rating, number> = {
  INCONSISTENT: 0, SELECTIVE: 1, "PARTIALLY CONSISTENT": 2, CONSISTENT: 3,
};
const DIM_SCORE: Record<string, number> = { Y: 1, P: 0.5, N: 0 };

// ---------------------------------------------------------------------------
// Category normalisation (mirrors q2/page.tsx)
// ---------------------------------------------------------------------------

function normCat(s: string): string {
  return s.replace(/ — /g, " ").replace(/\s+/g, " ").trim();
}
function shortCat(s: string): string {
  return normCat(s).replace(/^D\d+\s+/i, "").trim();
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const SQ      = 18;   // square side px
const GAP     = 3;    // gap between squares
const UNIT    = SQ + GAP;
const LABEL_W = 140;  // category label column width px

// ---------------------------------------------------------------------------
// Per-category type
// ---------------------------------------------------------------------------

interface CatGroup {
  key:     string;
  display: string;
  records: NTRecord[];
  counts:  Record<Rating, number>;
  problemPct: number; // (inconsistent + selective) / total
}

function buildCategories(records: NTRecord[]): CatGroup[] {
  const map = new Map<string, { display: string; recs: NTRecord[] }>();
  records.forEach((r) => {
    const key = normCat(r.category || "Other");
    const display = shortCat(r.category || "Other");
    if (!map.has(key)) map.set(key, { display, recs: [] });
    map.get(key)!.recs.push(r);
  });

  return [...map.entries()]
    .map(([key, { display, recs }]) => {
      const counts = { CONSISTENT: 0, "PARTIALLY CONSISTENT": 0, SELECTIVE: 0, INCONSISTENT: 0 } as Record<Rating, number>;
      recs.forEach((r) => {
        if (r.q2_consistency_rating) counts[r.q2_consistency_rating as Rating]++;
      });
      const problemPct = (counts.INCONSISTENT + counts.SELECTIVE) / recs.length;

      const sorted = [...recs].sort((a, b) => {
        const ra = RATING_RANK[a.q2_consistency_rating as Rating] ?? 4;
        const rb = RATING_RANK[b.q2_consistency_rating as Rating] ?? 4;
        if (ra !== rb) return ra - rb;
        // within same rating: preached first
        return (DIM_SCORE[b.q2_pfs ?? ""] ?? 0) - (DIM_SCORE[a.q2_pfs ?? ""] ?? 0);
      });

      return { key, display, records: sorted, counts, problemPct };
    })
    .sort((a, b) => b.problemPct - a.problemPct);
}

// ---------------------------------------------------------------------------
// Mini stacked bar (rating breakdown for a category)
// ---------------------------------------------------------------------------

function MiniBar({ counts, total }: { counts: Record<Rating, number>; total: number }) {
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden w-16 mt-1">
      {RATINGS.map((r) => {
        const pct = (counts[r] / total) * 100;
        if (!pct) return null;
        return (
          <div
            key={r}
            style={{ width: `${pct}%`, backgroundColor: RATING_FILL[r] }}
            title={`${RATING_LABEL[r]}: ${counts[r]}`}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props { records: NTRecord[] }

export default function Q2UnitGrid({ records }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const categories = useMemo(() => buildCategories(records), [records]);

  const hoveredRecord = useMemo(
    () => (hovered ? records.find((r) => r.ref + r.dataset === hovered) ?? null : null),
    [hovered, records],
  );

  // When a record is hovered, dim all records of OTHER ratings
  const hoveredRating = hoveredRecord?.q2_consistency_rating as Rating | null | undefined;

  // Split categories evenly across two columns
  const mid       = Math.ceil(categories.length / 2);
  const leftCats  = categories.slice(0, mid);
  const rightCats = categories.slice(mid);

  const renderColumn = (cats: typeof categories) => (
    <div className="space-y-3 min-w-0">
      {cats.map(({ key, display, records: catRecs, counts, problemPct }) => (
        <div key={key} className="flex items-start gap-3">

          {/* Label */}
          <div className="shrink-0 text-right" style={{ width: LABEL_W }}>
            <p className="text-[11px] font-medium text-stone-700 leading-tight">{display}</p>
            <p className="text-[9px] text-stone-400 mt-0.5">
              {catRecs.length} · {Math.round(problemPct * 100)}% problematic
            </p>
            <MiniBar counts={counts} total={catRecs.length} />
          </div>

          {/* Squares */}
          <div className="flex flex-wrap min-w-0" style={{ gap: GAP }}>
            {catRecs.map((r) => {
              const rkey   = r.ref + r.dataset;
              const isHov  = hovered === rkey;
              const rating = r.q2_consistency_rating as Rating | null;
              const color  = rating ? RATING_FILL[rating] : "#e7e5e4";
              const dim    = hovered && !isHov
                ? (hoveredRating && rating === hoveredRating ? 0.35 : 0.12)
                : 1;

              return (
                <div
                  key={rkey}
                  style={{
                    position: "relative",
                    width:  SQ,
                    height: SQ,
                    backgroundColor: color,
                    opacity: dim,
                    borderRadius: 3,
                    cursor: "pointer",
                    outline: isHov ? `2px solid ${color}` : "none",
                    outlineOffset: 2,
                    transition: "opacity 0.12s",
                    flexShrink: 0,
                  }}
                  onMouseEnter={() => setHovered(rkey)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {r.commonly_cited && (
                    <span
                      style={{
                        position: "absolute",
                        top: 2, right: 2,
                        width: 4, height: 4,
                        borderRadius: "50%",
                        backgroundColor: COMMONLY_CITED_COLOR,
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

        </div>
      ))}
    </div>
  );

  return (
    <div className="w-full">

      {/* Two-column category grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
        {renderColumn(leftCats)}
        {renderColumn(rightCats)}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-5">
        {RATINGS.map((r) => {
          const count = records.filter((rec) => rec.q2_consistency_rating === r).length;
          return (
            <div key={r} className="flex items-center gap-1.5">
              <span
                className="inline-block rounded-sm shrink-0"
                style={{ width: SQ, height: SQ, backgroundColor: RATING_FILL[r] }}
              />
              <span className="text-[10px] text-stone-500">{RATING_LABEL[r]} · {count}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 ml-2">
          <span
            className="inline-block rounded-sm shrink-0 relative"
            style={{ width: SQ, height: SQ, backgroundColor: "#e7e5e4" }}
          >
            <span
              style={{
                position: "absolute", top: 2, right: 2,
                width: 4, height: 4, borderRadius: "50%",
                backgroundColor: COMMONLY_CITED_COLOR,
              }}
            />
          </span>
          <span className="text-[10px] text-stone-400">amber pip = cited in SBC literature</span>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredRecord && (
        <div
          className="mt-4 px-4 py-3 bg-white rounded border border-stone-200 max-w-lg text-sm"
          style={{ marginLeft: 172 + 16 }}
        >
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <span className="font-serif font-semibold text-stone-800 text-[13px]">
              {hoveredRecord.ref}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {hoveredRecord.commonly_cited && (
                <span
                  className="text-[9px] font-bold px-1.5 py-px rounded uppercase tracking-wide"
                  style={{ backgroundColor: COMMONLY_CITED_COLOR_LIGHT, color: COMMONLY_CITED_COLOR }}
                >
                  Cited
                </span>
              )}
              {hoveredRecord.q2_consistency_rating && (
                <span
                  className="text-[9px] font-bold px-1.5 py-px rounded"
                  style={{
                    backgroundColor: RATING_FILL[hoveredRecord.q2_consistency_rating as Rating] + "22",
                    color: RATING_FILL[hoveredRecord.q2_consistency_rating as Rating],
                  }}
                >
                  {RATING_LABEL[hoveredRecord.q2_consistency_rating as Rating]}
                </span>
              )}
            </div>
          </div>

          {hoveredRecord.summary && (
            <p className="text-[11px] text-stone-600 leading-relaxed mb-2">
              {hoveredRecord.summary}
            </p>
          )}

          {/* Dimension dots */}
          <div className="flex gap-4">
            {(["q2_crg","q2_pfs","q2_uca","q2_ic","q2_mca"] as const).map((dim) => {
              const val = (hoveredRecord as unknown as Record<string, unknown>)[dim] as string | null;
              const col = val === "Y" ? "#7fbf9e" : val === "P" ? "#f0c040" : val === "N" ? "#d06060" : "#e7e5e4";
              const label = dim.replace("q2_", "").toUpperCase();
              return (
                <div key={dim} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: col }} />
                  <span className="text-[10px] text-stone-400">{label} {val ?? "—"}</span>
                </div>
              );
            })}
          </div>

          {hoveredRecord.q2_notes && (
            <p className="text-[11px] text-stone-500 leading-relaxed mt-2 border-l-2 border-stone-200 pl-2.5 italic">
              {hoveredRecord.q2_notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
