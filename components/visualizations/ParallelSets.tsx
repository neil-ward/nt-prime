"use client";

/**
 * ParallelSets — Q1 anchor visualization
 *
 * Modes:
 *   showBook=false  →  3 axes: Speaker → NT Section → Dataset
 *   showBook=true   →  4 axes: Speaker → NT Section → Book → Dataset
 *
 * colorBy="dataset"  ribbons colored by Dataset (A/B/D)
 * colorBy="speaker"  ribbons colored by Speaker group
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { NTRecord, Dataset, SpeakerGroup, NTSection } from "@/lib/types";
import {
  DATASET_COLORS,
  DATASET_LABELS,
  DATASET_ORDER,
  SPEAKER_ORDER,
  NT_SECTION_ORDER,
  BOOK_ORDER,
  BOOK_ABBREVIATIONS,
  BOOK_TO_SECTION,
  NT_SECTION_COLORS,
  datasetColor,
  speakerColor,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface AxisNode {
  axis: number;
  value: string;
  total: number;
  y0: number;
  y1: number;
}

interface Ribbon {
  key: string;
  speaker: SpeakerGroup;
  section: NTSection;
  book: string;       // "" when showBook=false
  dataset: Dataset;
  count: number;
  citedCount: number;
  hasCited: boolean;
  /**
   * spans[i] = [leftTop, leftBot, rightTop, rightBot] normalized 0–1
   * 2 spans in 3-axis mode, 3 spans in 4-axis mode
   */
  spans: [number, number, number, number][];
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const AXIS_WIDTH           = 16;
const H_PADDING            = 0.02;
const NODE_GAP             = 0.009;
const RIBBON_OPACITY       = 0.40;
const RIBBON_HOVER_OPACITY = 0.82;
const RIBBON_FADE_OPACITY  = 0.05;

// ---------------------------------------------------------------------------
// Layout computation
// ---------------------------------------------------------------------------

interface LayoutResult {
  axes: AxisNode[][];
  colX: number[];
  ribbons: Ribbon[];
  py: (n: number) => number;
  ribbonPath: (x0: number, lt: number, lb: number, x1: number, rt: number, rb: number) => string;
  top: number;
}

