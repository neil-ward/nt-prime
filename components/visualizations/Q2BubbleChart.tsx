"use client";

/**
 * Q2BubbleChart — small-multiples bubble scatter for the Q2 analysis.
 *
 * Four panels share the same X axis (PFS — proportion preached).
 * Each panel's Y axis is one institutional dimension: IC, CRG, UCA, MCA.
 * Because X is identical across panels, a book appears at the same
 * horizontal position in every panel; only its vertical position shifts,
 * making it easy to see how the four dimensions diverge per book.
 *
 * Bubble size ∝ √(Dataset D record count).
 * Bubble color = dominant consistency rating for that book's D records.
 *
 * The key story: 1 Corinthians sits far right (highly preached) in every
 * panel, but low in IC — the "preached, inconsistently applied" quadrant.
 */

import { useState, useMemo } from "react";
import * as d3 from "d3";
import type { NTRecord } from "@/lib/types";
import { BOOK_ORDER, BOOK_ABBREVIATIONS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Palette & dimension definitions
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

const PANEL_DIMS = [
  { key: "q2_ic",  short: "IC",  long: "Institutionally Consistent",    color: "#c2410c" },
  { key: "q2_crg", short: "CRG", long: "Role / Congregational Guidance", color: "#0369a1" },
  { key: "q2_uca", short: "UCA", long: "Used in Church Accountability",  color: "#047857" },
  { key: "q2_mca", short: "MCA", long: "Ministerial / Cultural Accept.", color: "#b45309" },
] as const;
type DimKey = (typeof PANEL_DIMS)[number]["key"];

// ---------------------------------------------------------------------------
// Data computation
// ---------------------------------------------------------------------------

interface BookDatum {
  book:         string;
  abbr:         string;
  count:        number;
  pctPFS:       number;
  pctIC:        number;
  pctCRG:       number;
  pctUCA:       number;
  pctMCA:       number;
  color:        string;
  ratingLabel:  string;
  ratingCounts: Record<Rating, number>;
}

function dimPct(recs: NTRecord[], key: string): number {
  if (!recs.length) return 0;
  return recs.filter((r) => (r as unknown as Record<string, unknown>)[key] === "Y").length / recs.length;
}

function dominantRating(recs: NTRecord[]): Rating {
  const counts = {
    CONSISTENT: 0, "PARTIALLY CONSISTENT": 0, SELECTIVE: 0, INCONSISTENT: 0,
  } as Record<Rating, number>;
  recs.forEach((r) => {
    if (r.q2_consistency_rating) counts[r.q2_consistency_rating as Rating]++;
  });
  // Prefer worse ratings in ties (INCONSISTENT first)
  for (const r of ["INCONSISTENT", "SELECTIVE", "PARTIALLY CONSISTENT", "CONSISTENT"] as Rating[]) {
    const maxCount = Math.max(...Object.values(counts));
    if (maxCount > 0 && counts[r] >= maxCount) return r;
  }
  return "INCONSISTENT";
}

function computeBookData(records: NTRecord[]): BookDatum[] {
  const dRecs = records.filter((r) => r.dataset === "D");
  return BOOK_ORDER
    .map((book) => {
      const recs = dRecs.filter((r) => r.book === book);
      if (!recs.length) return null;
      const ratingCounts = {
        CONSISTENT: 0, "PARTIALLY CONSISTENT": 0, SELECTIVE: 0, INCONSISTENT: 0,
      } as Record<Rating, number>;
      recs.forEach((r) => {
        if (r.q2_consistency_rating) ratingCounts[r.q2_consistency_rating as Rating]++;
      });
      const dominant = dominantRating(recs);
      return {
        book,
        abbr:         BOOK_ABBREVIATIONS[book] ?? book,
        count:        recs.length,
        pctPFS:       dimPct(recs, "q2_pfs"),
        pctIC:        dimPct(recs, "q2_ic"),
        pctCRG:       dimPct(recs, "q2_crg"),
        pctUCA:       dimPct(recs, "q2_uca"),
        pctMCA:       dimPct(recs, "q2_mca"),
        color:        RATING_FILL[dominant],
        ratingLabel:  RATING_LABEL[dominant],
        ratingCounts,
      };
    })
    .filter((d): d is BookDatum => d !== null);
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const GAP    = 20;   // px gap between panels
const COLS   = 2;
const PANEL_H = 220;
const PM     = { top: 30, right: 12, bottom: 38, left: 36 }; // panel margin
const LABEL_MIN_R = 10;

// ---------------------------------------------------------------------------
// Single panel
// ---------------------------------------------------------------------------

interface PanelProps {
  dim:       (typeof PANEL_DIMS)[number];
  data:      BookDatum[];
  panelW:    number;
  rScale:    d3.ScalePower<number, number>;
  hovered:   string | null;
  onHover:   (book: string | null) => void;
}

function Panel({ dim, data, panelW, rScale, hovered, onHover }: PanelProps) {
  const innerW = panelW - PM.left - PM.right;
  const innerH = PANEL_H  - PM.top  - PM.bottom;

  const xScale = useMemo(() => d3.scaleLinear().domain([0, 1]).range([0, innerW]), [innerW]);
  const yScale = useMemo(() => d3.scaleLinear().domain([0, 1]).range([innerH, 0]), [innerH]);

  const xTicks = [0, 0.5, 1];
  const yTicks = [0, 0.5, 1];

  const pctKey = `pct${dim.key.replace("q2_", "").toUpperCase()}` as keyof BookDatum;

  return (
    <svg width={panelW} height={PANEL_H} className="overflow-visible select-none">
      <g transform={`translate(${PM.left},${PM.top})`}>

        {/* Panel title */}
        <text x={innerW / 2} y={-16}
          textAnchor="middle" fontSize={11} fontWeight={700}
          fontFamily="ui-sans-serif,system-ui,sans-serif"
          fill={dim.color}>
          {dim.short}
        </text>
        <text x={innerW / 2} y={-4}
          textAnchor="middle" fontSize={8.5}
          fontFamily="ui-sans-serif,system-ui,sans-serif"
          fill="#a8a29e">
          {dim.long}
        </text>

        {/* Quadrant dividers */}
        <line x1={xScale(0.5)} x2={xScale(0.5)} y1={0} y2={innerH}
          stroke="#ede9e6" strokeWidth={1} strokeDasharray="3 3" />
        <line x1={0} x2={innerW} y1={yScale(0.5)} y2={yScale(0.5)}
          stroke="#ede9e6" strokeWidth={1} strokeDasharray="3 3" />

        {/* Grid */}
        {xTicks.map((v) => (
          <line key={`xg${v}`} x1={xScale(v)} x2={xScale(v)} y1={0} y2={innerH}
            stroke="#f3f0ee" strokeWidth={1} />
        ))}
        {yTicks.map((v) => (
          <line key={`yg${v}`} x1={0} x2={innerW} y1={yScale(v)} y2={yScale(v)}
            stroke="#f3f0ee" strokeWidth={1} />
        ))}

        {/* Bubbles */}
        {data.map((d) => {
          const pctY = d[pctKey] as number;
          const cx = xScale(d.pctPFS);
          const cy = yScale(pctY);
          const r  = rScale(d.count);
          const isHov = hovered === d.book;
          return (
            <g key={d.book}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => onHover(d.book)}
              onMouseLeave={() => onHover(null)}>
              <circle
                cx={cx} cy={cy} r={r}
                fill={d.color}
                fillOpacity={hovered && !isHov ? 0.25 : 0.72}
                stroke="white"
                strokeWidth={isHov ? 2 : 1.5}
                strokeOpacity={hovered && !isHov ? 0.4 : 1}
              />
              {r >= LABEL_MIN_R && (
                <text x={cx} y={cy}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={8} fontWeight={700}
                  fontFamily="ui-sans-serif,system-ui,sans-serif"
                  fill="white"
                  opacity={hovered && !isHov ? 0.3 : 0.92}
                  style={{ pointerEvents: "none" }}>
                  {d.abbr}
                </text>
              )}
            </g>
          );
        })}

        {/* X axis */}
        <g transform={`translate(0,${innerH})`}>
          <line x1={0} x2={innerW} stroke="#d6d3d1" />
          {xTicks.map((v) => (
            <g key={`xt${v}`} transform={`translate(${xScale(v)},0)`}>
              <line y2={3} stroke="#d6d3d1" />
              <text y={12} textAnchor="middle" fontSize={8.5}
                fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#a8a29e">
                {Math.round(v * 100)}%
              </text>
            </g>
          ))}
          <text x={innerW / 2} y={30}
            textAnchor="middle" fontSize={9} fontWeight={500}
            fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#78716c">
            PFS (preached) →
          </text>
        </g>

        {/* Y axis */}
        <g>
          <line x1={0} x2={0} y1={0} y2={innerH} stroke="#d6d3d1" />
          {yTicks.map((v) => (
            <g key={`yt${v}`} transform={`translate(0,${yScale(v)})`}>
              <line x2={-3} stroke="#d6d3d1" />
              <text x={-6} textAnchor="end" dy="0.35em" fontSize={8.5}
                fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#a8a29e">
                {Math.round(v * 100)}%
              </text>
            </g>
          ))}
        </g>

      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props { records: NTRecord[] }

export default function Q2BubbleChart({ records }: Props) {
  const [containerW, setContainerW] = useState(720);
  const [hovered,    setHovered]    = useState<string | null>(null);

  // Responsive width via callback ref
  const measuredRef = (el: HTMLDivElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e.contentRect.width > 0) setContainerW(e.contentRect.width);
    });
    ro.observe(el);
  };

  const bookData = useMemo(() => computeBookData(records), [records]);

  const maxCount = useMemo(() => d3.max(bookData, (d) => d.count) ?? 1, [bookData]);
  const panelW   = Math.floor((containerW - GAP * (COLS - 1)) / COLS);

  const rScale = useMemo(
    () => d3.scaleSqrt().domain([0, maxCount]).range([0, Math.min(46, panelW / 8)]),
    [maxCount, panelW],
  );

  const hoveredDatum = useMemo(
    () => bookData.find((d) => d.book === hovered) ?? null,
    [bookData, hovered],
  );

  return (
    <div ref={measuredRef} className="w-full">

      {/* 2 × 2 panel grid */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gap: GAP,
        }}
      >
        {PANEL_DIMS.map((dim) => (
          <Panel
            key={dim.key}
            dim={dim}
            data={bookData}
            panelW={panelW}
            rScale={rScale}
            hovered={hovered}
            onHover={setHovered}
          />
        ))}
      </div>

      {/* Legend row */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
        {RATINGS.map((r) => (
          <div key={r} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
              style={{ backgroundColor: RATING_FILL[r] }} />
            <span className="text-[10px] text-stone-500">{RATING_LABEL[r]}</span>
          </div>
        ))}
        <span className="text-[10px] text-stone-400 ml-3">
          Color = dominant rating · size = Dataset D record count
        </span>
      </div>

      {/* Hover tooltip */}
      {hoveredDatum && (
        <div className="mt-3 px-4 py-3 bg-white rounded border border-stone-200 inline-block text-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: hoveredDatum.color }} />
            <span className="font-serif font-semibold text-stone-800 text-[13px]">
              {hoveredDatum.book}
            </span>
            <span className="text-[10px] text-stone-400 ml-1">
              {hoveredDatum.count} Dataset D record{hoveredDatum.count !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Dimension scores */}
          <div className="grid grid-cols-5 gap-3 mt-1.5 text-[11px]">
            {(["PFS", "IC", "CRG", "UCA", "MCA"] as const).map((dim) => {
              const key = `pct${dim}` as keyof BookDatum;
              const val = hoveredDatum[key] as number;
              const dimDef = PANEL_DIMS.find((p) => p.short === dim);
              return (
                <div key={dim} className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] font-bold text-stone-400">{dim}</span>
                  <span className="font-semibold" style={{ color: dimDef?.color ?? "#78716c" }}>
                    {Math.round(val * 100)}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Rating breakdown */}
          <div className="flex gap-3 mt-1.5">
            {RATINGS.map((r) =>
              hoveredDatum.ratingCounts[r] > 0 ? (
                <span key={r} className="text-[10px]" style={{ color: RATING_FILL[r] }}>
                  {RATING_LABEL[r]} {hoveredDatum.ratingCounts[r]}
                </span>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}
