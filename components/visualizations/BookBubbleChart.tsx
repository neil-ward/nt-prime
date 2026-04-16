"use client";

/**
 * BookBubbleChart — Gapminder-style animated bubble chart.
 *
 * Each bubble = one NT book (27 books).
 * X axis = proportion of Dataset A (Mercy & Justice) in the current frame.
 * Y axis = proportion of Dataset D (Social Codes) in the current frame.
 * Bubble size ∝ √(command count in frame).
 * Color = NT section.
 *
 * A "frame" is a speaker filter: All | Jesus | Paul | Peter | John |
 * James | Hebrews.  PLAY cycles through them with smooth D3 transitions,
 * revealing how different voices weight mercy vs. social-code commands
 * across books.  When switching to the Jesus frame, the Pauline corpus
 * mostly vanishes; in Paul's frame, 1 Corinthians and Ephesians dominate.
 */

import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import type { NTRecord, NTSection } from "@/lib/types";
import {
  BOOK_ORDER,
  BOOK_ABBREVIATIONS,
  BOOK_TO_SECTION,
  NT_SECTION_COLORS,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Frame definitions
// ---------------------------------------------------------------------------

const FRAMES = ["All", "Jesus", "Paul", "Peter", "John", "James", "Hebrews"] as const;
type Frame = (typeof FRAMES)[number];

const FRAME_COLORS: Record<Frame, string> = {
  All:     "#44403c",
  Jesus:   "#7c3aed",
  Paul:    "#0369a1",
  Peter:   "#047857",
  John:    "#b45309",
  James:   "#be185d",
  Hebrews: "#6b7280",
};

// ---------------------------------------------------------------------------
// Per-book datum
// ---------------------------------------------------------------------------

interface BookDatum {
  book:    string;
  abbr:    string;
  section: NTSection;
  count:   number;  // records matching current frame filter in this book
  pctA:    number;  // proportion of those that are Dataset A
  pctD:    number;  // proportion of those that are Dataset D
  // pctB = 1 - pctA - pctD
}

function computeFrameData(records: NTRecord[], frame: Frame): BookDatum[] {
  const filtered =
    frame === "All"
      ? records
      : records.filter((r) => r.speaker_group === frame);

  return BOOK_ORDER.map((book) => {
    const recs  = filtered.filter((r) => r.book === book);
    const count = recs.length;
    const pctA  = count > 0 ? recs.filter((r) => r.dataset === "A").length / count : 0;
    const pctD  = count > 0 ? recs.filter((r) => r.dataset === "D").length / count : 0;
    return {
      book,
      abbr:    BOOK_ABBREVIATIONS[book] ?? book,
      section: BOOK_TO_SECTION[book] as NTSection,
      count,
      pctA,
      pctD,
    };
  });
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const MARGIN        = { top: 20, right: 28, bottom: 52, left: 54 };
const HEIGHT        = 440;
const TRANSITION_MS = 820;
const PLAY_INTERVAL = TRANSITION_MS + 900;
const LABEL_MIN_R   = 13;  // minimum bubble radius to show book abbreviation

const NT_SECTIONS: NTSection[] = [
  "Gospels", "Acts", "Pauline Epistles", "General Epistles", "Revelation",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props { records: NTRecord[] }

export default function BookBubbleChart({ records }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const [width,    setWidth]    = useState(720);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing,  setPlaying]  = useState(false);
  const [hovered,  setHovered]  = useState<string | null>(null);

  // Responsive width
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      if (e.contentRect.width > 0) setWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const frame  = FRAMES[frameIdx];
  const innerW = width  - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top  - MARGIN.bottom;

  // Pre-compute data for every frame so switching is instant
  const allFrameData = useMemo(
    () => FRAMES.map((f) => computeFrameData(records, f)),
    [records],
  );
  const frameData = allFrameData[frameIdx];

  // Scales — xScale/yScale are fixed [0,1] domains; rScale domain anchored to "All"
  const maxCountAll = useMemo(
    () => d3.max(allFrameData[0], (d) => d.count) ?? 1,
    [allFrameData],
  );
  const xScale = useMemo(
    () => d3.scaleLinear().domain([0, 1]).range([0, innerW]),
    [innerW],
  );
  const yScale = useMemo(
    () => d3.scaleLinear().domain([0, 1]).range([innerH, 0]),
    [innerH],
  );
  const rScale = useMemo(
    () => d3.scaleSqrt().domain([0, maxCountAll]).range([0, Math.min(48, innerW / 10)]),
    [maxCountAll, innerW],
  );

  // ---------------------------------------------------------------------------
  // D3 imperative update — transitions circles & labels on frame / size change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!svgRef.current || !frameData.length) return;

    const layer = d3.select(svgRef.current).select<SVGGElement>("g.bubble-layer");

    // ── Circles ──────────────────────────────────────────────────────────────

    const circles = layer
      .selectAll<SVGCircleElement, BookDatum>("circle.bubble")
      .data(frameData, (d) => d.book);

    // Enter: place new circles at their target position but r=0
    const entering = circles
      .enter()
      .append("circle")
      .attr("class", "bubble")
      .attr("cx", (d) => xScale(d.pctA))
      .attr("cy", (d) => yScale(d.pctD))
      .attr("r", 0)
      .attr("fill", (d) => NT_SECTION_COLORS[d.section])
      .attr("fill-opacity", 0)
      .attr("stroke", "white")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0)
      .style("cursor", "pointer")
      .on("mouseenter", (event: MouseEvent, d: BookDatum) => {
        setHovered(d.book);
        // Bring hovered bubble to front within the circles sub-layer
        const target = event.currentTarget as SVGCircleElement;
        target.parentNode?.appendChild(target);
      })
      .on("mouseleave", () => setHovered(null));

    // Enter + Update
    entering.merge(circles)
      .transition()
      .duration(TRANSITION_MS)
      .ease(d3.easeCubicInOut)
      .attr("cx", (d) => xScale(d.pctA))
      .attr("cy", (d) => yScale(d.pctD))
      .attr("r",  (d) => rScale(d.count))
      .attr("fill-opacity",   (d) => (d.count > 0 ? 0.70 : 0))
      .attr("stroke-opacity", (d) => (d.count > 0 ? 1    : 0));

    // Exit (shouldn't fire since data always has all 27 books, but safety net)
    circles.exit()
      .transition()
      .duration(TRANSITION_MS)
      .attr("r", 0)
      .attr("fill-opacity", 0)
      .remove();

    // ── Labels ───────────────────────────────────────────────────────────────

    const labelData = frameData.filter((d) => rScale(d.count) >= LABEL_MIN_R);

    const labels = layer
      .selectAll<SVGTextElement, BookDatum>("text.bubble-label")
      .data(labelData, (d) => d.book);

    labels
      .enter()
      .append("text")
      .attr("class", "bubble-label")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", 9)
      .attr("font-weight", "600")
      .attr("font-family", "ui-sans-serif,system-ui,sans-serif")
      .attr("fill", "white")
      .attr("opacity", 0)
      .attr("x", (d) => xScale(d.pctA))
      .attr("y", (d) => yScale(d.pctD))
      .text((d) => d.abbr)
      .transition()
      .duration(TRANSITION_MS)
      .attr("opacity", 0.92);

    labels
      .transition()
      .duration(TRANSITION_MS)
      .ease(d3.easeCubicInOut)
      .attr("x", (d) => xScale(d.pctA))
      .attr("y", (d) => yScale(d.pctD))
      .attr("opacity", 0.92)
      .text((d) => d.abbr);

    labels.exit()
      .transition()
      .duration(300)
      .attr("opacity", 0)
      .remove();

  }, [frameData, xScale, yScale, rScale]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Auto-play
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setFrameIdx((p) => (p + 1) % FRAMES.length);
      }, PLAY_INTERVAL);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing]);

  // ---------------------------------------------------------------------------
  // Derived for rendering
  // ---------------------------------------------------------------------------
  const hoveredDatum = useMemo(
    () => frameData.find((d) => d.book === hovered) ?? null,
    [frameData, hovered],
  );
  const xTicks = useMemo(() => xScale.ticks(5), [xScale]);
  const yTicks = useMemo(() => yScale.ticks(5), [yScale]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div ref={containerRef} className="w-full">

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 flex-wrap mb-3"
        style={{ paddingLeft: MARGIN.left }}
      >
        <button
          onClick={() => setPlaying((p) => !p)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-semibold border transition-all ${
            playing
              ? "bg-stone-800 text-white border-stone-800"
              : "bg-white text-stone-600 border-stone-300 hover:border-stone-400"
          }`}
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>

        <div className="flex items-center gap-1 flex-wrap">
          {FRAMES.map((f, i) => (
            <button
              key={f}
              onClick={() => { setFrameIdx(i); setPlaying(false); }}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${
                i === frameIdx
                  ? "text-white border-transparent"
                  : "bg-white border-stone-200 text-stone-400 hover:text-stone-700 hover:border-stone-300"
              }`}
              style={i === frameIdx ? { backgroundColor: FRAME_COLORS[f] } : {}}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── SVG ──────────────────────────────────────────────────────────── */}
      <svg
        ref={svgRef}
        width={width}
        height={HEIGHT}
        className="overflow-visible select-none"
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>

          {/* Grid lines */}
          {xTicks.map((v) => (
            <line
              key={`xg${v}`}
              x1={xScale(v)} x2={xScale(v)} y1={0} y2={innerH}
              stroke="#ede9e6" strokeWidth={1}
            />
          ))}
          {yTicks.map((v) => (
            <line
              key={`yg${v}`}
              x1={0} x2={innerW} y1={yScale(v)} y2={yScale(v)}
              stroke="#ede9e6" strokeWidth={1}
            />
          ))}

          {/* Frame watermark */}
          <text
            x={innerW - 6}
            y={innerH - 4}
            textAnchor="end"
            fontSize={56}
            fontWeight={700}
            fontFamily="ui-serif,serif"
            fill="#f0ece8"
            style={{ userSelect: "none", pointerEvents: "none" }}
          >
            {frame}
          </text>

          {/* D3-managed bubble + label layer */}
          <g className="bubble-layer" />

          {/* X axis */}
          <g transform={`translate(0,${innerH})`}>
            <line x1={0} x2={innerW} stroke="#d6d3d1" />
            {xTicks.map((v) => (
              <g key={`xt${v}`} transform={`translate(${xScale(v)},0)`}>
                <line y2={4} stroke="#d6d3d1" />
                <text
                  y={15} textAnchor="middle" fontSize={9.5}
                  fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#a8a29e"
                >
                  {Math.round(v * 100)}%
                </text>
              </g>
            ))}
            <text
              x={innerW / 2} y={42}
              textAnchor="middle" fontSize={10.5} fontWeight={600}
              fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#78716c"
            >
              Dataset A proportion — Mercy &amp; Justice →
            </text>
          </g>

          {/* Y axis */}
          <g>
            <line x1={0} x2={0} y1={0} y2={innerH} stroke="#d6d3d1" />
            {yTicks.map((v) => (
              <g key={`yt${v}`} transform={`translate(0,${yScale(v)})`}>
                <line x2={-4} stroke="#d6d3d1" />
                <text
                  x={-9} textAnchor="end" dy="0.35em" fontSize={9.5}
                  fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#a8a29e"
                >
                  {Math.round(v * 100)}%
                </text>
              </g>
            ))}
            <text
              transform={`translate(${-42},${innerH / 2}) rotate(-90)`}
              textAnchor="middle" fontSize={10.5} fontWeight={600}
              fontFamily="ui-sans-serif,system-ui,sans-serif" fill="#78716c"
            >
              Dataset D proportion — Social Codes →
            </text>
          </g>

        </g>
      </svg>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2"
        style={{ paddingLeft: MARGIN.left }}
      >
        {NT_SECTIONS.map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
              style={{ backgroundColor: NT_SECTION_COLORS[s] }}
            />
            <span className="text-[10px] text-stone-500">{s}</span>
          </div>
        ))}
        <span className="text-[10px] text-stone-400 ml-3">
          Bubble size = commands in frame · hover for detail
        </span>
      </div>

      {/* ── Hover tooltip ────────────────────────────────────────────────── */}
      {hoveredDatum && hoveredDatum.count > 0 && (
        <div
          className="mt-3 px-4 py-3 bg-white rounded border border-stone-200 inline-block"
          style={{ marginLeft: MARGIN.left }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: NT_SECTION_COLORS[hoveredDatum.section] }}
            />
            <span className="font-serif font-semibold text-stone-800 text-[13px]">
              {hoveredDatum.book}
            </span>
            <span className="text-[10px] text-stone-400 ml-1">
              {hoveredDatum.section}
            </span>
          </div>
          <div className="flex gap-4 text-[11px] mt-0.5">
            <span className="text-stone-500">
              {hoveredDatum.count} command{hoveredDatum.count !== 1 ? "s" : ""} in frame
            </span>
            <span style={{ color: "#2a9d8f" }}>
              A {Math.round(hoveredDatum.pctA * 100)}%
            </span>
            <span style={{ color: "#457b9d" }}>
              B {Math.round((1 - hoveredDatum.pctA - hoveredDatum.pctD) * 100)}%
            </span>
            <span style={{ color: "#e76f51" }}>
              D {Math.round(hoveredDatum.pctD * 100)}%
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
