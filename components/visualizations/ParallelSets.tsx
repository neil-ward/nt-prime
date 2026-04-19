"use client";

/**
 * ParallelSets — Q1 anchor visualization.
 *
 * Supports a variable number of axes assembled from four optional
 * dimensions. In canonical order:
 *
 *   [OT Root] → Speaker → NT Section → [Book] → Dataset
 *
 * The leftmost OT Root axis and the mid Book axis are independently
 * toggleable via the `showOTRoot` and `showBook` props. The Speaker,
 * NT Section, and Dataset axes are always present.
 *
 * colorBy="dataset"  ribbons colored by Dataset (A/B/D)
 * colorBy="speaker"  ribbons colored by Speaker group
 * colorBy="otRoot"   ribbons colored by OT root category (only meaningful
 *                    when the OT Root axis is enabled)
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  OT_ROOT_ORDER,
  OT_ROOT_COLORS,
  OT_ROOT_ABBREVIATIONS,
  datasetColor,
  speakerColor,
  otRootColor,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Dimension definitions — one per possible axis.
// ---------------------------------------------------------------------------

type DimensionKey = "otRoot" | "speaker" | "section" | "book" | "dataset";

interface Dimension {
  key:      DimensionKey;
  header:   string;                                 // axis header (e.g. "OT ROOT")
  order:    readonly string[];                      // display order of values
  get:      (r: NTRecord) => string;                // value extractor
  label:    (v: string) => string;                  // axis-label formatter
  color:    (v: string) => string;                  // axis-node color
}

const UNCATEGORIZED = "(uncategorized)";

const DIM_OT_ROOT: Dimension = {
  key:    "otRoot",
  header: "OT ROOT",
  order:  [...OT_ROOT_ORDER, UNCATEGORIZED],
  get:    (r) => r.ot_root_category ?? UNCATEGORIZED,
  label:  (v) => v === UNCATEGORIZED ? "—" : (OT_ROOT_ABBREVIATIONS[v] ?? v),
  color:  (v) => OT_ROOT_COLORS[v] ?? "#94a3b8",
};

const DIM_SPEAKER: Dimension = {
  key:    "speaker",
  header: "SPEAKER",
  order:  SPEAKER_ORDER,
  get:    (r) => r.speaker_group,
  label:  (v) => v,
  color:  () => "#334155",
};

const DIM_SECTION: Dimension = {
  key:    "section",
  header: "NT SECTION",
  order:  NT_SECTION_ORDER,
  get:    (r) => r.nt_section,
  label:  (v) => v,
  color:  () => "#334155",
};

const DIM_BOOK: Dimension = {
  key:    "book",
  header: "BOOK",
  order:  BOOK_ORDER,
  get:    (r) => r.book,
  label:  (v) => BOOK_ABBREVIATIONS[v] ?? v,
  color:  (v) => {
    const sec = BOOK_TO_SECTION[v];
    return sec ? (NT_SECTION_COLORS[sec] ?? "#334155") : "#334155";
  },
};

const DIM_DATASET: Dimension = {
  key:    "dataset",
  header: "DATASET",
  order:  DATASET_ORDER,
  get:    (r) => r.dataset,
  label:  (v) => DATASET_LABELS[v as Dataset] ?? v,
  color:  (v) => DATASET_COLORS[v as Dataset] ?? "#64748b",
};

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface AxisNode {
  axis:  number;
  value: string;
  total: number;
  y0:    number;
  y1:    number;
}

interface Ribbon {
  key:         string;
  path:        string[];               // value at each axis, in order
  count:       number;
  citedCount:  number;
  hasCited:    boolean;
  /** One span per gap between consecutive axes: [leftTop, leftBot, rightTop, rightBot] normalized 0-1 */
  spans:       [number, number, number, number][];
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

/**
 * Column-X coordinates as fractions of total width, keyed by axis count.
 * The left/right edges leave room for axis labels (OT Root in particular
 * has longer labels than Speaker, so the left gutter grows).
 */
const COL_FRACTIONS: Record<number, number[]> = {
  3: [0.05, 0.44, 0.83],
  4: [0.05, 0.30, 0.55, 0.84],
  5: [0.10, 0.28, 0.46, 0.64, 0.86],
};

// ---------------------------------------------------------------------------
// Layout computation
// ---------------------------------------------------------------------------

