"use client";

/**
 * CanonArc — stacked bar chart of commands per NT book in canonical order.
 * Reveals WHERE commands concentrate across the NT narrative arc.
 */

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { NTRecord, Dataset } from "@/lib/types";
import { BOOK_ORDER, BOOK_ABBREVIATIONS, DATASET_COLORS, DATASET_LABELS } from "@/lib/constants";

const SECTIONS: { label: string; books: string[] }[] = [
  { label: "Gospels",           books: ["Matthew","Mark","Luke","John"] },
  { label: "Acts",              books: ["Acts"] },
  { label: "Pauline Epistles",  books: ["Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon"] },
  { label: "General Epistles",  books: ["Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude"] },
  { label: "Revelation",        books: ["Revelation"] },
];

const DATASETS: Dataset[] = ["A", "B", "D"];
const MARGIN = { top: 52, right: 16, bottom: 58, left: 32 };

interface Props {
  records: NTRecord[];
  onSelect?: (records: NTRecord[], label: string) => void;
}

export default function CanonArc({ records, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => { if (e.contentRect.width > 0) setWidth(e.contentRect.width); });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const height = 280;
  const innerW  = width  - MARGIN.left - MARGIN.right;
  const innerH  = height - MARGIN.top  - MARGIN.bottom;

  // Build book × dataset counts
  const presentBooks = BOOK_ORDER.filter((b) => records.some((r) => r.book === b));
  type Row = { book: string } & Record<Dataset, number>;
  const rows: Row[] = presentBooks.map((book) => ({
    book,
    A: records.filter((r) => r.book === book && r.dataset === "A").length,
    B: records.filter((r) => r.book === book && r.dataset === "B").length,
    D: records.filter((r) => r.book === book && r.dataset === "D").length,
  }));

  // D3 scales
  const stack = d3.stack<Row>().keys(DATASETS).order(d3.stackOrderNone);
  const series = stack(rows);
  const maxY = d3.max(series, (s) => d3.max(s, (d) => d[1])) ?? 10;

  const xScale = d3.scaleBand()
    .domain(presentBooks)
    .range([0, innerW])
    .padding(0.25);

  const yScale = d3.scaleLinear()
    .domain([0, Math.ceil(maxY / 5) * 5])
    .range([innerH, 0]);

  const barW = xScale.bandwidth();

  // Y gridlines
  const yTicks = yScale.ticks(5);

  // Section bracket positions
  const sectionGroups = SECTIONS.map((sec) => {
    const present = sec.books.filter((b) => presentBooks.includes(b));
    if (present.length === 0) return null;
    const x0 = (xScale(present[0]) ?? 0);
    const x1 = (xScale(present[present.length - 1]) ?? 0) + barW;
    return { label: sec.label, x0, x1, cx: (x0 + x1) / 2 };
  }).filter(Boolean) as { label: string; x0: number; x1: number; cx: number }[];

  // Tooltip
  const hovRow = hovered ? rows.find((r) => r.book === hovered) : null;

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      <svg width={width} height={height} className="overflow-visible">
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>

          {/* Y gridlines */}
          {yTicks.map((t) => (
            <line key={t}
              x1={0} x2={innerW}
              y1={yScale(t)} y2={yScale(t)}
              stroke="#e7e5e4" strokeWidth={1}
            />
          ))}
          {yTicks.map((t) => (
            <text key={`l${t}`}
              x={-6} y={yScale(t)} dy="0.35em"
              textAnchor="end" fontSize={9}
              fontFamily="ui-sans-serif,system-ui,sans-serif"
              fill="#a8a29e">
              {t}
            </text>
          ))}

          {/* Stacked bars */}
          {series.map((layer) => (
            <g key={layer.key}>
              {layer.map((d) => {
                const book = d.data.book;
                const x = xScale(book) ?? 0;
                const y0 = yScale(d[1]);
                const y1 = yScale(d[0]);
                const h = y1 - y0;
                if (h <= 0) return null;
                return (
                  <rect key={book}
                    x={x} y={y0} width={barW} height={h}
                    fill={DATASET_COLORS[layer.key as Dataset]}
                    opacity={hovered ? (hovered === book ? 0.95 : 0.35) : 0.80}
                    className="cursor-pointer transition-opacity duration-150"
                    onMouseEnter={() => setHovered(book)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => onSelect?.(
                      records.filter((r) => r.book === book && r.dataset === (layer.key as Dataset)),
                      `${book} · Dataset ${layer.key}`
                    )}
                  />
                );
              })}
            </g>
          ))}

          {/* X axis labels — book abbreviations, angled */}
          {presentBooks.map((book) => {
            const x = (xScale(book) ?? 0) + barW / 2;
            return (
              <text key={book}
                x={x} y={innerH + 10}
                textAnchor="end"
                fontSize={9}
                fontFamily="ui-sans-serif,system-ui,sans-serif"
                fill={hovered === book ? "#1c1917" : "#a8a29e"}
                transform={`rotate(-45, ${x}, ${innerH + 10})`}
                className="transition-colors duration-150 pointer-events-none"
              >
                {BOOK_ABBREVIATIONS[book] ?? book}
              </text>
            );
          })}

          {/* Section brackets */}
          {sectionGroups.map((sec) => {
            const y = -16;
            const tickH = 5;
            return (
              <g key={sec.label} className="pointer-events-none">
                <line x1={sec.x0} x2={sec.x1} y1={y} y2={y} stroke="#d6d3d1" strokeWidth={1} />
                <line x1={sec.x0} x2={sec.x0} y1={y} y2={y + tickH} stroke="#d6d3d1" strokeWidth={1} />
                <line x1={sec.x1} x2={sec.x1} y1={y} y2={y + tickH} stroke="#d6d3d1" strokeWidth={1} />
                <text x={sec.cx} y={y - 5}
                  textAnchor="middle" fontSize={9} fontWeight={500}
                  fontFamily="ui-sans-serif,system-ui,sans-serif"
                  fill="#78716c">
                  {sec.label}
                </text>
              </g>
            );
          })}

          {/* Hover tooltip */}
          {hovRow && (() => {
            const x = (xScale(hovRow.book) ?? 0) + barW / 2;
            const total = hovRow.A + hovRow.B + hovRow.D;
            const tipY = yScale(total) - 10;
            const tipX = Math.min(Math.max(x, 60), innerW - 60);
            return (
              <g className="pointer-events-none">
                <rect x={tipX - 60} y={tipY - 46} width={120} height={48}
                  rx={4} fill="white" stroke="#e7e5e4" strokeWidth={1}
                  filter="drop-shadow(0 1px 3px rgba(0,0,0,0.08))"
                />
                <text x={tipX} y={tipY - 32} textAnchor="middle"
                  fontSize={10} fontWeight={600}
                  fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#1c1917">
                  {hovRow.book}
                </text>
                {DATASETS.map((ds, i) => (
                  <text key={ds} x={tipX - 40 + i * 40} y={tipY - 16}
                    textAnchor="middle" fontSize={9}
                    fontFamily="ui-sans-serif,system-ui,sans-serif"
                    fill={DATASET_COLORS[ds]}>
                    {ds}:{hovRow[ds]}
                  </text>
                ))}
                <text x={tipX} y={tipY - 2} textAnchor="middle"
                  fontSize={9} fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#a8a29e">
                  {total} total
                </text>
              </g>
            );
          })()}

        </g>
      </svg>
    </div>
  );
}
