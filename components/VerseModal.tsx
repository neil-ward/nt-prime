"use client";

/**
 * VerseModal — overlay that shows the full text of a Bible verse.
 *
 * Fetches from /api/verse via the useVerseText hook.
 * Dismissible via Esc, click-outside, or the × button.
 * Includes copyright attribution and a "Read in YouVersion" deep link.
 */

import { useEffect, useRef } from "react";
import { useVerseText } from "@/lib/useVerseText";
import { makeYouVersionUrl } from "@/lib/youversion";
import { refToFullBook } from "@/lib/youversion";

interface VerseModalProps {
  ref_: string;          // app-style ref, e.g. "Matt 5:42"
  onClose: () => void;
}

/**
 * Parse an app-ref like "Matt 5:42" or "1 Cor 13:4-7" into
 * { book, chapter, verseRange } for the deep-link builder.
 */
function parseRef(ref: string): { book: string; chapter: string; verseRange: string } | null {
  const fullBook = refToFullBook(ref);
  if (!fullBook) return null;

  // Find the chapter:verse part by looking for the pattern "N:N" at the end
  const match = ref.match(/(\d+):(.+)$/);
  if (!match) return null;

  return { book: fullBook, chapter: match[1], verseRange: match[2] };
}

export default function VerseModal({ ref_, onClose }: VerseModalProps) {
  const { text, loading, error, copyright } = useVerseText(ref_);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on click-outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  // Build YouVersion link
  const parsed = parseRef(ref_);
  const yvUrl = parsed
    ? makeYouVersionUrl(parsed.book, parsed.chapter, parsed.verseRange)
    : null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden animate-[slideUp_200ms_ease-out]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-stone-200">
          <h3 className="text-[15px] font-serif font-semibold text-stone-900">
            {ref_}
          </h3>
          <button
            onClick={onClose}
            className="text-stone-300 hover:text-stone-600 transition-colors text-lg leading-none -mt-1"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[120px]">
          {loading && (
            <p className="text-stone-400 text-sm font-serif italic animate-pulse">
              Loading verse text&hellip;
            </p>
          )}

          {error && (
            <div className="space-y-2">
              <p className="text-stone-400 text-sm">
                Verse text is not available right now.
              </p>
              <p className="text-[10px] text-stone-300">{error}</p>
            </div>
          )}

          {text && (
            <blockquote className="text-[15px] font-serif text-stone-700 leading-relaxed italic">
              &ldquo;{text}&rdquo;
            </blockquote>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-5 pt-1">
          <div className="text-[10px] text-stone-400 max-w-[70%]">
            {copyright && <span>{copyright}</span>}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {yvUrl && (
              <a
                href={yvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-medium text-stone-500 hover:text-stone-700 transition-colors underline underline-offset-2"
              >
                Read in YouVersion &rarr;
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
  );
}