function computeLayout(
  records: NTRecord[],
  width: number,
  height: number,
  showBook: boolean
): LayoutResult {
  const usableH = height * (1 - H_PADDING * 2);
  const top     = height * H_PADDING;
  const py      = (n: number) => top + n * usableH;

  const colX = showBook
    ? [width * 0.05, width * 0.30, width * 0.55, width * 0.84]
    : [width * 0.05, width * 0.44, width * 0.83];

  // ── Totals ──
  const spTotals:  Record<string, number> = {};
  const secTotals: Record<string, number> = {};
  const bkTotals:  Record<string, number> = {};
  const dsTotals:  Record<string, number> = {};
  for (const r of records) {
    spTotals[r.speaker_group]  = (spTotals[r.speaker_group]  ?? 0) + 1;
    secTotals[r.nt_section]    = (secTotals[r.nt_section]    ?? 0) + 1;
    bkTotals[r.book]           = (bkTotals[r.book]           ?? 0) + 1;
    dsTotals[r.dataset]        = (dsTotals[r.dataset]        ?? 0) + 1;
  }
  const total = records.length;

  function buildAxis(order: string[], totals: Record<string, number>, axisIdx: number): AxisNode[] {
    const present  = order.filter((v) => (totals[v] ?? 0) > 0);
    const barTotal = 1 - Math.max(0, present.length - 1) * NODE_GAP;
    let cursor = 0;
    return present.map((v) => {
      const nodeH = ((totals[v] ?? 0) / total) * barTotal;
      const node: AxisNode = { axis: axisIdx, value: v, total: totals[v] ?? 0, y0: cursor, y1: cursor + nodeH };
      cursor += nodeH + NODE_GAP;
      return node;
    });
  }

  const axis0  = buildAxis(SPEAKER_ORDER,    spTotals,  0);
  const axis1  = buildAxis(NT_SECTION_ORDER, secTotals, 1);
  const axis2B = buildAxis(BOOK_ORDER,       bkTotals,  2);               // book axis (4-axis mode)
  const axis2D = buildAxis(DATASET_ORDER,    dsTotals,  2);               // dataset axis (3-axis mode)
  const axis3  = buildAxis(DATASET_ORDER,    dsTotals,  3);               // dataset axis (4-axis mode)

  const allAxes  = showBook ? [axis0, axis1, axis2B, axis3] : [axis0, axis1, axis2D];
  const barTots  = allAxes.map((ax) => 1 - Math.max(0, ax.length - 1) * NODE_GAP);

  // ── Segment cursors ──
  // segR[axisIdx][value] = running top-cursor on right edge of that axis bar
  // segL[axisIdx][value] = running top-cursor on left  edge of that axis bar
  const segR: Record<string, number>[] = allAxes.map((ax) =>
    Object.fromEntries(ax.map((n) => [n.value, n.y0]))
  );
  const segL: Record<string, number>[] = allAxes.map((ax) =>
    Object.fromEntries(ax.map((n) => [n.value, n.y0]))
  );

  // ── Cited counts ──
  const citedCounts: Record<string, number> = {};

  // ── Build ribbons ──
  const ribbons: Ribbon[] = [];

  if (showBook) {
    // 4-axis: Speaker → Section → Book → Dataset  (3 spans)
    for (const sp of SPEAKER_ORDER) {
      for (const sec of NT_SECTION_ORDER) {
        for (const bk of BOOK_ORDER) {
          for (const ds of DATASET_ORDER) {
            let count = 0;
            for (const r of records) {
              if (r.speaker_group === sp && r.nt_section === sec && r.book === bk && r.dataset === ds) count++;
            }
            if (count === 0) continue;

            const frac = count / total;
            const [bt0, bt1, bt2, bt3] = barTots;

            const sp0lTop = segR[0][sp];   segR[0][sp]  += frac * bt0; const sp0lBot = segR[0][sp];
            const sp0rTop = segL[1][sec];  segL[1][sec] += frac * bt1; const sp0rBot = segL[1][sec];
            const sp1lTop = segR[1][sec];  segR[1][sec] += frac * bt1; const sp1lBot = segR[1][sec];
            const sp1rTop = segL[2][bk];   segL[2][bk]  += frac * bt2; const sp1rBot = segL[2][bk];
            const sp2lTop = segR[2][bk];   segR[2][bk]  += frac * bt2; const sp2lBot = segR[2][bk];
            const sp2rTop = segL[3][ds];   segL[3][ds]  += frac * bt3; const sp2rBot = segL[3][ds];

            const key = `${sp}|${sec}|${bk}|${ds}`;
            const cc  = records.filter((r) => r.speaker_group === sp && r.nt_section === sec && r.book === bk && r.dataset === ds && r.commonly_cited).length;
            citedCounts[key] = cc;

            ribbons.push({
              key, speaker: sp as SpeakerGroup, section: sec as NTSection, book: bk, dataset: ds as Dataset,
              count, citedCount: cc, hasCited: cc > 0,
              spans: [
                [sp0lTop, sp0lBot, sp0rTop, sp0rBot],
                [sp1lTop, sp1lBot, sp1rTop, sp1rBot],
                [sp2lTop, sp2lBot, sp2rTop, sp2rBot],
              ],
            });
          }
        }
      }
    }
  } else {
    // 3-axis: Speaker → Section → Dataset  (2 spans)
    for (const sp of SPEAKER_ORDER) {
      for (const sec of NT_SECTION_ORDER) {
        for (const ds of DATASET_ORDER) {
          let count = 0;
          let cc    = 0;
          for (const r of records) {
            if (r.speaker_group === sp && r.nt_section === sec && r.dataset === ds) {
              count++;
              if (r.commonly_cited) cc++;
            }
          }
          if (count === 0) continue;

          const frac = count / total;
          const [bt0, bt1, bt2] = barTots;

          const sp0lTop = segR[0][sp];   segR[0][sp]  += frac * bt0; const sp0lBot = segR[0][sp];
          const sp0rTop = segL[1][sec];  segL[1][sec] += frac * bt1; const sp0rBot = segL[1][sec];
          const sp1lTop = segR[1][sec];  segR[1][sec] += frac * bt1; const sp1lBot = segR[1][sec];
          const sp1rTop = segL[2][ds];   segL[2][ds]  += frac * bt2; const sp1rBot = segL[2][ds];

          ribbons.push({
            key: `${sp}|${sec}|${ds}`, speaker: sp as SpeakerGroup, section: sec as NTSection,
            book: "", dataset: ds as Dataset, count, citedCount: cc, hasCited: cc > 0,
            spans: [
              [sp0lTop, sp0lBot, sp0rTop, sp0rBot],
              [sp1lTop, sp1lBot, sp1rTop, sp1rBot],
            ],
          });
        }
      }
    }
  }

  function ribbonPath(
    x0: number, lt: number, lb: number,
    x1: number, rt: number, rb: number
  ): string {
    const mx = (x0 + x1) / 2;
    const [t0, b0, t1, b1] = [py(lt), py(lb), py(rt), py(rb)];
    return `M ${x0} ${t0} C ${mx} ${t0}, ${mx} ${t1}, ${x1} ${t1} L ${x1} ${b1} C ${mx} ${b1}, ${mx} ${b0}, ${x0} ${b0} Z`;
  }

  return { axes: allAxes, colX, ribbons, py, ribbonPath, top };
}

