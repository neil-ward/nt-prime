"use client";

/**
 * StrengthProfile — proportional 100% stacked bars per dataset.
 * Reveals the rhetorical register of each dataset:
 *  - Dataset D: 84 % Explicit Command (the highest-certainty form)
 *  - Dataset A: dominated by Direct Imperative and Narrative Example
 *  - Dataset B: mixed, with more Implied Commands than A or D
 */

import { useEffect, useRef, useState } from "react";
import type { NTRecord, Dataset } from "@/lib/types";
import { DATASET_COLORS, DATASET_LABELS } from "@/lib/constants";

// Canonical strength-group order (most direct → most implicit / rhetorical)
const STRENGTH_GROUPS = [
  "Explicit Command",
  "Direct Imperative",
  "Implicit Command",
  "Implied Command",
  "Warning",
  "Narrative Example",
] as const;
type StrengthGroup = typeof STRENGTH_GROUPS[number];

// Earthy monochrome + amber for Warning, so the palette stays neutral
const STRENGTH_COLORS: Record<StrengthGroup, string> = {
  "Explicit Command":  "#292524", // stone-900
  "Direct Imperative": "#57534e", // stone-600
  "Implicit Command":  "#78716c", // stone-500
  "Implied Command":   "#a8a29e", // stone-400
  "Warning":           "#d97706", // amber-600
  "Narrative Example": "#d6d3d1", // stone-300
};

const DATASETS: Dataset[] = ["A", "B", "D"];
const ROW_H   = 44;
const LABEL_W = 90;  // left margin for dataset label
const COUNT_W = 42;  // right margin for total count
const MARGIN  = { top: 12, bottom: 20 };

interface Props {
  records: NTRecord[];
  onSelect?: (records: NTRecord[], label: string) => void;
}

