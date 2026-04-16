"use client";

/**
 * Q2ScoreScatter — record-level scatter in institutional-reach × IC space.
 *
 * X = "Institutional Reach" = average of CRG and UCA scores
 *     (how prominently a command appears in church roles and accountability)
 * Y = IC score (Institutional Consistency)
 *
 * Both axes use Y=1 / P=0.5 / N=0, producing 5 × 3 = 15 possible positions.
 * Records sharing the same position are spread into a compact grid so
 * nothing overlaps.  Color = consistency rating.  Commonly-cited records
 * are rendered slightly larger with a white ring.
 *
 * Key visual clusters:
 *  • Top-right (reach=1, IC=1): applied broadly AND consistently — all CONSISTENT
 *  • Bottom-center (reach=0.5, IC=0): medium-profile but inconsistent — 14 records
 *  • Bottom-left (reach=0, IC=0): low profile, ignored entirely — 10 INCONSISTENT
 *  • Bottom-right (reach=0.75–1, IC=0): high-profile but inconsistent — the outliers
 */

import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import type { NTRecord } from "@/lib/types";
import { COMMONLY_CITED_COLOR } from "@/lib/constants";

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
// Score helpers
// ---------------------------------------------------------------------------

function dimScore(val: string | null | undefined): number {
  return val === "Y" ? 1 : val === "P" ? 0.5 : 0;
}

function recordXY(r: NTRecord): [number, number] {
  const x = (dimScore(r.q2_crg) + dimScore(r.q2_uca)) / 2;
  const y = dimScore(r.q2_ic);
  return [x, y];
}

// ---------------------------------------------------------------------------
// Deterministic jitter
// Records sharing the same (x,y) bucket are arranged in a compact grid
// centred at the scaled position.
// ---------------------------------------------------------------------------

const SPACING = 17; // px between dots in the same bucket

