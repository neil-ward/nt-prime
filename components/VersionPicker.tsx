"use client";

// ---------------------------------------------------------------------------
// VersionPicker — user-facing Bible translation selector.
//
// Renders a row of pills; the active pill is filled. Clicking a pill updates
// the version stored in VerseProvider (which persists it to localStorage).
// The chosen version is used for:
//   - Verse text fetched in the VerseModal
//   - ↗ deep links to bible.com across the app
// ---------------------------------------------------------------------------

import { useVerse } from "@/components/VerseProvider";
import { VERSIONS, type VersionKey } from "@/lib/youversion";

export default function VersionPicker() {
  const { version, setVersion } = useVerse();

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(VERSIONS) as VersionKey[]).map((v) => {
          const active = v === version;
          return (
            <button
              key={v}
              onClick={() => setVersion(v)}
              className={`px-3 py-1.5 rounded text-[11px] font-semibold border transition-all duration-150 ${
                active
                  ? "bg-stone-900 text-white border-stone-900"
                  : "bg-white text-stone-500 border-stone-200 hover:text-stone-800 hover:border-stone-300"
              }`}
              title={VERSIONS[v].label}
            >
              <span className="font-bold">{v}</span>
              <span className={`font-normal ml-1.5 ${active ? "opacity-80" : "text-stone-400"}`}>
                {VERSIONS[v].label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-stone-400 mt-3 max-w-xl leading-relaxed">
        Used everywhere verse text appears in the app, including the{" "}
        <span className="font-medium text-stone-500">↗</span> YouVersion deep
        links. Change anytime — your choice is saved in your browser.
      </p>
    </div>
  );
}
