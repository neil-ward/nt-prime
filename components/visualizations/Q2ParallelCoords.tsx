"use client";

/**
 * Q2ParallelCoords — parallel coordinates over the 5 Q2 dimensions.
 *
 * Each line = one Dataset D record, connecting its Y / P / N score
 * on CRG → PFS → UCA → IC → MCA.  Lines are colored by overall
 * consistency rating.  Hover a line to trace it and read the notes.
 *
 * The key visual story: lines that peak (Y) on PFS then plunge (N)
 * on IC reveal commands that are actively preached but institutionally
 * inconsistent.
 */

import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import type { NTRecord } from "@/lib/types";
import { COMMONLY_CITED_COLOR, COMMONLY_CITED_COLOR_LIGHT } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIMS = ["q2_crg", "q2_pfs", "q2_uca", "q2_ic", "q2_mca"] as const;
type Dim = typeof DIMS[number];

const DIM_LABEL: Record<Dim, string> = {
  q2_crg: "CRG",
  q2_pfs: "PFS",
  q2_uca: "UCA",
  q2_ic:  "IC",
  q2_mca: "MCA",
};
const DIM_LONG: Record<Dim, string> = {
  q2_crg: "Congregational / Role Guidance",
  q2_pfs: "Preached From the Pulpit",
  q2_uca: "Used in Church Accountability",
  q2_ic:  "Institutional Consistency",
  q2_mca: "Ministerial / Cultural Acceptance",
};

const RATINGS = ["CONSISTENT", "PARTIALLY CONSISTENT", "SELECTIVE", "INCONSISTENT"] as const;
type Rating = typeof RATINGS[number];

const RATING_COLOR: Record<Rating, string> = {
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

// Score → normalized 0-1 value for Y-positioning
const SCORE_Y: Record<string, number> = { Y: 1, P: 0.5, N: 0 };

const MARGIN = { top: 52, right: 24, bottom: 32, left: 24 };
const HEIGHT  = 300;

// ---------------------------------------------------------------------------
// Compute jittered Y positions so records don't pile on the same 3 pixels.
// Within each (axis, score) bucket, records are spread evenly across ±jitter.
// ---------------------------------------------------------------------------

const JITTER = 22; // px per score band

function buildPositions(
  records: NTRecord[],
  axisX: number[],
  py: d3.ScaleLinear<number, number>
): Map<string, [number, number][]> {
  // For each dim × score, collect record keys and assign evenly-spread Y
  const buckets: Record<string, string[]> = {};
  records.forEach((r) => {
    DIMS.forEach((dim) => {
      const s = (r as unknown as Record<string, unknown>)[dim] as string | null ?? "null";
      const bkey = `${dim}:${s}`;
      if (!buckets[bkey]) buckets[bkey] = [];
      buckets[bkey].push(r.ref + r.dataset);
    });
  });

  const pos = new Map<string, [number, number][]>();
  records.forEach((r) => {
    const points: [number, number][] = DIMS.map((dim, di) => {
      const s = (r as unknown as Record<string, unknown>)[dim] as string | null ?? "null";
      const bkey = `${dim}:${s}`;
      const bucket = buckets[bkey];
      const idx = bucket.indexOf(r.ref + r.dataset);
      const frac = bucket.length > 1 ? (idx / (bucket.length - 1) - 0.5) : 0;
      const baseY = py(SCORE_Y[s] ?? 0.5);
      return [axisX[di], baseY + frac * JITTER];
    });
    pos.set(r.ref + r.dataset, points);
  });
  return pos;
}

// Monotone cubic spline path through an array of [x, y] points
function linePath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  return d3.line<[number, number]>()
    .x((p) => p[0])
    .y((p) => p[1])
    .curve(d3.curveCatmullRom.alpha(0.5))(pts) ?? "";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  records: NTRecord[];
  /** Highlight only these rating values; null = all */
  filterRating?: Rating | null;
}

