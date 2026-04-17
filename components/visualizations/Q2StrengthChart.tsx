"use client";

/**
 * Q2StrengthChart — command strength group × consistency rating.
 *
 * Each row is one command-strength group (Explicit Command, Direct
 * Imperative, etc.), rendered as a 100%-proportional stacked bar.
 * The "n =" count beside each bar shows how many Dataset D records
 * belong to that group, making the dominance of Explicit Command
 * (79/94 = 84%) immediately visible alongside its rating distribution.
 *
 * The finding: grammatical clarity does not predict institutional
 * compliance. Direct Imperative records have the highest problematic
 * rate (50%); Explicit Commands — the most unambiguous form — account
 * for 31 of the 37 total Selective-or-Inconsistent records.
 */

import { useState, useMemo } from "react";
import type { NTRecord } from "@/lib/types";

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

// Canonical strength order — most to least direct
const STRENGTH_ORDER = [
  "Explicit Command",
  "Direct Imperative",
  "Implicit Command",
  "Implied Command",
  "Warning",
  "Narrative Example",
];

// Short descriptions for the right-hand annotation column
const STRENGTH_DESC: Record<string, string> = {
  "Explicit Command":   "Unambiguous first-person directive",
  "Direct Imperative":  "Clear grammatical imperative",
  "Implicit Command":   "Strong implication without imperative",
  "Implied Command":    "Inferrable from context",
  "Warning":            "Framed as prohibition or caution",
  "Narrative Example":  "Commanded behavior modeled in story",
};

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const ROW_H    = 44;
const BAR_H    = 22;
const LABEL_W  = 158;
const COUNT_W  = 52;
const DESC_W   = 210;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props { records: NTRecord[] }

