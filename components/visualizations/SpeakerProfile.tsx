"use client";

/**
 * SpeakerProfile — horizontal stacked bars showing A/B/D composition per speaker.
 * Reveals whose voice dominates each dataset and how speakers differ in emphasis.
 */

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { NTRecord, Dataset } from "@/lib/types";
import { DATASET_COLORS, DATASET_LABELS, SPEAKER_ORDER } from "@/lib/constants";

const DATASETS: Dataset[] = ["A", "B", "D"];
const MARGIN = { top: 12, right: 56, bottom: 28, left: 130 };

interface Props {
  records: NTRecord[];
  onSelect?: (records: NTRecord[], label: string) => void;
}

export default function SpeakerProfile({ records, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth]   = useState(700);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      if (e.contentRect.width > 0) setWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Build speaker × dataset rows, respecting canonical speaker order
  type Row = { speaker: string; A: number; B: number; D: number; total: number };
  const rows: Row[] = SPEAKER_ORDER
    .map((sp) => {
      const A = records.filter((r) => r.speaker_group === sp && r.dataset === "A").length;
      const B = records.filter((r) => r.speaker_group === sp && r.dataset === "B").length;
      const D = records.filter((r) => r.speaker_group === sp && r.dataset === "D").length;
      return { speaker: sp, A, B, D, total: A + B + D };
    })
    .filter((r) => r.total > 0);

  const ROW_H  = 30;
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = rows.length * ROW_H;
  const height = innerH + MARGIN.top + MARGIN.bottom;

  const xMax   = d3.max(rows, (r) => r.total) ?? 10;
  const xScale = d3.scaleLinear().domain([0, xMax]).range([0, innerW]);
  const yScale = d3.scaleBand()
    .domain(rows.map((r) => r.speaker))
    .range([0, innerH])
    .padding(0.28);

  const barH   = yScale.bandwidth();
  const series = d3.stack<Row>().keys(DATASETS)(rows);
  const xTicks = xScale.ticks(5);

  // Tooltip data
  const hovRow = hovered ? rows.find((r) => r.speaker === hovered) : null;

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      <svg width={width} height={height} className="overflow-visible">
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>

          {/* X gridlines */}
          {xTicks.map((t) => (
            <line key={t}
              x1={xScale(t)} x2={xScale(t)} y1={0} y2={innerH}
              stroke="#e7e5e4" strokeWidth={1}
            />
          ))}

          {/* Stacked bars */}
          {series.map((layer) => (
            <g key={layer.key}>
              {layer.map((d) => {
                const sp = d.data.speaker;
                const y  = yScale(sp) ?? 0;
                const x0 = xScale(d[0]);
                const x1 = xScale(d[1]);
                const w  = x1 - x0;
                if (w <= 0) return null;
                return (
                  <rect key={sp}
                    x={x0} y={y} width={w} height={barH}
                    fill={DATASET_COLORS[layer.key as Dataset]}
                    opacity={hovered ? (hovered === sp ? 0.92 : 0.3) : 0.82}
                    className="cursor-pointer transition-opacity duration-150"
                    onMouseEnter={() => setHovered(sp)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => onSelect?.(
                      records.filter((r) => r.speaker_group === sp && r.dataset === layer.key as Dataset),
                      `${sp} · Dataset ${layer.key}`
                    )}
                  />
                );
              })}
            </g>
          ))}

          {/* Speaker labels */}
          {rows.map((r) => (
            <text key={r.speaker}
              x={-8} y={(yScale(r.speaker) ?? 0) + barH / 2}
              dy="0.35em" textAnchor="end"
              fontSize={11}
              fontFamily="ui-sans-serif,system-ui,sans-serif"
              fill={hovered === r.speaker ? "#1c1917" : "#57534e"}
              className="transition-colors duration-150 pointer-events-none"
            >
              {r.speaker}
            </text>
          ))}

          {/* Total count labels */}
          {rows.map((r) => (
            <text key={`${r.speaker}-n`}
              x={xScale(r.total) + 6}
              y={(yScale(r.speaker) ?? 0) + barH / 2}
              dy="0.35em" textAnchor="start"
              fontSize={10}
              fontFamily="ui-sans-serif,system-ui,sans-serif"
              fill="#a8a29e"
              className="pointer-events-none"
            >
              {r.total}
            </text>
          ))}

          {/* X axis tick labels */}
          {xTicks.map((t) => (
            <text key={`xl${t}`}
              x={xScale(t)} y={innerH + 14}
              textAnchor="middle" fontSize={9}
              fontFamily="ui-sans-serif,system-ui,sans-serif"
              fill="#a8a29e"
            >
              {t}
            </text>
          ))}

          {/* Hover tooltip */}
          {hovRow && (() => {
            const y  = yScale(hovRow.speaker) ?? 0;
            const tx = Math.min(xScale(hovRow.total / 2), innerW - 70);
            const ty = y - 52;
            const boxY = ty < 0 ? y + barH + 6 : ty;
            return (
              <g className="pointer-events-none">
                <rect x={tx - 60} y={boxY} width={124} height={52}
                  rx={4} fill="white" stroke="#e7e5e4" strokeWidth={1}
                  filter="drop-shadow(0 1px 3px rgba(0,0,0,0.08))"
                />
                <text x={tx + 2} y={boxY + 14} textAnchor="middle"
                  fontSize={10} fontWeight={600}
                  fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#1c1917">
                  {hovRow.speaker}
                </text>
                {DATASETS.map((ds, i) => (
                  <text key={ds}
                    x={tx - 36 + i * 40} y={boxY + 30}
                    textAnchor="middle" fontSize={9}
                    fontFamily="ui-sans-serif,system-ui,sans-serif"
                    fill={DATASET_COLORS[ds]}>
                    {ds}:{hovRow[ds]}
                  </text>
                ))}
                <text x={tx + 2} y={boxY + 44} textAnchor="middle"
                  fontSize={9} fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#a8a29e">
                  {hovRow.total} total
                </text>
              </g>
            );
          })()}

        </g>
      </svg>
    </div>
  );
}