export default function Q2ParallelCoords({ records, filterRating = null }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  const [hovered, setHovered] = useState<string | null>(null); // ref+dataset key
  const [pinned,  setPinned]  = useState<string | null>(null);

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

  // Axis X positions — evenly spaced
  const axisX = DIMS.map((_, i) => (i / (DIMS.length - 1)) * innerW);

  // Y scale: 0 (N) → innerH (bottom), 1 (Y) → 0 (top)
  const py = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);

  const positions = useMemo(
    () => buildPositions(records, axisX, py),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, width]
  );

  const activeKey = hovered ?? pinned;
  const activeRecord = activeKey
    ? records.find((r) => r.ref + r.dataset === activeKey)
    : null;

  return (
    <div ref={containerRef} className="w-full">
      <svg width={width} height={HEIGHT} className="overflow-visible select-none"
        onClick={() => { if (!hovered) setPinned(null); }}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>

          {/* Score band guides */}
          {["Y","P","N"].map((s) => {
            const y = py(SCORE_Y[s]);
            return (
              <line key={s} x1={0} x2={innerW} y1={y} y2={y}
                stroke="#e7e5e4" strokeWidth={1} strokeDasharray="3 3"
              />
            );
          })}

          {/* Score labels on left */}
          {[["Y","Yes",1],["P","Partial",0.5],["N","No",0]].map(([s,l,v]) => (
            <text key={s as string}
              x={-8} y={py(v as number)} dy="0.35em"
              textAnchor="end" fontSize={9}
              fontFamily="ui-sans-serif,system-ui,sans-serif"
              fill="#a8a29e">
              {l as string}
            </text>
          ))}

          {/* Lines — back pass (faded) */}
          {records.map((r) => {
            const key = r.ref + r.dataset;
            const rating = r.q2_consistency_rating as Rating | null;
            if (!rating) return null;
            if (filterRating && rating !== filterRating) return null;

            const pts = positions.get(key);
            if (!pts) return null;

            const isActive = key === activeKey;
            const dimmed   = !!activeKey && !isActive;
            const color    = RATING_COLOR[rating] ?? "#a8a29e";

            return (
              <path key={key}
                d={linePath(pts)}
                fill="none"
                stroke={color}
                strokeWidth={dimmed ? 0.8 : isActive ? 2.5 : 1.2}
                opacity={dimmed ? 0.06 : isActive ? 0.95 : filterRating ? 0.55 : 0.28}
                className="cursor-pointer transition-opacity duration-150"
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setPinned((prev) => prev === key ? null : key);
                }}
              />
            );
          })}

          {/* Axis lines */}
          {axisX.map((x, i) => (
            <line key={i} x1={x} x2={x} y1={0} y2={innerH}
              stroke="#d6d3d1" strokeWidth={1.5}
            />
          ))}

          {/* Axis header labels */}
          {DIMS.map((dim, i) => (
            <g key={dim}>
              <text x={axisX[i]} y={-18} textAnchor="middle"
                fontSize={11} fontWeight={600}
                fontFamily="ui-sans-serif,system-ui,sans-serif"
                fill="#44403c">
                {DIM_LABEL[dim]}
              </text>
              <text x={axisX[i]} y={-6} textAnchor="middle"
                fontSize={8.5}
                fontFamily="ui-sans-serif,system-ui,sans-serif"
                fill="#a8a29e">
                {i === 0 ? "role" : i === 1 ? "preached" : i === 2 ? "accountability" : i === 3 ? "consistent" : "accepted"}
              </text>
            </g>
          ))}

          {/* Bottom axis labels */}
          {DIMS.map((dim, i) => (
            <text key={`b${dim}`}
              x={axisX[i]} y={innerH + 18}
              textAnchor="middle" fontSize={8.5}
              fontFamily="ui-sans-serif,system-ui,sans-serif"
              fill="#c4bcb8">
              {DIM_LONG[dim].split(" / ")[0].split(" ").slice(-1)[0].toLowerCase()}
            </text>
          ))}

          {/* Active dot highlights */}
          {activeKey && (() => {
            const pts = positions.get(activeKey);
            const rating = activeRecord?.q2_consistency_rating as Rating | null;
            if (!pts || !rating) return null;
            const color = RATING_COLOR[rating];
            return pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={4}
                fill={color} stroke="white" strokeWidth={1.5}
              />
            ));
          })()}

        </g>
      </svg>

      {/* Rating legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2 pl-6">
        {RATINGS.map((r) => {
          const count = records.filter((rec) => rec.q2_consistency_rating === r).length;
          return (
            <div key={r} className="flex items-center gap-1.5">
              <span className="w-5 h-1.5 rounded-full inline-block shrink-0"
                style={{ backgroundColor: RATING_COLOR[r] }} />
              <span className="text-[10px] text-stone-500">
                {RATING_LABEL[r]} · {count}
              </span>
            </div>
          );
        })}
        <span className="text-[10px] text-stone-400 ml-2">
          Click a line to pin · hover to trace
        </span>
      </div>

      {/* Active record detail */}
      {activeRecord && (
        <div className="mt-3 px-4 py-3 bg-white rounded border border-stone-200 text-sm">
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="font-serif font-semibold text-stone-800 text-[13px]">
                {activeRecord.ref}
              </span>
              {activeRecord.q2_consistency_rating && (
                <span className="text-[9px] font-bold px-1.5 py-px rounded"
                  style={{
                    backgroundColor: RATING_COLOR[activeRecord.q2_consistency_rating as Rating] + "22",
                    color: RATING_COLOR[activeRecord.q2_consistency_rating as Rating],
                  }}>
                  {RATING_LABEL[activeRecord.q2_consistency_rating as Rating]}
                </span>
              )}
              {activeRecord.commonly_cited && (
                <span className="text-[9px] font-bold px-1.5 py-px rounded uppercase tracking-wide"
                  style={{ backgroundColor: COMMONLY_CITED_COLOR_LIGHT, color: COMMONLY_CITED_COLOR }}>
                  Cited
                </span>
              )}
            </div>
            {/* Dim scores inline */}
            <div className="flex items-center gap-2 shrink-0">
              {DIMS.map((dim) => {
                const s = (activeRecord as unknown as Record<string, unknown>)[dim] as string | null;
                const col = s === "Y" ? "#7fbf9e" : s === "P" ? "#f0c040" : s === "N" ? "#d06060" : "#e7e5e4";
                return (
                  <div key={dim} className="flex flex-col items-center gap-0.5" title={DIM_LONG[dim]}>
                    <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: col }} />
                    <span className="text-[8px] text-stone-400">{DIM_LABEL[dim]}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {activeRecord.summary && (
            <p className="text-[11px] text-stone-600 leading-relaxed mb-1.5">
              {activeRecord.summary}
            </p>
          )}
          {activeRecord.q2_notes && (
            <p className="text-[11px] text-stone-500 leading-relaxed border-l-2 border-stone-200 pl-3 italic">
              {activeRecord.q2_notes}
            </p>
          )}
          {activeRecord.q2_typical_application && (
            <p className="text-[10px] text-stone-400 mt-1.5 leading-relaxed">
              <span className="font-semibold text-stone-500">Typical application: </span>
              {activeRecord.q2_typical_application}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
