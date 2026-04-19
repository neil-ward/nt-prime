"use client";

// ---------------------------------------------------------------------------
// VerseModal — overlay showing a Bible passage with optional OT antecedent.
//
// Layout:
//   Header:  passage reference | version selector | close
//   Body:    [ OT pane (left, if antecedent present) | NT verses + Greek ]
//   Footer:  copyright + attributions + "Read in YouVersion"
//
// Dismissible via: Esc, click-outside, × button.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef } from "react";
import { useVerseText } from "@/lib/useVerseText";
import {
  makeYouVersionUrl,
  VERSIONS,
  parseRef,
  splitOTAntecedent,
  type VersionKey,
} from "@/lib/youversion";

interface VerseModalProps {
  ref_:            string;
  otAntecedent:    string | null;
  version:         VersionKey;
  onVersionChange: (v: VersionKey) => void;
  onClose:         () => void;
}

// Highlight color — reuse the site's "cited" amber palette for consistency.
const HIGHLIGHT_BG     = "#fef3c7"; // amber-100
const HIGHLIGHT_BORDER = "#d97706"; // amber-600

export default function VerseModal({
  ref_,
  otAntecedent,
  version,
  onVersionChange,
  onClose,
}: VerseModalProps) {
  const { passage, loading, error } = useVerseText(ref_, version);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Esc to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  // Parse OT antecedent once per render
  const otRefs = useMemo(() => splitOTAntecedent(otAntecedent), [otAntecedent]);
  const showOT = otRefs.length > 0;

  // Build YouVersion deep link for the selected verse(s)
  const parsed = parseRef(ref_);
  const yvUrl  = parsed
    ? makeYouVersionUrl(parsed.fullBook, parsed.chapter, parsed.verseRange, version)
    : null;

  const hasGreek  = (passage?.verses ?? []).some((v) => v.greek);
  const headerRef = passage?.reference ?? ref_;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-[fadeIn_150ms_ease-out] p-4"
    >
      <div
        className={`bg-white rounded-lg shadow-xl w-full max-h-[88vh] flex flex-col overflow-hidden animate-[slideUp_200ms_ease-out] ${
          showOT ? "max-w-6xl" : "max-w-3xl"
        }`}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex-none flex items-center gap-3 px-6 pt-5 pb-3 border-b border-stone-200">
          <h3 className="flex-1 text-[15px] font-serif font-semibold text-stone-900 leading-tight min-w-0 truncate">
            {headerRef}
          </h3>

          <select
            value={version}
            onChange={(e) => onVersionChange(e.target.value as VersionKey)}
            className="text-[11px] font-semibold text-stone-600 bg-stone-50 border border-stone-200 rounded px-2 py-1 hover:border-stone-300 focus:outline-none focus:border-stone-400 transition-colors cursor-pointer"
            title="Bible translation"
          >
            {Object.entries(VERSIONS).map(([key, spec]) => (
              <option key={key} value={key}>
                {key} — {spec.label}
              </option>
            ))}
          </select>

          <button
            onClick={onClose}
            className="text-stone-300 hover:text-stone-600 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* OT antecedent pane (left) */}
          {showOT && (
            <aside className="md:w-[36%] md:max-w-sm md:shrink-0 md:border-r border-stone-200 bg-stone-50/40 overflow-y-auto px-5 py-4">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-stone-400 mb-3">
                OT Antecedent
              </p>
              <div className="space-y-4">
                {otRefs.map((r, i) => (
                  <OTBlock key={`${r.raw}-${i}`} raw={r.raw} parsedRef={r.parsed} version={version} />
                ))}
              </div>
            </aside>
          )}

          {/* NT passage pane (main) */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading && (
              <p className="text-stone-400 text-sm font-serif italic animate-pulse">
                Loading passage&hellip;
              </p>
            )}

            {error && (
              <div className="space-y-2">
                <p className="text-stone-500 text-sm">Could not load verse text.</p>
                <p className="text-[10px] text-stone-400">{error}</p>
              </div>
            )}

            {passage && (
              <div>
                {hasGreek && (
                  <div className="flex items-baseline gap-3 mb-2 text-[9px] font-semibold uppercase tracking-widest text-stone-400">
                    <span className="w-6 text-right select-none">&nbsp;</span>
                    <span className="flex-1">{passage.version} · English</span>
                    <span className="flex-1">Koine Greek</span>
                  </div>
                )}

                <ul className="divide-y divide-stone-100">
                  {passage.verses.map((v) => {
                    const selected = v.num >= passage.selectedStart && v.num <= passage.selectedEnd;
                    return (
                      <li
                        key={v.num}
                        className="flex items-baseline gap-3 py-2 transition-colors"
                        style={
                          selected
                            ? {
                                backgroundColor: HIGHLIGHT_BG,
                                borderLeft: `3px solid ${HIGHLIGHT_BORDER}`,
                                paddingLeft: "9px",
                                marginLeft: "-12px",
                                paddingRight: "8px",
                                borderRadius: "2px",
                              }
                            : {}
                        }
                      >
                        <span className={`w-6 text-right shrink-0 text-[10px] tabular-nums select-none ${selected ? "text-amber-700 font-bold" : "text-stone-400 font-semibold"}`}>
                          {v.num}
                        </span>
                        <span className={`flex-1 text-[13px] leading-relaxed ${selected ? "text-stone-900" : "text-stone-600"}`}>
                          {v.english ?? <span className="text-stone-300 italic">(not available)</span>}
                        </span>
                        {hasGreek && (
                          <span
                            className={`flex-1 text-[13px] leading-relaxed font-serif ${selected ? "text-stone-900" : "text-stone-600"}`}
                            lang="grc"
                          >
                            {v.greek ?? <span className="text-stone-300 italic">—</span>}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="flex-none border-t border-stone-200 bg-stone-50/60 px-6 py-3">
          {passage && (
            <div className="space-y-1">
              <p className="text-[9px] text-stone-400 leading-snug">{passage.copyright}</p>
              {hasGreek && (
                <p className="text-[9px] text-stone-400 leading-snug">{passage.greekAttribution}</p>
              )}
            </div>
          )}
          <div className="flex items-center justify-between mt-2 gap-3">
            <span className="text-[10px] text-stone-400">
              <kbd className="font-mono bg-white border border-stone-200 px-1 rounded text-[9px]">Esc</kbd> to close
            </span>
            <div className="flex items-center gap-3 shrink-0">
              {yvUrl && (
                <a
                  href={yvUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-stone-500 hover:text-stone-800 transition-colors underline underline-offset-2"
                >
                  Read {version} in YouVersion &rarr;
                </a>
              )}
              <button
                onClick={onClose}
                className="text-[11px] font-medium text-stone-400 hover:text-stone-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OTBlock — one OT antecedent entry inside the left pane.
//
// For each parsed OT ref we fetch through /api/verse (which always returns
// ±4 verses of context) and then trim the rendered list down to just the
// originally-selected verses — OT antecedents read best without the extra
// surrounding verses. Unparseable refs show the raw label only.
// ---------------------------------------------------------------------------

function OTBlock({
  raw,
  parsedRef,
  version,
}: {
  raw:       string;
  parsedRef: ReturnType<typeof parseRef>;
  version:   VersionKey;
}) {
  const fetchRef = parsedRef
    ? `${parsedRef.fullBook} ${parsedRef.chapter}:${parsedRef.verseRange}`
    : null;

  const { passage, loading, error } = useVerseText(fetchRef, version);

  if (!parsedRef) {
    // Unparseable — show the raw label only
    return (
      <div>
        <p className="text-[11px] font-serif font-semibold text-stone-700 mb-0.5">{raw}</p>
        <p className="text-[10px] text-stone-300 italic">(unable to parse reference)</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[11px] font-serif font-semibold text-stone-800 mb-1.5">
        {passage?.reference ?? raw}
      </p>
      {loading && (
        <p className="text-[10px] text-stone-400 italic animate-pulse">Loading…</p>
      )}
      {error && (
        <p className="text-[10px] text-stone-400 italic">{error}</p>
      )}
      {passage && (
        <ul className="space-y-1">
          {passage.verses
            // Trim to just the originally-selected verses — we asked the hook
            // for default context, but OT antecedents read best without extra.
            .filter((v) => v.num >= passage.selectedStart && v.num <= passage.selectedEnd)
            .map((v) => (
              <li key={v.num} className="flex items-baseline gap-2">
                <span className="w-5 text-right shrink-0 text-[9px] text-stone-400 tabular-nums select-none font-semibold">
                  {v.num}
                </span>
                <span className="flex-1 text-[12px] leading-relaxed text-stone-700">
                  {v.english ?? <span className="text-stone-300 italic">—</span>}
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