interface LayoutResult {
  axes:       AxisNode[][];
  colX:       number[];
  ribbons:    Ribbon[];
  py:         (n: number) => number;
  ribbonPath: (x0: number, lt: number, lb: number, x1: number, rt: number, rb: number) => string;
  top:        number;
  dimensions: Dimension[];
}

function computeLayout(
  records:  NTRecord[],
  width:    number,
  height:   number,
  dimensions: Dimension[],
): LayoutResult {
  const usableH = height * (1 - H_PADDING * 2);
  const top     = height * H_PADDING;
  const py      = (n: number) => top + n * usableH;

  const n = dimensions.length;
  const colFrac = COL_FRACTIONS[n] ?? COL_FRACTIONS[4];
  const colX = colFrac.map((f) => width * f);

  // ── Totals per dimension value ──
  const totals: Record<string, number>[] = dimensions.map(() => ({}));
  for (const r of records) {
    for (let i = 0; i < n; i++) {
      const v = dimensions[i].get(r);
      totals[i][v] = (totals[i][v] ?? 0) + 1;
    }
  }
  const total = records.length;

  // ── Axis layouts ──
  function buildAxis(dim: Dimension, totalsI: Record<string, number>, axisIdx: number): AxisNode[] {
    const present  = dim.order.filter((v) => (totalsI[v] ?? 0) > 0);
    const barTotal = 1 - Math.max(0, present.length - 1) * NODE_GAP;
    let cursor = 0;
    return present.map((v) => {
      const nodeH = ((totalsI[v] ?? 0) / total) * barTotal;
      const node: AxisNode = { axis: axisIdx, value: v, total: totalsI[v] ?? 0, y0: cursor, y1: cursor + nodeH };
      cursor += nodeH + NODE_GAP;
      return node;
    });
  }
  const axes: AxisNode[][] = dimensions.map((d, i) => buildAxis(d, totals[i], i));

  // ── Bar totals (normalized 0-1 for fraction-of-axis accounting) ──
  const barTots = axes.map((ax) => 1 - Math.max(0, ax.length - 1) * NODE_GAP);

  // ── Segment cursors ──
  // segR[i][value] = running top-cursor on right edge of axis i
  // segL[i][value] = running top-cursor on left  edge of axis i
  const segR: Record<string, number>[] = axes.map((ax) =>
    Object.fromEntries(ax.map((nd) => [nd.value, nd.y0]))
  );
  const segL: Record<string, number>[] = axes.map((ax) =>
    Object.fromEntries(ax.map((nd) => [nd.value, nd.y0]))
  );

  // ── Group records by their N-tuple of dimension values ──
  // Preserves dimension-wise order so ribbons pack consistently.
  const groups = new Map<string, { path: string[]; count: number; cited: number }>();

  // Iterate in canonical dimension order so ribbon packing is stable
  const orderedKeys = (function buildOrderedKeys(): string[][] {
    let result: string[][] = [[]];
    for (const dim of dimensions) {
      const next: string[][] = [];
      for (const prefix of result) {
        for (const v of dim.order) next.push([...prefix, v]);
      }
      result = next;
    }
    return result;
  })();

  // Tally records into their path buckets
  const seenPaths = new Set<string>();
  for (const r of records) {
    const path = dimensions.map((d) => d.get(r));
    const key  = path.join("|");
    seenPaths.add(key);
    const g = groups.get(key);
    if (g) {
      g.count += 1;
      if (r.commonly_cited) g.cited += 1;
    } else {
      groups.set(key, { path, count: 1, cited: r.commonly_cited ? 1 : 0 });
    }
  }

  // ── Build ribbons in canonical order ──
  const ribbons: Ribbon[] = [];
  for (const path of orderedKeys) {
    const key = path.join("|");
    if (!seenPaths.has(key)) continue;
    const g = groups.get(key)!;
    const frac = g.count / total;

    const spans: [number, number, number, number][] = [];
    for (let i = 0; i < n - 1; i++) {
      const vL = path[i];
      const vR = path[i + 1];

      const lTop = segR[i][vL];        segR[i][vL]     += frac * barTots[i];     const lBot = segR[i][vL];
      const rTop = segL[i + 1][vR];    segL[i + 1][vR] += frac * barTots[i + 1]; const rBot = segL[i + 1][vR];
      spans.push([lTop, lBot, rTop, rBot]);
    }

    ribbons.push({
      key,
      path,
      count:      g.count,
      citedCount: g.cited,
      hasCited:   g.cited > 0,
      spans,
    });
  }

  function ribbonPath(
    x0: number, lt: number, lb: number,
    x1: number, rt: number, rb: number,
  ): string {
    const mx = (x0 + x1) / 2;
    const [t0, b0, t1, b1] = [py(lt), py(lb), py(rt), py(rb)];
    return `M ${x0} ${t0} C ${mx} ${t0}, ${mx} ${t1}, ${x1} ${t1} L ${x1} ${b1} C ${mx} ${b1}, ${mx} ${b0}, ${x0} ${b0} Z`;
  }

  return { axes, colX, ribbons, py, ribbonPath, top, dimensions };
}