function buildPositions(
  records: NTRecord[],
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
): Map<string, [number, number]> {
  // Group by bucket key
  const buckets = new Map<string, NTRecord[]>();
  records.forEach((r) => {
    const [x, y] = recordXY(r);
    const key = `${x}:${y}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(r);
  });

  const positions = new Map<string, [number, number]>();

  buckets.forEach((recs, key) => {
    const [xv, yv] = key.split(":").map(Number);
    const cx = xScale(xv);
    const cy = yScale(yv);
    const n    = recs.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);

    recs.forEach((r, i) => {
      const row    = Math.floor(i / cols);
      const col    = i % cols;
      // Centre the grid within the bucket
      const rowLen  = row === rows - 1 ? n - row * cols : cols;
      const offsetX = (col - (rowLen - 1) / 2) * SPACING;
      const offsetY = (row - (rows   - 1) / 2) * SPACING;
      positions.set(r.ref + r.dataset, [cx + offsetX, cy + offsetY]);
    });
  });

  return positions;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const MARGIN = { top: 28, right: 28, bottom: 56, left: 60 };
const HEIGHT  = 420;

// Quadrant annotation text
type TextAnchor = "start" | "end" | "middle";
const QUADS: [number, number, string, TextAnchor][] = [
  [0.98, 0.98, "Broadly applied & consistent",        "end"  ],
  [0.02, 0.98, "Narrowly applied, but consistent",    "start"],
  [0.98, 0.02, "Prominent but inconsistently applied","end"  ],
  [0.02, 0.02, "Absent — neither applied nor consistent","start"],
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props { records: NTRecord[] }

export default function Q2ScoreScatter({ records }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width,   setWidth]   = useState(720);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      if (e.contentRect.width > 0) setWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const innerW = width  - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top  - MARGIN.bottom;

  const xScale = useMemo(
    () => d3.scaleLinear().domain([0, 1]).range([0, innerW]),
    [innerW],
  );
  const yScale = useMemo(
    () => d3.scaleLinear().domain([0, 1]).range([innerH, 0]),
    [innerH],
  );

  const positions = useMemo(
    () => buildPositions(records, xScale, yScale),
    [records, xScale, yScale],
  );

  const hoveredRecord = useMemo(
    () => (hovered ? records.find((r) => r.ref + r.dataset === hovered) ?? null : null),
    [hovered, records],
  );

  // X-axis tick labels
  const xTickLabels: Record<number, string> = {
    0:    "None",
    0.25: "Low",
    0.5:  "Medium",
    0.75: "High",
    1:    "Full",
  };
  // Y-axis tick labels
  const yTickLabels: Record<number, string> = {
    0:   "No  (N)",
    0.5: "Partial (P)",
    1:   "Yes  (Y)",
  };

  const xTicks = [0, 0.25, 0.5, 0.75, 1];
  const yTicks = [0, 0.5, 1];

  return (
    <div ref={containerRef} className="w-full">
      <svg
        width={width}
        height={HEIGHT}
        className="overflow-visible select-none"
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>

          {/* Quadrant dividers */}
          <line x1={xScale(0.5)} x2={xScale(0.5)} y1={0} y2={innerH}
            stroke="#e7e5e4" strokeWidth={1} strokeDasharray="4 4" />
          <line x1={0} x2={innerW} y1={yScale(0.5)} y2={yScale(0.5)}
            stroke="#e7e5e4" strokeWidth={1} strokeDasharray="4 4" />

          {/* Quadrant labels */}
          {QUADS.map(([xp, yp, label, anchor]) => (
            <text
              key={label}
              x={xScale(xp as number)}
              y={yScale(yp as number)}
              textAnchor={anchor}
              fontSize={9}
              fontFamily="ui-sans-serif,system-ui,sans-serif"
              fill="#d4cfc9"
              style={{ userSelect: "none", pointerEvents: "none" }}
            >
              {label}
            </text>
          ))}

          {/* Grid */}
          {xTicks.map((v) => (
            <line key={`xg${v}`}
              x1={xScale(v)} x2={xScale(v)} y1={0} y2={innerH}
              stroke="#f3f0ee" strokeWidth={1}
            />
          ))}
          {yTicks.map((v) => (
            <line key={`yg${v}`}
              x1={0} x2={innerW} y1={yScale(v)} y2={yScale(v)}
              stroke="#f3f0ee" strokeWidth={1}
            />
          ))}

          {/* Dots */}
          {records.map((r) => {
            const rkey = r.ref + r.dataset;
            const pos  = positions.get(rkey);
            if (!pos) return null;
            const [cx, cy]  = pos;
            const rating    = r.q2_consistency_rating as Rating | null;
            const color     = rating ? RATING_FILL[rating] : "#e7e5e4";
            const isCited   = r.commonly_cited;
            const isHov     = hovered === rkey;
            const isDimmed  = !!hovered && !isHov;
            const baseR     = isCited ? 8 : 6;

            return (
              <g
                key={rkey}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHovered(rkey)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Cited ring */}
                {isCited && (
                  <circle
                    cx={cx} cy={cy} r={baseR + 3}
                    fill="none"
                    stroke={COMMONLY_CITED_COLOR}
                    strokeWidth={1.5}
                    opacity={isDimmed ? 0.15 : 0.7}
                  />
                )}
                <circle
                  cx={cx} cy={cy} r={baseR}
                  fill={color}
                  fillOpacity={isDimmed ? 0.12 : isHov ? 1 : 0.78}
                  stroke="white"
                  strokeWidth={isHov ? 2 : 1}
                />
              </g>
            );
          })}

          {/* Hovered record ref label */}
          {hoveredRecord && (() => {
            const rkey = hoveredRecord.ref + hoveredRecord.dataset;
            const pos  = positions.get(rkey);
            if (!pos) return null;
            const [cx, cy] = pos;
            return (
              <text
                x={cx} y={cy - 12}
                textAnchor="middle"
                fontSize={9} fontWeight={600}
                fontFamily="ui-serif,serif"
                fill="#44403c"
                style={{ pointerEvents: "none" }}
              >
                {hoveredRecord.ref}
              </text>
            );
          })()}

          {/* X axis */}
          <g transform={`translate(0,${innerH})`}>
            <line x1={0} x2={innerW} stroke="#d6d3d1" />
            {xTicks.map((v) => (
              <g key={`xt${v}`} transform={`translate(${xScale(v)},0)`}>
                <line y2={4} stroke="#d6d3d1" />
                <text y={16} textAnchor="middle" fontSize={9.5}
                  fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#a8a29e">
                  {xTickLabels[v]}
                </text>
              </g>
            ))}
            <text x={innerW / 2} y={44}
              textAnchor="middle" fontSize={10.5} fontWeight={600}
              fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#78716c">
              Institutional Reach — average of CRG + UCA scores →
            </text>
          </g>

          {/* Y axis */}
          <g>
            <line x1={0} x2={0} y1={0} y2={innerH} stroke="#d6d3d1" />
            {yTicks.map((v) => (
              <g key={`yt${v}`} transform={`translate(0,${yScale(v)})`}>
                <line x2={-4} stroke="#d6d3d1" />
                <text x={-8} textAnchor="end" dy="0.35em" fontSize={9.5}
                  fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#a8a29e">
                  {yTickLabels[v]}
                </text>
              </g>
            ))}
            <text
              transform={`translate(${-48},${innerH / 2}) rotate(-90)`}
              textAnchor="middle" fontSize={10.5} fontWeight={600}
              fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#78716c">
              IC — Institutional Consistency →
            </text>
          </g>

        </g>
      </svg>

      {/* Legend */}
      <div
        className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2"
        style={{ paddingLeft: MARGIN.left }}
      >
        {RATINGS.map((r) => {
          const count = records.filter((rec) => rec.q2_consistency_rating === r).length;
          return (
            <div key={r} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full inline-block shrink-0"
                style={{ backgroundColor: RATING_FILL[r] }}
              />
              <span className="text-[10px] text-stone-500">{RATING_LABEL[r]} · {count}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 ml-3">
          <span className="inline-flex items-center justify-center shrink-0">
            <svg width={18} height={18}>
              <circle cx={9} cy={9} r={8} fill="none" stroke={COMMONLY_CITED_COLOR} strokeWidth={1.5} opacity={0.7} />
              <circle cx={9} cy={9} r={6} fill="#e7e5e4" />
            </svg>
          </span>
          <span className="text-[10px] text-stone-400">amber ring = cited in SBC literature</span>
        </div>
        <span className="text-[10px] text-stone-400 ml-2">
          Hover any dot for full record detail
        </span>
      </div>

      {/* Hover tooltip */}
      {hoveredRecord && (
        <div
          className="mt-3 px-4 py-3 bg-white rounded border border-stone-200 max-w-lg text-sm"
          style={{ marginLeft: MARGIN.left }}
        >
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="font-serif font-semibold text-stone-800 text-[13px]">
                {hoveredRecord.ref}
              </span>
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
            {hoveredRecord.commonly_cited && (
              <span
                className="text-[9px] font-bold px-1.5 py-px rounded uppercase tracking-wide shrink-0"
                style={{ backgroundColor: "#fef3c7", color: COMMONLY_CITED_COLOR }}
              >
                Cited
              </span>
            )}
          </div>

          {/* Dimension row */}
          <div className="flex gap-5 mb-2">
            {(["q2_crg","q2_pfs","q2_uca","q2_ic","q2_mca"] as const).map((dim) => {
              const val = (hoveredRecord as unknown as Record<string, unknown>)[dim] as string | null;
              const col = val === "Y" ? "#7fbf9e" : val === "P" ? "#f0c040" : val === "N" ? "#d06060" : "#e7e5e4";
              return (
                <div key={dim} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: col }} />
                  <span className="text-[10px] text-stone-400">
                    {dim.replace("q2_", "").toUpperCase()} {val ?? "—"}
                  </span>
                </div>
              );
            })}
          </div>

          {hoveredRecord.summary && (
            <p className="text-[11px] text-stone-600 leading-relaxed">
              {hoveredRecord.summary}
            </p>
          )}
          {hoveredRecord.q2_notes && (
            <p className="text-[11px] text-stone-500 leading-relaxed mt-1.5 border-l-2 border-stone-200 pl-2.5 italic">
              {hoveredRecord.q2_notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