// ---------------------------------------------------------------------------
// Exported payload type
// ---------------------------------------------------------------------------

export interface RibbonClickPayload {
  key:     string;
  speaker: SpeakerGroup;
  section: NTSection;
  book:    string;
  dataset: Dataset;
  count:   number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ParallelSetsProps {
  records:            NTRecord[];
  height?:            number;
  showBook?:          boolean;
  commonlyCitedOnly?: boolean;
  colorBy?:           "dataset" | "speaker";
  onRibbonClick?:     (payload: RibbonClickPayload) => void;
  /**
   * When provided, draws a tapered bezier "tail" from the active ribbon's
   * last-axis span into the adjacent sidebar area. The path uses SVG
   * overflow-visible to extend rightward beyond the SVG width.
   */
  connector?: {
    gap:          number;  // px between the SVG right edge and the sidebar
    headerHeight: number;  // px of the sidebar header to fan into
    selectedKey:  string | null;
  };
}

export default function ParallelSets({
  records,
  height = 620,
  showBook = true,
  commonlyCitedOnly = false,
  colorBy = "dataset",
  onRibbonClick,
  connector,
}: ParallelSetsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth]   = useState(900);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) setWidth(w);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const layout = computeLayout(records, width, height, showBook);
  const { axes, colX, ribbons, py, ribbonPath, top } = layout;
  const axisCount = axes.length;

  const isHighlighted = useCallback(
    (r: Ribbon) => {
      if (!hovered) return true;
      if (hovered === r.key) return true;
      const colon = hovered.indexOf(":");
      if (colon === -1) return false;
      const ai  = parseInt(hovered.slice(0, colon));
      const val = hovered.slice(colon + 1);
      if (ai === 0)               return r.speaker === val;
      if (ai === 1)               return r.section === val;
      if (ai === 2 && axisCount === 4) return r.book    === val;
      if (ai === axisCount - 1)   return r.dataset === val;
      return false;
    },
    [hovered, axisCount]
  );

  const axisLabel = (ai: number, value: string): string => {
    if (ai === axisCount - 1)       return DATASET_LABELS[value as Dataset] ?? value;
    if (ai === 2 && axisCount === 4) return BOOK_ABBREVIATIONS[value] ?? value;
    return value;
  };

  const axisNodeColor = (ai: number, value: string): string => {
    if (ai === axisCount - 1) return DATASET_COLORS[value as Dataset] ?? "#64748b";
    if (ai === 2 && axisCount === 4) {
      const sec = BOOK_TO_SECTION[value];
      return sec ? (NT_SECTION_COLORS[sec] ?? "#334155") : "#334155";
    }
    return "#334155";
  };

  const ribbonFill = (r: Ribbon): string =>
    colorBy === "speaker" ? speakerColor(r.speaker) : datasetColor(r.dataset);

  const AXIS_HEADERS = showBook
    ? ["SPEAKER", "NT SECTION", "BOOK", "DATASET"]
    : ["SPEAKER", "NT SECTION", "DATASET"];

  return (
    <div ref={containerRef} className="w-full select-none" style={{ height }}>
      <svg width={width} height={height} onClick={() => setHovered(null)} className="overflow-visible">

        {/* ── Ribbons ── */}
        {ribbons.map((r) => {
          const highlighted = isHighlighted(r);
          const fill        = ribbonFill(r);
          const onEnter = (e: React.MouseEvent) => { e.stopPropagation(); setHovered(r.key); };
          const onLeave = () => setHovered(null);
          const onClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            onRibbonClick?.({ key: r.key, speaker: r.speaker, section: r.section, book: r.book, dataset: r.dataset, count: r.count });
          };

          const paths = r.spans.map((sp, i) =>
            ribbonPath(colX[i] + AXIS_WIDTH, sp[0], sp[1], colX[i + 1], sp[2], sp[3])
          );

          if (!commonlyCitedOnly) {
            const opacity = !hovered ? RIBBON_OPACITY : highlighted ? RIBBON_HOVER_OPACITY : RIBBON_FADE_OPACITY;
            return (
              <g key={r.key}>
                {paths.map((d, i) => (
                  <path key={i} d={d} fill={fill} opacity={opacity}
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick} />
                ))}
              </g>
            );
          }

          // ── Cited mode: ghost + proportional amber slice ──
          const ghostOp = hovered ? (highlighted ? 0.20 : 0.06) : 0.15;
          const subOp   = r.citedCount > 0
            ? (hovered ? (highlighted ? RIBBON_HOVER_OPACITY : RIBBON_FADE_OPACITY) : RIBBON_HOVER_OPACITY)
            : 0;
          const frac = r.citedCount / r.count;

          const citedPaths = r.spans.map((sp, i) => {
            const clb = sp[0] + (sp[1] - sp[0]) * frac;
            const crb = sp[2] + (sp[3] - sp[2]) * frac;
            return ribbonPath(colX[i] + AXIS_WIDTH, sp[0], clb, colX[i + 1], sp[2], crb);
          });

          return (
            <g key={r.key}>
              {paths.map((d, i) => (
                <path key={`g${i}`} d={d} fill="#cbd5e1" opacity={ghostOp}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick} />
              ))}
              {r.citedCount > 0 && citedPaths.map((d, i) => (
                <path key={`c${i}`} d={d} fill="#d97706" opacity={subOp}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick} />
              ))}
            </g>
          );
        })}

        {/* ── Axis bars + labels ── */}
        {axes.map((axisNodes, ai) => (
          <g key={ai}>
            {axisNodes.map((node) => {
              const nodeKey = `${ai}:${node.value}`;
              const isAct  = hovered === nodeKey;
              const yTop   = py(node.y0);
              const yBot   = py(node.y1);
              const nodeH  = yBot - yTop;
              const isTiny = nodeH < 12;
              const midY   = yTop + nodeH / 2;
              const labelY = isTiny ? yTop - 2 : midY;

              const labelX =
                ai === 0              ? colX[0] - 8
                : ai === axisCount-1  ? colX[ai] + AXIS_WIDTH + 8
                : ai === 2 && axisCount === 4 ? colX[2] + AXIS_WIDTH + 8
                : colX[ai] + AXIS_WIDTH / 2;

              const anchor =
                ai === 0 ? "end"
                : (ai === axisCount - 1 || (ai === 2 && axisCount === 4)) ? "start"
                : "middle";

              const fontSize = (ai === 2 && axisCount === 4)
                ? (nodeH > 18 ? 10 : 9)
                : (nodeH > 24 ? 12 : 10);

              return (
                <g key={node.value} className="cursor-pointer"
                  onMouseEnter={(e) => { e.stopPropagation(); setHovered(nodeKey); }}
                  onMouseLeave={() => setHovered(null)}
                >
                  <rect
                    x={colX[ai]} y={yTop}
                    width={AXIS_WIDTH} height={Math.max(nodeH, 1)}
                    fill={axisNodeColor(ai, node.value)}
                    opacity={!hovered ? 0.80 : isAct ? 1 : 0.28}
                    rx={2} className="transition-opacity duration-150"
                  />
                  <g className="pointer-events-none">
                    {/* Callout tick for tiny nodes on left & book axes */}
                    {isTiny && (ai === 0 || (ai === 2 && axisCount === 4)) && (
                      <line
                        x1={ai === 0 ? colX[0] - 4 : colX[2] + AXIS_WIDTH + 4} y1={midY}
                        x2={ai === 0 ? colX[0] - 7 : colX[2] + AXIS_WIDTH + 7} y2={labelY + 4}
                        stroke="#94a3b8" strokeWidth={0.75}
                      />
                    )}
                    <text x={labelX} y={labelY} dy="0.35em" textAnchor={anchor}
                      fontSize={fontSize}
                      fontFamily="ui-sans-serif, system-ui, sans-serif"
                      fill={!hovered || isAct ? "#1e293b" : "#94a3b8"}
                      className="transition-all duration-150"
                    >
                      {axisLabel(ai, node.value)}
                    </text>
                    {isAct && nodeH > 14 && (
                      <text x={labelX} y={labelY + 14} dy="0.35em" textAnchor={anchor}
                        fontSize={9}
                        fontFamily="ui-sans-serif, system-ui, sans-serif" fill="#64748b"
                      >
                        {node.total}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}
          </g>
        ))}

        {/* ── Axis header labels ── */}
        {AXIS_HEADERS.map((label, i) => (
          <text key={label}
            x={colX[i] + AXIS_WIDTH / 2} y={top - 16}
            textAnchor="middle" fontSize={10} fontWeight={600} letterSpacing={0.8}
            fontFamily="ui-sans-serif, system-ui, sans-serif" fill="#64748b"
            className="pointer-events-none"
          >
            {label}
          </text>
        ))}

        {/* ── Sidebar connector tail ── */}
        {connector && (() => {
          // Only show for the clicked/selected ribbon, not hover.
          const activeKey = connector.selectedKey;
          if (!activeKey) return null;
          const r = ribbons.find((rb) => rb.key === activeKey);
          if (!r) return null;

          const lastSpan = r.spans[r.spans.length - 1];
          // Right edge of the last axis bar — where the ribbon ends
          const leftX   = colX[axisCount - 1] + AXIS_WIDTH;
          const leftTop = py(lastSpan[2]);
          const leftBot = py(lastSpan[3]);
          // Target: left edge of the sidebar (past the gap)
          const rightX   = width + connector.gap;
          const rightTop = 0;
          const rightBot = connector.headerHeight;

          const midX = (leftX + rightX) / 2;
          const d = [
            `M ${leftX} ${leftTop}`,
            `C ${midX} ${leftTop}, ${midX} ${rightTop}, ${rightX} ${rightTop}`,
            `L ${rightX} ${rightBot}`,
            `C ${midX} ${rightBot}, ${midX} ${leftBot}, ${leftX} ${leftBot}`,
            "Z",
          ].join(" ");

          const fill    = ribbonFill(r);
          const opacity = 0.14;

          return (
            <path
              d={d} fill={fill} opacity={opacity}
              className="pointer-events-none transition-opacity duration-200"
            />
          );
        })()}

        {/* ── Tooltip ── */}
        {hovered && hovered.includes("|") && (() => {
          const r = ribbons.find((rb) => rb.key === hovered);
          if (!r) return null;
          const midY = py((r.spans[0][0] + r.spans[0][1]) / 2);
          const midX = (colX[0] + AXIS_WIDTH + colX[1]) / 2;
          const bookStr = r.book ? ` · ${BOOK_ABBREVIATIONS[r.book] ?? r.book}` : "";
          const countStr = commonlyCitedOnly && r.citedCount > 0
            ? `${r.citedCount} cited / ${r.count} total`
            : `${r.count} record${r.count !== 1 ? "s" : ""}`;
          return (
            <g className="pointer-events-none">
              <rect x={midX - 84} y={midY - 32} width={168} height={54}
                rx={6} fill="white" stroke="#e2e8f0" strokeWidth={1}
                filter="drop-shadow(0 1px 4px rgba(0,0,0,0.10))"
              />
              <text x={midX} y={midY - 16} textAnchor="middle"
                fontSize={10} fontWeight={600}
                fontFamily="ui-sans-serif, system-ui, sans-serif" fill="#1e293b"
              >
                {r.speaker}{bookStr}
              </text>
              <text x={midX} y={midY - 2} textAnchor="middle"
                fontSize={10} fontFamily="ui-sans-serif, system-ui, sans-serif" fill="#64748b"
              >
                {DATASET_LABELS[r.dataset]} · {r.section.replace(" Epistles", " Ep.")}
              </text>
              <text x={midX} y={midY + 13} textAnchor="middle"
                fontSize={10} fontFamily="ui-sans-serif, system-ui, sans-serif" fill="#94a3b8"
              >
                {countStr}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
