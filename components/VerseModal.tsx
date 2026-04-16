"use client";

// ---------------------------------------------------------------------------
// VerseModal — overlay showing a Bible passage with surrounding context.
//
// Layout:
//   Header:  passage reference | version selector | close
//   Body:    table of verses — num | English | Greek, selected row highlighted
//   Footer:  copyright + Greek attribution + "Read in YouVersion" link
//
// Dismissible via: Esc, click-outside, × button.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import { useVerseText } from "@/lib/useVerseText";
import {
  makeYouVersionUrl,
  VERSIONS,
  type VersionKey,
  BOOK_TO_USFM,
  parseRef,
} from "@/lib/youversion";

interface VerseModalProps {
  ref_:            string;
  version:         VersionKey;
  onVersionChange: (v: VersionKey) => void;
  onClose:         () => void;
}

// Highlight color — reuse the site's "cited" amber palette for consistency.
const HIGHLIGHT_BG     = "#fef3c7"; // amber-100
const HIGHLIGHT_BORDER = "#d97706"; // amber-600

export default function VerseModal({
  ref_,
  version,
  onVersionChange,
  onClose,
}: VerseModalProps) {
  const { passage, loading, error } = useVerseText(ref_, version);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Esc to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  // Build YouVersion deep link for the selected verse(s)
  const parsed = parseRef(ref_);
  const yvUrl = parsed
    ? makeYouVersionUrl(parsed.fullBook, parsed.chapter, parsed.verseRange, version)
    : null;

  // Whether any Greek text exists in the passage
  const hasGreek = (passage?.verses ?? []).some((v) => v.greek);

  // Header reference — prefer server-computed string once loaded
  const headerRef = passage?.reference ?? ref_;

  // Is Greek-worthy Bible book (NT only — but we already restrict to NT)
  void BOOK_TO_USFM;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-[fadeIn_150ms_ease-out] p-4"
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-[slideUp_200ms_ease-out]"
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex-none flex items-center gap-3 px-6 pt-5 pb-3 border-b border-stone-200">
          <h3 className="flex-1 text-[15px] font-serif font-semibold text-stone-900 leading-tight min-w-0 truncate">
            {headerRef}
          </h3>

          {/* Version selector */}
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
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <p className="text-stone-400 text-sm font-serif italic animate-pulse">
              Loading passage&hellip;
            </p>
          )}

          {error && (
            <div className="space-y-2">
              <p className="text-stone-500 text-sm">
                Could not load verse text.
              </p>
              <p className="text-[10px] text-stone-400">{error}</p>
            </div>
          )}

          {passage && (
            <div>
              {/* Column headers (only show if Greek is available) */}
              {hasGreek && (
                <div className="flex items-baseline gap-3 mb-2 text-[9px] font-semibold uppercase tracking-widest text-stone-400">
                  <span className="w-6 text-right select-none">&nbsp;</span>
                  <span className="flex-1">{passage.version} · English</span>
                  <span className="flex-1">Koine Greek</span>
                </div>
              )}

              {/* Verses */}
              <ul className="divide-y divide-stone-100">
                {passage.verses.map((v) => {
                  const selected =
                    v.num >= passage.selectedStart &&
                    v.num <= passage.selectedEnd;

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
                      <span
                        className={`w-6 text-right shrink-0 text-[10px] tabular-nums select-none ${
                          selected
                            ? "text-amber-700 font-bold"
                            : "text-stone-400 font-semibold"
                        }`}
                      >
                        {v.num}
                      </span>

                      {/* English */}
                      <span
                        className={`flex-1 text-[13px] leading-relaxed ${
                          selected ? "text-stone-900" : "text-stone-600"
                        }`}
                      >
                        {v.english ?? (
                          <span className="text-stone-300 italic">
                            (not available)
                          </span>
                        )}
                      </span>

                      {/* Greek */}
                      {hasGreek && (
                        <span
                          className={`flex-1 text-[13px] leading-relaxed font-serif ${
                            selected ? "text-stone-900" : "text-stone-600"
                          }`}
                          lang="grc"
                        >
                          {v.greek ?? (
                            <span className="text-stone-300 italic">—</span>
                          )}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="flex-none border-t border-stone-200 bg-stone-50/60 px-6 py-3">
          {passage && (
            <div className="space-y-1">
              <p className="text-[9px] text-stone-400 leading-snug">
                {passage.copyright}
              </p>
              {hasGreek && (
                <p className="text-[9px] text-stone-400 leading-snug">
                  {passage.greekAttribution}
                </p>
              )}
            </div>
          )}
          <div className="flex items-center justify-between mt-2 gap-3">
            <span className="text-[10px] text-stone-400">
              <kbd className="font-mono bg-white border border-stone-200 px-1 rounded text-[9px]">
                Esc
              </kbd>{" "}
              to close
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