export default function Q2StrengthChart({ records }: Props) {
  const [hovered, setHovered] = useState<string | null>(null); // group name

  // Build group rows
  const groups = useMemo(() => {
    const map = new Map<string, { counts: Record<Rating, number>; total: number }>();
    records.forEach((r) => {
      const grp = r.command_strength_group || "Other";
      if (!map.has(grp)) {
        map.set(grp, {
          counts: { CONSISTENT: 0, "PARTIALLY CONSISTENT": 0, SELECTIVE: 0, INCONSISTENT: 0 },
          total: 0,
        });
      }
      const entry = map.get(grp)!;
      if (r.q2_consistency_rating) entry.counts[r.q2_consistency_rating as Rating]++;
      entry.total++;
    });

    return [...map.entries()]
      .sort((a, b) => {
        const ia = STRENGTH_ORDER.indexOf(a[0]);
        const ib = STRENGTH_ORDER.indexOf(b[0]);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map(([name, { counts, total }]) => ({
        name,
        counts,
        total,
        problemPct: Math.round(((counts.INCONSISTENT + counts.SELECTIVE) / total) * 100),
        pctOfAll:   Math.round((total / records.length) * 100),
      }));
  }, [records]);

  const totalRecords = records.length;
  const height = groups.length * ROW_H + 8;

  return (
    <div className="w-full">

      {/* Chart */}
      <div className="w-full overflow-x-auto">
        <div style={{ minWidth: LABEL_W + 300 + COUNT_W + DESC_W }}>

          {/* Column headers */}
          <div
            className="flex items-center mb-2 text-[9px] font-semibold uppercase tracking-widest text-stone-400"
            style={{ paddingLeft: LABEL_W }}
          >
            <span className="flex-1">Rating distribution</span>
            <span style={{ width: COUNT_W }} className="text-right pr-4">Records</span>
            <span style={{ width: DESC_W }} className="pl-4">Form</span>
          </div>

          {/* Rows */}
          {groups.map((grp) => {
            const isHov = hovered === grp.name;
            const isExplicit = grp.name === "Explicit Command";
            return (
              <div
                key={grp.name}
                className="flex items-center transition-opacity duration-100"
                style={{
                  height: ROW_H,
                  opacity: hovered && !isHov ? 0.35 : 1,
                }}
                onMouseEnter={() => setHovered(grp.name)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Label */}
                <div
                  className="shrink-0 text-right pr-3"
                  style={{ width: LABEL_W }}
                >
                  <span
                    className="text-[11px] font-semibold leading-tight"
                    style={{ color: isExplicit ? "#44403c" : "#78716c" }}
                  >
                    {grp.name}
                  </span>
                  {isExplicit && (
                    <span className="text-[9px] text-stone-400 block">
                      {grp.pctOfAll}% of Dataset D
                    </span>
                  )}
                </div>

                {/* Proportional stacked bar */}
                <div className="flex-1 relative" style={{ height: BAR_H }}>
                  <div className="flex h-full rounded overflow-hidden">
                    {RATINGS.map((r) => {
                      const pct = (grp.counts[r] / grp.total) * 100;
                      if (!pct) return null;
                      return (
                        <div
                          key={r}
                          style={{
                            width: `${pct}%`,
                            backgroundColor: RATING_FILL[r],
                            position: "relative",
                          }}
                          title={`${RATING_LABEL[r]}: ${grp.counts[r]} (${Math.round(pct)}%)`}
                          className="flex items-center justify-center"
                        >
                          {pct > 12 && (
                            <span className="text-[9px] font-semibold text-white select-none">
                              {grp.counts[r]}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Problematic % callout — right edge of bar */}
                  {isHov && (
                    <div
                      className="absolute right-0 top-0 flex items-center h-full pl-2"
                      style={{ left: "100%", whiteSpace: "nowrap" }}
                    >
                    </div>
                  )}
                </div>

                {/* Count + problematic % */}
                <div
                  className="shrink-0 text-right pr-4"
                  style={{ width: COUNT_W }}
                >
                  <span className="text-[11px] font-semibold text-stone-700">
                    {grp.total}
                  </span>
                  <span
                    className="text-[9px] block"
                    style={{
                      color: grp.problemPct >= 40 ? "#d06060"
                           : grp.problemPct >= 20 ? "#f09060"
                           : "#7fbf9e",
                    }}
                  >
                    {grp.problemPct}% sel/inc
                  </span>
                </div>

                {/* Description */}
                <div
                  className="shrink-0 pl-4 border-l border-stone-200"
                  style={{ width: DESC_W }}
                >
                  <span className="text-[10px] text-stone-400 leading-snug">
                    {STRENGTH_DESC[grp.name] ?? ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div
        className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4"
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
        <div className="border-l-2 border-stone-300 pl-3 py-1">
          <p className="text-[11px] text-stone-600 leading-relaxed">
            <span className="font-semibold text-stone-800">Explicit Command</span> makes up{" "}
            {Math.round(
              (groups.find((g) => g.name === "Explicit Command")?.total ?? 0) / totalRecords * 100
            )}% of Dataset D — the clearest, most unambiguous grammatical form. It accounts
            for{" "}
            <span className="font-semibold">
              {groups.find((g) => g.name === "Explicit Command")?.counts.INCONSISTENT ?? 0} of
              the {groups.reduce((s, g) => s + g.counts.INCONSISTENT, 0)} Inconsistent records
            </span>{" "}
            in the dataset.
          </p>
        </div>
        <div className="border-l-2 border-stone-300 pl-3 py-1">
          <p className="text-[11px] text-stone-600 leading-relaxed">
            <span className="font-semibold text-stone-800">Direct Imperative</span> records —
            grammatically clear commands in their literary context — have the highest
            problematic rate at{" "}
            <span className="font-semibold">
              {groups.find((g) => g.name === "Direct Imperative")?.problemPct ?? 0}%
            </span>
            , despite being half the count of Explicit Commands.
            Grammatical clarity does not predict institutional compliance.
          </p>
        </div>
      </div>

    </div>
  );
}
