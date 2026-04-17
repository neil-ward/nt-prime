"use client";

/**
 * DatasetInterestChart -- grouped bar chart showing event types per dataset.
 *
 * One group per dataset (A, B, D), with bars for each event_type within
 * that group. Dataset colors follow the existing palette:
 *   A = #2a9d8f, B = #457b9d, D = #e76f51
 */

import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";

// ---------------------------------------------------------------------------
// Palette constants
// ---------------------------------------------------------------------------

const DS_COLORS: Record<string, string> = {
  A: "#2a9d8f",
  B: "#457b9d",
  D: "#e76f51",
};

const GRID_STROKE = "#e7e5e4";
const LABEL_FILL = "#a8a29e";
const AXIS_LABEL_FILL = "#78716c";
const HEADING_FILL = "#1c1917";
const FONT = "ui-sans-serif,system-ui,sans-serif";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const MARGIN = { top: 8, right: 16, bottom: 52, left: 44 };
const HEIGHT = 300;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  data: { dataset: string; event_type: string; count: number }[];
}

export default function DatasetInterestChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hovered, setHovered] = useState<string | null>(null); // "ds:event_type"

  // Responsive width
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      if (e.contentRect.width > 0) setWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Derive datasets and event types
  const datasets = useMemo(() => {
    const seen = new Set<string>();
    data.forEach((d) => seen.add(d.dataset));
    return ["A", "B", "D"].filter((ds) => seen.has(ds));
  }, [data]);

  const eventTypes = useMemo(() => {
    const seen = new Set<string>();
    data.forEach((d) => seen.add(d.event_type));
    return [...seen].sort();
  }, [data]);

  // Build lookup
  const countMap = useMemo(() => {
    const m = new Map<string, number>();
    data.forEach((d) => m.set(`${d.dataset}:${d.event_type}`, d.count));
    return m;
  }, [data]);

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const maxCount = useMemo(
    () => d3.max(data, (d) => d.count) ?? 1,
    [data],
  );

  // Outer band scale for datasets
  const x0 = useMemo(
    () =>
      d3
        .scaleBand()
        .domain(datasets)
        .range([0, innerW])
        .paddingInner(0.2)
        .paddingOuter(0.1),
    [datasets, innerW],
  );

  // Inner band scale for event types within each dataset group
  const x1 = useMemo(
    () =>
      d3
        .scaleBand()
        .domain(eventTypes)
        .range([0, x0.bandwidth()])
        .padding(0.08),
    [eventTypes, x0],
  );

  const yScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([0, Math.ceil(maxCount * 1.1)])
        .range([innerH, 0]),
    [maxCount, innerH],
  );

  const yTicks = useMemo(() => yScale.ticks(5), [yScale]);

  return (
    <div ref={containerRef} className="w-full">
      <svg width={width} height={HEIGHT} className="overflow-visible select-none">
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>

          {/* Y gridlines */}
          {yTicks.map((t) => (
            <line
              key={t}
              x1={0}
              x2={innerW}
              y1={yScale(t)}
              y2={yScale(t)}
              stroke={GRID_STROKE}
              strokeWidth={1}
            />
          ))}

          {/* Y axis labels */}
          {yTicks.map((t) => (
            <text
              key={`l${t}`}
              x={-8}
              y={yScale(t)}
              dy="0.35em"
              textAnchor="end"
              fontSize={9}
              fontFamily={FONT}
              fill={LABEL_FILL}
            >
              {t}
            </text>
          ))}

          {/* Grouped bars */}
          {datasets.map((ds) => {
            const groupX = x0(ds) ?? 0;
            return (
              <g key={ds} transform={`translate(${groupX},0)`}>
                {eventTypes.map((et) => {
                  const count = countMap.get(`${ds}:${et}`) ?? 0;
                  const barX = x1(et) ?? 0;
                  const barW = x1.bandwidth();
                  const barY = yScale(count);
                  const barH = innerH - barY;
                  const key = `${ds}:${et}`;
                  const isHov = hovered === key;
                  if (count === 0) return null;
                  return (
                    <g key={et}>
                      <rect
                        x={barX}
                        y={barY}
                        width={barW}
                        height={barH}
                        rx={2}
                        fill={DS_COLORS[ds] ?? AXIS_LABEL_FILL}
                        opacity={hovered ? (isHov ? 0.95 : 0.35) : 0.8}
                        className="cursor-pointer transition-opacity duration-150"
                        onMouseEnter={() => setHovered(key)}
                        onMouseLeave={() => setHovered(null)}
                      />
                      {/* Count on top of bar */}
                      {isHov && (
                        <text
                          x={barX + barW / 2}
                          y={barY - 5}
                          textAnchor="middle"
                          fontSize={9}
                          fontWeight={600}
                          fontFamily={FONT}
                          fill={HEADING_FILL}
                          className="pointer-events-none"
                        >
                          {count}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Dataset label below group */}
                <text
                  x={x0.bandwidth() / 2}
                  y={innerH + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fontFamily={FONT}
                  fill={DS_COLORS[ds] ?? AXIS_LABEL_FILL}
                >
                  Dataset {ds}
                </text>
              </g>
            );
          })}

          {/* X axis line */}
          <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke="#d6d3d1" />

        </g>
      </svg>

      {/* Legend for event types */}
      <div
        className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3"
        style={{ paddingLeft: MARGIN.left }}
      >
        {eventTypes.map((et) => (
          <div key={et} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm inline-block shrink-0"
              style={{ backgroundColor: AXIS_LABEL_FILL }}
            />
            <span className="text-[10px] text-stone-500">{et}</span>
          </div>
        ))}
      </div>

      {/* Hover detail below chart */}
      {hovered && (() => {
        const [ds, ...etParts] = hovered.split(":");
        const et = etParts.join(":");
        const count = countMap.get(hovered) ?? 0;
        return (
          <div
            className="mt-2 px-3 py-2 bg-white rounded border border-stone-200 inline-block"
            style={{ marginLeft: MARGIN.left }}
          >
            <span
              className="text-[11px] font-semibold mr-2"
              style={{ color: DS_COLORS[ds] ?? AXIS_LABEL_FILL }}
            >
              Dataset {ds}
            </span>
            <span className="text-[11px] text-stone-500">
              {et}: {count} event{count !== 1 ? "s" : ""}
            </span>
          </div>
        );
      })()}
    </div>
  );
}
