"use client";

/**
 * DailyTrendChart -- area + line chart of daily event counts.
 *
 * X: date (parsed from "YYYY-MM-DD" strings).
 * Y: count.
 * Uses d3.line() + d3.area() with curveMonotoneX for smooth interpolation.
 * Area fill: #457b9d at 0.15 opacity. Line stroke: #457b9d at 2px.
 * X ticks formatted "MMM DD".
 */

import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";

// ---------------------------------------------------------------------------
// Palette constants
// ---------------------------------------------------------------------------

const LINE_COLOR = "#457b9d";
const AREA_OPACITY = 0.15;
const GRID_STROKE = "#e7e5e4";
const LABEL_FILL = "#a8a29e";
const AXIS_LABEL_FILL = "#78716c";
const HEADING_FILL = "#1c1917";
const DOT_FILL = "#457b9d";
const FONT = "ui-sans-serif,system-ui,sans-serif";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const MARGIN = { top: 16, right: 20, bottom: 44, left: 44 };
const HEIGHT = 260;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  data: { day: string; count: number }[];
}

export default function DailyTrendChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Responsive width
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      if (e.contentRect.width > 0) setWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Parse and sort data
  const parsed = useMemo(() => {
    return data
      .map((d) => ({ date: new Date(d.day + "T00:00:00"), count: d.count }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [data]);

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const xScale = useMemo(() => {
    const extent = d3.extent(parsed, (d) => d.date) as [Date, Date];
    return d3.scaleTime().domain(extent).range([0, innerW]);
  }, [parsed, innerW]);

  const maxCount = useMemo(
    () => d3.max(parsed, (d) => d.count) ?? 1,
    [parsed],
  );

  const yScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([0, Math.ceil(maxCount * 1.1)])
        .range([innerH, 0]),
    [maxCount, innerH],
  );

  // Line + area generators
  const lineGen = useMemo(
    () =>
      d3
        .line<{ date: Date; count: number }>()
        .x((d) => xScale(d.date))
        .y((d) => yScale(d.count))
        .curve(d3.curveMonotoneX),
    [xScale, yScale],
  );

  const areaGen = useMemo(
    () =>
      d3
        .area<{ date: Date; count: number }>()
        .x((d) => xScale(d.date))
        .y0(innerH)
        .y1((d) => yScale(d.count))
        .curve(d3.curveMonotoneX),
    [xScale, yScale, innerH],
  );

  const linePath = useMemo(() => lineGen(parsed) ?? "", [lineGen, parsed]);
  const areaPath = useMemo(() => areaGen(parsed) ?? "", [areaGen, parsed]);

  const yTicks = useMemo(() => yScale.ticks(5), [yScale]);
  const xTicks = useMemo(() => xScale.ticks(Math.min(parsed.length, 7)), [xScale, parsed.length]);

  const formatDate = d3.timeFormat("%b %d");

  // Hover detection -- find nearest data point to mouse X
  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;
    const date = xScale.invert(mouseX);
    const bisect = d3.bisector<{ date: Date; count: number }, Date>((d) => d.date).center;
    const idx = bisect(parsed, date);
    setHoveredIdx(idx >= 0 && idx < parsed.length ? idx : null);
  };

  const hoveredPoint = hoveredIdx !== null ? parsed[hoveredIdx] : null;

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
              key={`yl${t}`}
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

          {/* X axis line */}
          <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke="#d6d3d1" />

          {/* X axis ticks + labels */}
          {xTicks.map((t) => (
            <g key={t.toISOString()} transform={`translate(${xScale(t)},${innerH})`}>
              <line y2={4} stroke="#d6d3d1" />
              <text
                y={16}
                textAnchor="middle"
                fontSize={9}
                fontFamily={FONT}
                fill={LABEL_FILL}
              >
                {formatDate(t)}
              </text>
            </g>
          ))}

          {/* X axis label */}
          <text
            x={innerW / 2}
            y={innerH + 36}
            textAnchor="middle"
            fontSize={10}
            fontWeight={600}
            fontFamily={FONT}
            fill={AXIS_LABEL_FILL}
          >
            Date
          </text>

          {/* Area fill */}
          <path d={areaPath} fill={LINE_COLOR} opacity={AREA_OPACITY} />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Hover crosshair + dot */}
          {hoveredPoint && (
            <g className="pointer-events-none">
              <line
                x1={xScale(hoveredPoint.date)}
                x2={xScale(hoveredPoint.date)}
                y1={0}
                y2={innerH}
                stroke={LABEL_FILL}
                strokeWidth={1}
                strokeDasharray="3,3"
              />
              <circle
                cx={xScale(hoveredPoint.date)}
                cy={yScale(hoveredPoint.count)}
                r={4}
                fill="white"
                stroke={DOT_FILL}
                strokeWidth={2}
              />
              {/* Tooltip */}
              {(() => {
                const tx = xScale(hoveredPoint.date);
                const ty = yScale(hoveredPoint.count) - 12;
                const clampedX = Math.min(Math.max(tx, 56), innerW - 56);
                return (
                  <g>
                    <rect
                      x={clampedX - 52}
                      y={ty - 32}
                      width={104}
                      height={30}
                      rx={4}
                      fill="white"
                      stroke={GRID_STROKE}
                      strokeWidth={1}
                      filter="drop-shadow(0 1px 3px rgba(0,0,0,0.08))"
                    />
                    <text
                      x={clampedX}
                      y={ty - 19}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontWeight={600}
                      fontFamily={FONT}
                      fill={HEADING_FILL}
                    >
                      {formatDate(hoveredPoint.date)}
                    </text>
                    <text
                      x={clampedX}
                      y={ty - 6}
                      textAnchor="middle"
                      fontSize={9}
                      fontFamily={FONT}
                      fill={AXIS_LABEL_FILL}
                    >
                      {hoveredPoint.count} event{hoveredPoint.count !== 1 ? "s" : ""}
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {/* Invisible rect for mouse tracking */}
          <rect
            x={0}
            y={0}
            width={innerW}
            height={innerH}
            fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredIdx(null)}
          />

        </g>
      </svg>
    </div>
  );
}