export default function StrengthProfile({ records, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth]   = useState(700);
  const [hovered, setHovered] = useState<string | null>(null); // "DS:Group"

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      if (e.contentRect.width > 0) setWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Build dataset × strength counts
  type Cell = { group: StrengthGroup; count: number; pct: number };
  type DSRow = { dataset: Dataset; total: number; cells: Cell[] };
  const dsRows: DSRow[] = DATASETS.map((ds) => {
    const recs  = records.filter((r) => r.dataset === ds);
    const total = recs.length;
    const cells: Cell[] = STRENGTH_GROUPS.map((g) => {
      const count = recs.filter((r) => r.command_strength_group === g).length;
      return { group: g, count, pct: total > 0 ? count / total : 0 };
    }).filter((c) => c.count > 0);
    return { dataset: ds, total, cells };
  });

  const barW    = width - LABEL_W - COUNT_W;
  const innerH  = DATASETS.length * ROW_H;
  const height  = innerH + MARGIN.top + MARGIN.bottom;

  // Tooltip state
  const [tipInfo, setTipInfo] = useState<{
    ds: Dataset; group: StrengthGroup; count: number; pct: number; x: number; y: number;
  } | null>(null);

  return (
    <div ref={containerRef} className="w-full select-none">
      <svg width={width} height={height} className="overflow-visible">
        <g transform={`translate(0,${MARGIN.top})`}>

          {dsRows.map((row, ri) => {
            const y = ri * ROW_H;
            let xCursor = LABEL_W;
            return (
              <g key={row.dataset}>

                {/* Dataset label */}
                <text x={LABEL_W - 10} y={y + ROW_H / 2}
                  dy="0.35em" textAnchor="end"
                  fontSize={11} fontFamily="ui-sans-serif,system-ui,sans-serif"
                  fill={DATASET_COLORS[row.dataset]} fontWeight={600}>
                  {row.dataset}
                </text>
                <text x={LABEL_W - 10} y={y + ROW_H / 2 + 14}
                  dy="0.35em" textAnchor="end"
                  fontSize={9} fontFamily="ui-sans-serif,system-ui,sans-serif"
                  fill="#a8a29e">
                  {DATASET_LABELS[row.dataset]}
                </text>

                {/* Proportional segments */}
                {row.cells.map((cell) => {
                  const segW  = cell.pct * barW;
                  const segX  = xCursor;
                  xCursor    += segW;
                  const key   = `${row.dataset}:${cell.group}`;
                  const isHov = hovered === key;
                  return (
                    <g key={cell.group}>
                      <rect
                        x={segX} y={y + 4}
                        width={segW} height={ROW_H - 10}
                        fill={STRENGTH_COLORS[cell.group]}
                        opacity={hovered ? (isHov ? 0.95 : 0.4) : 0.85}
                        className="cursor-pointer transition-opacity duration-150"
                        onMouseEnter={() => {
                          setHovered(key);
                          setTipInfo({
                            ds: row.dataset, group: cell.group,
                            count: cell.count, pct: cell.pct,
                            x: segX + segW / 2, y: y + 4,
                          });
                        }}
                        onMouseLeave={() => { setHovered(null); setTipInfo(null); }}
                        onClick={() => onSelect?.(
                          records.filter((r) => r.dataset === row.dataset && r.command_strength_group === cell.group),
                          `${cell.group} · Dataset ${row.dataset}`
                        )}
                      />
                      {/* Inline pct label if wide enough */}
                      {segW > 32 && (
                        <text
                          x={segX + segW / 2} y={y + ROW_H / 2}
                          dy="0.35em" textAnchor="middle"
                          fontSize={9} fontFamily="ui-sans-serif,system-ui,sans-serif"
                          fill={cell.group === "Narrative Example" || cell.group === "Implied Command" ? "#78716c" : "white"}
                          className="pointer-events-none"
                        >
                          {Math.round(cell.pct * 100)}%
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Total count */}
                <text
                  x={LABEL_W + barW + 8} y={y + ROW_H / 2}
                  dy="0.35em" textAnchor="start"
                  fontSize={10} fontFamily="ui-sans-serif,system-ui,sans-serif"
                  fill="#a8a29e"
                >
                  {row.total}
                </text>

                {/* Row divider */}
                {ri < DATASETS.length - 1 && (
                  <line
                    x1={LABEL_W} x2={LABEL_W + barW}
                    y1={y + ROW_H} y2={y + ROW_H}
                    stroke="#f5f5f4" strokeWidth={2}
                  />
                )}
              </g>
            );
          })}

          {/* Tooltip */}
          {tipInfo && (() => {
            const tx = Math.min(Math.max(tipInfo.x, LABEL_W + 60), width - COUNT_W - 60);
            const ty = tipInfo.y - 52;
            return (
              <g className="pointer-events-none">
                <rect x={tx - 70} y={ty} width={140} height={48}
                  rx={4} fill="white" stroke="#e7e5e4" strokeWidth={1}
                  filter="drop-shadow(0 1px 3px rgba(0,0,0,0.08))"
                />
                <text x={tx} y={ty + 14} textAnchor="middle"
                  fontSize={10} fontWeight={600}
                  fontFamily="ui-sans-serif,system-ui,sans-serif"
                  fill={STRENGTH_COLORS[tipInfo.group]}>
                  {tipInfo.group}
                </text>
                <text x={tx} y={ty + 30} textAnchor="middle"
                  fontSize={9} fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#78716c">
                  {tipInfo.count} passages · {Math.round(tipInfo.pct * 100)}% of Dataset {tipInfo.ds}
                </text>
                <text x={tx} y={ty + 44} textAnchor="middle"
                  fontSize={9} fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#a8a29e">
                  {DATASET_LABELS[tipInfo.ds]}
                </text>
              </g>
            );
          })()}

        </g>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pl-[90px]">
        {STRENGTH_GROUPS.map((g) => (
          <div key={g} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block shrink-0"
              style={{ backgroundColor: STRENGTH_COLORS[g] }} />
            <span className="text-[10px] text-stone-500 font-medium">{g}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
