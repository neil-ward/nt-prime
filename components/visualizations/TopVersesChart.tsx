"use client";

/**
 * TopVersesChart -- horizontal bar chart of the top 20 most-viewed verses.
 *
 * Each bar is coloured neutral stone-600. The verse reference label is on
 * the left and the count is shown to the right of the bar.
 */

import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";

// ---------------------------------------------------------------------------
// Palette constants
// ---------------------------------------------------------------------------

const BAR_FILL = "#57534e";
const GRID_STROKE = "#e7e5e4";
const LABEL_FILL = "#a8a29e";
const AXIS_LABEL_FILL = "#78716c";
const TEXT_FILL = "#57534e";
const HEADING_FILL = "#1c1917";
const FONT = "ui-sans-serif,system-ui,sans-serif";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const MARGIN = { top: 8, right: 48, bottom: 24, left: 120 };
const ROW_H = 24;
const BAR_PAD = 3;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  data: { ref: string; count: number }[];
}

export default function TopVersesChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hovered, setHovered] = useState<string | null>(null);

  // Responsive width
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      if (e.contentRect.width > 0) setWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const sorted = useMemo(
    () => [...data].sort((a, b) => b.count - a.count).slice(0, 20),
    [data],
  );

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = sorted.length * ROW_H;
  const height = innerH + MARGIN.top + MARGIN.bottom;

  const maxCount = useMemo(
    () => d3.max(sorted, (d) => d.count) ?? 1,
    [sorted],
  );

  const xScale = useMemo(
    () => d3.scaleLinear().domain([0, maxCount]).range([0, innerW]),
    [maxCount, innerW],
  );

  const xTicks = useMemo(() => xScale.ticks(5), [xScale]);

  return (
    <div ref={containerRef} className="w-full">
      <svg width={width} height={height} className="overflow-visible select-none">
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>

          {/* X gridlines */}
          {xTicks.map((t) => (
            <line
              key={t}
              x1={xScale(t)}
              x2={xScale(t)}
              y1={0}
              y2={innerH}
              stroke={GRID_STROKE}
              strokeWidth={1}
            />
          ))}

          {/* X axis labels */}
          {xTicks.map((t) => (
            <text
              key={`l${t}`}
              x={xScale(t)}
              y={innerH + 14}
              textAnchor="middle"
              fontSize={9}
              fontFamily={FONT}
              fill={LABEL_FILL}
            >
              {t}
            </text>
          ))}

          {/* Bars */}
          {sorted.map((d, i) => {
            const y = i * ROW_H;
            const barH = ROW_H - BAR_PAD * 2;
            const barW = xScale(d.count);
            const isHov = hovered === d.ref;
            return (
              <g
                key={d.ref}
                onMouseEnter={() => setHovered(d.ref)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer"
              >
                {/* Ref label */}
                <text
                  x={-8}
                  y={y + ROW_H / 2}
                  dy="0.35em"
                  textAnchor="end"
                  fontSize={10}
                  fontFamily={FONT}
                  fontWeight={isHov ? 600 : 400}
                  fill={isHov ? HEADING_FILL : TEXT_FILL}
                  className="transition-colors duration-100"
                >
                  {d.ref}
                </text>

                {/* Bar */}
                <rect
                  x={0}
                  y={y + BAR_PAD}
                  width={barW}
                  height={barH}
                  rx={2}
                  fill={BAR_FILL}
                  opacity={hovered ? (isHov ? 0.95 : 0.4) : 0.8}
                  className="transition-opacity duration-150"
                />

                {/* Count label */}
                <text
                  x={barW + 6}
                  y={y + ROW_H / 2}
                  dy="0.35em"
                  textAnchor="start"
                  fontSize={9}
                  fontFamily={FONT}
                  fontWeight={600}
                  fill={isHov ? HEADING_FILL : LABEL_FILL}
                  className="transition-colors duration-100"
                >
                  {d.count}
                </text>
              </g>
            );
          })}

        </g>
      </svg>
    </div>
  );
}
