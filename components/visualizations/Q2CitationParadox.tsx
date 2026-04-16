"use client";

/**
 * Q2CitationParadox — cited vs. uncited Dataset D passages, by rating.
 *
 * Two proportional stacked bars: passages that appear in SBC doctrinal
 * literature (commonly_cited = true) vs. those that don't.
 *
 * The finding: every Selective rating belongs to a cited passage — the
 * commands applied with the most social bias are the ones the SBC has
 * explicitly endorsed as authoritative in its founding documents.
 * Meanwhile, uncited passages have a higher outright-Inconsistent rate
 * (42% vs 28%), suggesting the SBC ignores those commands quietly rather
 * than selectively.
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

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const BAR_H   = 36;
const LABEL_W = 158;
const GAP     = 24; // between the two bars

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface GroupStats {
  label:    string;
  sublabel: string;
  total:    number;
  counts:   Record<Rating, number>;
  cited:    boolean;
}

interface Props { records: NTRecord[] }

export default function Q2CitationParadox({ records }: Props) {
  const [hoveredSeg, setHoveredSeg] = useState<{ group: string; rating: Rating } | null>(null);

  const groups: GroupStats[] = useMemo(() => {
    const cited   = { CONSISTENT: 0, "PARTIALLY CONSISTENT": 0, SELECTIVE: 0, INCONSISTENT: 0 } as Record<Rating, number>;
    const uncited = { CONSISTENT: 0, "PARTIALLY CONSISTENT": 0, SELECTIVE: 0, INCONSISTENT: 0 } as Record<Rating, number>;

    records.forEach((r) => {
      if (!r.q2_consistency_rating) return;
      const rat = r.q2_consistency_rating as Rating;
      if (r.commonly_cited) cited[rat]++;
      else uncited[rat]++;
    });

    const citedTotal   = Object.values(cited).reduce((a, b) => a + b, 0);
    const uncitedTotal = Object.values(uncited).reduce((a, b) => a + b, 0);

    return [
      {
        label:    "Cited in SBC literature",
        sublabel: `${citedTotal} passages`,
        total:    citedTotal,
        counts:   cited,
        cited:    true,
      },
      {
        label:    "Not cited",
        sublabel: `${uncitedTotal} passages`,
        total:    uncitedTotal,
        counts:   uncited,
        cited:    false,
      },
    ];
  }, [records]);

  // Derive headline stats for callouts
  const citedGrp   = groups[0];
  const uncitedGrp = groups[1];
  const citedSelective   = citedGrp.counts.SELECTIVE;
  const uncitedSelective = uncitedGrp.counts.SELECTIVE;
  const citedIncPct   = Math.round(((citedGrp.counts.INCONSISTENT + citedGrp.counts.SELECTIVE) / citedGrp.total) * 100);
  const uncitedIncPct = Math.round(((uncitedGrp.counts.INCONSISTENT + uncitedGrp.counts.SELECTIVE) / uncitedGrp.total) * 100);

  return (
    <div className="w-full">

      {/* Headline stat row */}
      <div
        className="flex gap-8 mb-6"
        style={{ paddingLeft: LABEL_W }}
      >
        <div
          className="px-4 py-3 rounded-md border"
          style={{ borderColor: COMMONLY_CITED_COLOR + "44", backgroundColor: COMMONLY_CITED_COLOR_LIGHT }}
        >
          <p className="text-2xl font-serif leading-none mb-0.5" style={{ color: COMMONLY_CITED_COLOR }}>
            {citedSelective} of {citedSelective + uncitedSelective}
          </p>
          <p className="text-[11px] font-medium" style={{ color: COMMONLY_CITED_COLOR }}>
            Selective ratings are from cited passages
          </p>
        </div>
        <div className="px-4 py-3 rounded-md border border-stone-200 bg-white">
          <p className="text-2xl font-serif leading-none mb-0.5 text-stone-800">
            {uncitedIncPct}% vs {citedIncPct}%
          </p>
          <p className="text-[11px] font-medium text-stone-500">
            uncited vs. cited passages flagged Sel. or Inc.
          </p>
        </div>
      </div>

      {/* Stacked bars */}
      <div className="space-y-5">
        {groups.map((grp) => {
          const problemPct = Math.round(
            ((grp.counts.INCONSISTENT + grp.counts.SELECTIVE) / grp.total) * 100
          );
          return (
            <div key={grp.label}>
              {/* Label row */}
              <div className="flex items-baseline gap-2 mb-1.5" style={{ paddingLeft: LABEL_W }}>
                {grp.cited ? (
                  <span
                    className="text-[10px] font-bold px-1.5 py-px rounded uppercase tracking-wide"
                    style={{ backgroundColor: COMMONLY_CITED_COLOR_LIGHT, color: COMMONLY_CITED_COLOR }}
                  >
                    Cited
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">
                    Not Cited
                  </span>
                )}
                <span className="text-[10px] text-stone-400">
                  {grp.total} passages · {problemPct}% Selective or Inconsistent
                </span>
              </div>

              {/* Bar row */}
              <div className="flex items-center gap-3">
                {/* Left label */}
                <div className="shrink-0" style={{ width: LABEL_W }} />

                {/* The bar */}
                <div className="flex-1 flex rounded overflow-hidden" style={{ height: BAR_H }}>
                  {RATINGS.map((r) => {
                    const count = grp.counts[r];
                    const pct   = (count / grp.total) * 100;
                    if (!pct) return null;

                    const isHov = hoveredSeg?.group === grp.label && hoveredSeg?.rating === r;

                    return (
                      <div
                        key={r}
                        className="flex items-center justify-center relative transition-all duration-100"
                        style={{
                          width:           `${pct}%`,
                          backgroundColor: RATING_FILL[r],
                          opacity:         hoveredSeg && !isHov ? 0.55 : 1,
                          cursor:          "default",
                          outline:         isHov ? `2px inset rgba(0,0,0,0.15)` : "none",
                        }}
                        onMouseEnter={() => setHoveredSeg({ group: grp.label, rating: r })}
                        onMouseLeave={() => setHoveredSeg(null)}
                        title={`${RATING_LABEL[r]}: ${count} (${Math.round(pct)}%)`}
                      >
                        {pct > 8 && (
                          <span className="text-[10px] font-semibold text-white select-none leading-none">
                            {count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Segment detail on hover */}
                <div className="w-28 shrink-0">
                  {hoveredSeg?.group === grp.label && (
                    <div>
                      <p className="text-[11px] font-semibold text-stone-700">
                        {RATING_LABEL[hoveredSeg.rating]}
                      </p>
                      <p className="text-[10px] text-stone-400">
                        {grp.counts[hoveredSeg.rating]} records ·{" "}
                        {Math.round((grp.counts[hoveredSeg.rating] / grp.total) * 100)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div
        className="flex flex-wrap gap-x-5 gap-y-1.5 mt-5"
        style={{ paddingLeft: LABEL_W }}
      >
        {RATINGS.map((r) => (
          <div key={r} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm inline-block shrink-0"
              style={{ backgroundColor: RATING_FILL[r] }}
            />
            <span className="text-[10px] text-stone-500">{RATING_LABEL[r]}</span>
          </div>
        ))}
      </div>

      {/* Callout findings */}
      <div
        className="mt-5 space-y-2"
        style={{ paddingLeft: LABEL_W }}
      >
        <div
          className="border-l-2 pl-3 py-1"
          style={{ borderColor: RATING_FILL.SELECTIVE }}
        >
          <p className="text-[11px] text-stone-600 leading-relaxed">
            <span className="font-semibold text-stone-800">
              {citedSelective === 5
                ? "All five Selective ratings"
                : `${citedSelective} of ${citedSelective + uncitedSelective} Selective ratings`}
            </span>{" "}
            belong to passages cited in SBC doctrinal literature. These are the
            commands applied with the most social and gender asymmetry — enforced
            on some members and not others — and they appear explicitly in the
            Baptist Faith &amp; Message.
          </p>
        </div>
        <div
          className="border-l-2 border-stone-300 pl-3 py-1"
        >
          <p className="text-[11px] text-stone-600 leading-relaxed">
            Uncited passages have a higher outright-Inconsistent rate (
            <span className="font-semibold">{uncitedIncPct}%</span> vs{" "}
            <span className="font-semibold">{citedIncPct}%</span>
            ). The pattern: passages the SBC ignores entirely tend to be obscure;
            the passages it applies selectively are the ones it has publicly
            claimed as authoritative.
          </p>
        </div>
      </div>
    </div>
  );
}
