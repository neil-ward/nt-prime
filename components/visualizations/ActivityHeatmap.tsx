"use client";

/**
 * ActivityHeatmap -- hour-of-day x day-of-week heatmap.
 *
 * X axis: 24 hours (0-23).
 * Y axis: 7 days of the week (Sun-Sat).
 * Cell colour intensity: d3.scaleSequential(d3.interpolateYlOrRd) mapped
 * to the event count for that (dow, hour) bucket.
 *
 * Hover shows day name, hour range (e.g. "2 pm -- 3 pm"), and count.
 */

import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";

// ---------------------------------------------------------------------------
// Palette constants
// ---------------------------------------------------------------------------

const GRID_STROKE = "#e7e5e4";
const LABEL_FILL = "#a8a29e";
const AXIS_LABEL_FILL = "#78716c";
const TEXT_FILL = "#57534e";
const HEADING_FILL = "#1c1917";
const FONT = "ui-sans-serif,system-ui,sans-serif";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const MARGIN = { top: 8, right: 16, bottom: 36, left: 42 };
const CELL_GAP = 1;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

function formatHourRange(hour: number): string {
  const fmt = (h: number) => {
    const h12 = h % 12 || 12;
    const ampm = h < 12 ? "am" : "pm";
    return `${h12} ${ampm}`;
  };
  return `${fmt(hour)} \u2013 ${fmt((hour + 1) % 24)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  data: { dow: number; hour: number; count: number }[];
}

export default function ActivityHeatmap({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hovered, setHovered] = useState<{
    dow: number;
    hour: number;
    count: number;
  } | null>(null);

  // Responsive width
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      if (e.contentRect.width > 0) setWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Build lookup map
  const countMap = useMemo(() => {
    const m = new Map<string, number>();
    data.forEach((d) => m.set(`${d.dow}:${d.hour}`, d.count));
    return m;
  }, [data]);

  const maxCount = useMemo(
    () => d3.max(data, (d) => d.count) ?? 1,
    [data],
  );

  const colorScale = useMemo(
    () => d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxCount]),
    [maxCount],
  );

  const innerW = width - MARGIN.left - MARGIN.right;
  const cellW = (innerW - CELL_GAP * 23) / 24;
  const cellH = Math.min(cellW, 28);
  const innerH = cellH * 7 + CELL_GAP * 6;
  const height = innerH + MARGIN.top + MARGIN.bottom;

  return (
    <div ref={containerRef} className="w-full">
      <svg width={width} height={height} className="overflow-visible select-none">
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>

          {/* Day-of-week labels (Y axis) */}
          {DAY_LABELS.map((label, dow) => (
            <text
              key={label}
              x={-8}
              y={dow * (cellH + CELL_GAP) + cellH / 2}
              dy="0.35em"
              textAnchor="end"
              fontSize={9}
              fontFamily={FONT}
              fill={LABEL_FILL}
            >
              {label}
            </text>
          ))}

          {/* Hour labels (X axis) */}
          {Array.from({ length: 24 }, (_, h) => h).map((h) => {
            // Show every other label to avoid crowding
            if (h % 2 !== 0 && cellW < 24) return null;
            return (
              <text
                key={`h${h}`}
                x={h * (cellW + CELL_GAP) + cellW / 2}
                y={innerH + 14}
                textAnchor="middle"
                fontSize={8.5}
                fontFamily={FONT}
                fill={LABEL_FILL}
              >
                {h}
              </text>
            );
          })}

          {/* X axis label */}
          <text
            x={innerW / 2}
            y={innerH + 30}
            textAnchor="middle"
            fontSize={10}
            fontWeight={600}
            fontFamily={FONT}
            fill={AXIS_LABEL_FILL}
          >
            Hour of day
          </text>

          {/* Cells */}
          {Array.from({ length: 7 }, (_, dow) =>
            Array.from({ length: 24 }, (_, hour) => {
              const count = countMap.get(`${dow}:${hour}`) ?? 0;
              const x = hour * (cellW + CELL_GAP);
              const y = dow * (cellH + CELL_GAP);
              const isHov =
                hovered !== null &&
                hovered.dow === dow &&
                hovered.hour === hour;
              return (
                <rect
                  key={`${dow}:${hour}`}
                  x={x}
                  y={y}
                  width={cellW}
                  height={cellH}
                  rx={2}
                  fill={count > 0 ? colorScale(count) : "#fafaf9"}
                  stroke={isHov ? HEADING_FILL : "none"}
                  strokeWidth={isHov ? 1.5 : 0}
                  className="cursor-pointer"
                  onMouseEnter={() => setHovered({ dow, hour, count })}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            }),
          )}

          {/* Hover tooltip */}
          {hovered && (() => {
            const tx = hovered.hour * (cellW + CELL_GAP) + cellW / 2;
            const ty = hovered.dow * (cellH + CELL_GAP) - 8;
            const clampedX = Math.min(Math.max(tx, 70), innerW - 70);
            const clampedY = ty < 48 ? hovered.dow * (cellH + CELL_GAP) + cellH + 8 : ty;
            const above = ty >= 48;
            return (
              <g className="pointer-events-none">
                <rect
                  x={clampedX - 68}
                  y={above ? clampedY - 44 : clampedY}
                  width={136}
                  height={40}
                  rx={4}
                  fill="white"
                  stroke={GRID_STROKE}
                  strokeWidth={1}
                  filter="drop-shadow(0 1px 3px rgba(0,0,0,0.08))"
                />
                <text
                  x={clampedX}
                  y={above ? clampedY - 28 : clampedY + 16}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fontFamily={FONT}
                  fill={HEADING_FILL}
                >
                  {DAY_NAMES[hovered.dow]} {formatHourRange(hovered.hour)}
                </text>
                <text
                  x={clampedX}
                  y={above ? clampedY - 12 : clampedY + 32}
                  textAnchor="middle"
                  fontSize={9}
                  fontFamily={FONT}
                  fill={TEXT_FILL}
                >
                  {hovered.count} event{hovered.count !== 1 ? "s" : ""}
                </text>
              </g>
            );
          })()}

        </g>
      </svg>
    </div>
  );
}