// ---------------------------------------------------------------------------
// Exported payload type
// ---------------------------------------------------------------------------

export interface RibbonClickPayload {
  key:     string;
  otRoot:  string;           // "" when OT Root axis is disabled
  speaker: SpeakerGroup;
  section: NTSection;
  book:    string;           // "" when Book axis is disabled
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
  showOTRoot?:        boolean;
  commonlyCitedOnly?: boolean;
  colorBy?:           "dataset" | "speaker" | "otRoot";
  onRibbonClick?:     (payload: RibbonClickPayload) => void;
  /**
   * When provided, draws a tapered bezier "tail" from the active ribbon's
   * last-axis span into the adjacent sidebar area.
   */
  connector?: {
    gap:          number;
    headerHeight: number;
    selectedKey:  string | null;
  };
}

export default function ParallelSets({
  records,
  height            = 620,
  showBook          = true,
  showOTRoot        = false,
  commonlyCitedOnly = false,
  colorBy           = "dataset",
  onRibbonClick,
  connector,
}: ParallelSetsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth]     = useState(900);
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

  // Build the active dimension list
  const dimensions = useMemo<Dimension[]>(() => {
    const dims: Dimension[] = [];
    if (showOTRoot) dims.push(DIM_OT_ROOT);
    dims.push(DIM_SPEAKER, DIM_SECTION);
    if (showBook)   dims.push(DIM_BOOK);
    dims.push(DIM_DATASET);
    return dims;
  }, [showOTRoot, showBook]);

  // Helper to find a dimension's index in the current axis list
  const dimIdx = useCallback(
    (key: DimensionKey) => dimensions.findIndex((d) => d.key === key),
    [dimensions],
  );

  const layout = computeLayout(records, width, height, dimensions);
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
      return r.path[ai] === val;
    },
    [hovered],
  );

  const ribbonFill = useCallback((r: Ribbon): string => {
    if (colorBy === "speaker") return speakerColor(r.path[dimIdx("speaker")] as SpeakerGroup);
    if (colorBy === "otRoot") {
      const ri = dimIdx("otRoot");
      if (ri >= 0) return otRootColor(r.path[ri]);
      return datasetColor(r.path[dimIdx("dataset")] as Dataset);
    }
    return datasetColor(r.path[dimIdx("dataset")] as Dataset);
  }, [colorBy, dimIdx]);

  // Resolve a ribbon's path back into the payload shape (dimensions may be absent)
  const payloadFor = useCallback(
    (r: Ribbon): RibbonClickPayload => ({
      key:     r.key,
      otRoot:  dimIdx("otRoot")  >= 0 ? r.path[dimIdx("otRoot")]  : "",
      speaker: r.path[dimIdx("speaker")] as SpeakerGroup,
      section: r.path[dimIdx("section")] as NTSection,
      book:    dimIdx("book")    >= 0 ? r.path[dimIdx("book")]    : "",
      dataset: r.path[dimIdx("dataset")] as Dataset,
      count:   r.count,
    }),
    [dimIdx],
  );

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
            onRibbonClick?.(payloadFor(r));
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
        {axes.map((axisNodes, ai) => {
          const dim = dimensions[ai];
          return (
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

                // Label placement rules:
                //   - First axis (ai=0): label to the LEFT of the bar
                //   - Last axis: label to the RIGHT of the bar
                //   - Book axis (when present and not last): label to the RIGHT
                //   - Other middle axes: label CENTERED inside the bar
                const isFirst    = ai === 0;
                const isLast     = ai === axisCount - 1;
                const isBookAxis = dim.key === "book";

                const labelX =
                  isFirst                       ? colX[0] - 8
                  : isLast                      ? colX[ai] + AXIS_WIDTH + 8
                  : isBookAxis                  ? colX[ai] + AXIS_WIDTH + 8
                  : colX[ai] + AXIS_WIDTH / 2;

                const anchor =
                  isFirst                     ? "end"
                  : (isLast || isBookAxis)    ? "start"
                  : "middle";

                const fontSize = isBookAxis
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
                      fill={dim.color(node.value)}
                      opacity={!hovered ? 0.80 : isAct ? 1 : 0.28}
                      rx={2} className="transition-opacity duration-150"
                    />
                    <g className="pointer-events-none">
                      {/* Callout tick for tiny nodes on left-edge axes */}
                      {isTiny && (isFirst || isBookAxis) && (
                        <line
                          x1={isFirst ? colX[0] - 4 : colX[ai] + AXIS_WIDTH + 4} y1={midY}
                          x2={isFirst ? colX[0] - 7 : colX[ai] + AXIS_WIDTH + 7} y2={labelY + 4}
                          stroke="#94a3b8" strokeWidth={0.75}
                        />
                      )}
                      <text x={labelX} y={labelY} dy="0.35em" textAnchor={anchor}
                        fontSize={fontSize}
                        fontFamily="ui-sans-serif, system-ui, sans-serif"
                        fill={!hovered || isAct ? "#1e293b" : "#94a3b8"}
                        className="transition-all duration-150"
                      >
                        {dim.label(node.value)}
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
          );
        })}

        {/* ── Axis header labels ── */}
        {dimensions.map((dim, i) => (
          <text key={dim.key}
            x={colX[i] + AXIS_WIDTH / 2} y={top - 16}
            textAnchor="middle" fontSize={10} fontWeight={600} letterSpacing={0.8}
            fontFamily="ui-sans-serif, system-ui, sans-serif" fill="#64748b"
            className="pointer-events-none"
          >
            {dim.header}
          </text>
        ))}

        {/* ── Sidebar connector tail ── */}
        {connector && (() => {
          const activeKey = connector.selectedKey;
          if (!activeKey) return null;
          const r = ribbons.find((rb) => rb.key === activeKey);
          if (!r) return null;

          const lastSpan = r.spans[r.spans.length - 1];
          const leftX   = colX[axisCount - 1] + AXIS_WIDTH;
          const leftTop = py(lastSpan[2]);
          const leftBot = py(lastSpan[3]);
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

          return (
            <path
              d={d} fill={ribbonFill(r)} opacity={0.14}
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

          const otRootIdx = dimIdx("otRoot");
          const speaker   = r.path[dimIdx("speaker")];
          const section   = r.path[dimIdx("section")];
          const dataset   = r.path[dimIdx("dataset")] as Dataset;
          const bookVal   = dimIdx("book") >= 0 ? r.path[dimIdx("book")] : "";
          const otRootVal = otRootIdx >= 0 ? r.path[otRootIdx] : "";

          const bookStr   = bookVal ? ` · ${BOOK_ABBREVIATIONS[bookVal] ?? bookVal}` : "";
          const rootStr   = otRootVal ? `${OT_ROOT_ABBREVIATIONS[otRootVal] ?? otRootVal} · ` : "";
          const countStr  = commonlyCitedOnly && r.citedCount > 0
            ? `${r.citedCount} cited / ${r.count} total`
            : `${r.count} record${r.count !== 1 ? "s" : ""}`;

          return (
            <g className="pointer-events-none">
              <rect x={midX - 96} y={midY - 40} width={192} height={68}
                rx={6} fill="white" stroke="#e2e8f0" strokeWidth={1}
                filter="drop-shadow(0 1px 4px rgba(0,0,0,0.10))"
              />
              {otRootVal && (
                <text x={midX} y={midY - 25} textAnchor="middle"
                  fontSize={9} fontWeight={600} letterSpacing={0.5}
                  fontFamily="ui-sans-serif, system-ui, sans-serif" fill="#94a3b8"
                >
                  {rootStr.replace(" · ", "")}
                </text>
              )}
              <text x={midX} y={midY - (otRootVal ? 10 : 16)} textAnchor="middle"
                fontSize={10} fontWeight={600}
                fontFamily="ui-sans-serif, system-ui, sans-serif" fill="#1e293b"
              >
                {speaker}{bookStr}
              </text>
              <text x={midX} y={midY + (otRootVal ? 4 : -2)} textAnchor="middle"
                fontSize={10} fontFamily="ui-sans-serif, system-ui, sans-serif" fill="#64748b"
              >
                {DATASET_LABELS[dataset]} · {String(section).replace(" Epistles", " Ep.")}
              </text>
              <text x={midX} y={midY + (otRootVal ? 19 : 13)} textAnchor="middle"
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
