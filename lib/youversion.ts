// ---------------------------------------------------------------------------
// YouVersion / Bible.com utilities
//
// Deep link format:
//   https://www.bible.com/bible/{versionId}/{USFM_BOOK}.{chapter}.{startVerse}
//
// Platform API format (server-side):
//   https://api.youversion.com/v1/bibles/{versionId}/passages/{USFM}
//
// Both systems use the same version IDs, so we keep one unified map.
// ---------------------------------------------------------------------------

import { BOOK_ABBREVIATIONS } from "@/lib/constants";

/** USFM book codes keyed by full English book name as it appears in nt_data.json */
export const BOOK_TO_USFM: Record<string, string> = {
  Matthew:           "MAT",
  Mark:              "MRK",
  Luke:              "LUK",
  John:              "JHN",
  Acts:              "ACT",
  Romans:            "ROM",
  "1 Corinthians":   "1CO",
  "2 Corinthians":   "2CO",
  Galatians:         "GAL",
  Ephesians:         "EPH",
  Philippians:       "PHP",
  Colossians:        "COL",
  "1 Thessalonians": "1TH",
  "2 Thessalonians": "2TH",
  "1 Timothy":       "1TI",
  "2 Timothy":       "2TI",
  Titus:             "TIT",
  Philemon:          "PHM",
  Hebrews:           "HEB",
  James:             "JAS",
  "1 Peter":         "1PE",
  "2 Peter":         "2PE",
  "1 John":          "1JN",
  "2 John":          "2JN",
  "3 John":          "3JN",
  Jude:              "JUD",
  Revelation:        "REV",
};

// ---------------------------------------------------------------------------
// Supported translations — each ID works for BOTH the Platform API
// (api.youversion.com) AND bible.com deep links.
// ESV is intentionally NOT included: it isn't available via the Platform API
// (Crossway licensing), and we want the deep link and modal text to match.
// ---------------------------------------------------------------------------

export interface VersionSpec {
  id:        number;
  label:     string;
  copyright: string;
}

export const VERSIONS: Record<string, VersionSpec> = {
  NIV: {
    id: 111,
    label: "New International Version",
    copyright:
      "Scripture quotations taken from the Holy Bible, New International Version®, NIV®. Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.™",
  },
  NASB2020: {
    id: 2692,
    label: "New American Standard Bible 2020",
    copyright:
      "Scripture quotations taken from the (NASB®) New American Standard Bible®, Copyright © 2020 by The Lockman Foundation. Used by permission.",
  },
  NASB1995: {
    id: 100,
    label: "New American Standard Bible 1995",
    copyright:
      "Scripture quotations taken from the New American Standard Bible® (NASB), Copyright © 1960, 1971, 1977, 1995 by The Lockman Foundation. Used by permission.",
  },
  BSB: {
    id: 3034,
    label: "Berean Standard Bible",
    copyright: "The Holy Bible, Berean Standard Bible, BSB. Public domain.",
  },
  AMP: {
    id: 1588,
    label: "Amplified Bible",
    copyright:
      "Scripture quotations taken from the Amplified® Bible (AMP), Copyright © 2015 by The Lockman Foundation. Used by permission.",
  },
  ASV: {
    id: 12,
    label: "American Standard Version",
    copyright: "American Standard Version. Public domain.",
  },
  LSV: {
    id: 2660,
    label: "Literal Standard Version",
    copyright:
      "Scripture quotations taken from the Literal Standard Version (LSV). Copyright © 2020 Covenant Press.",
  },
};

export type VersionKey = keyof typeof VERSIONS;

/** Default translation when the user hasn't chosen one. */
export const DEFAULT_VERSION: VersionKey = "NIV";

/**
 * Greek New Testament — modern critical text.
 * Served via the same Platform API; no separate licensing needed.
 * ID 3428 = "The Text-Critical English New Testament" (grcTCGNT)
 *   actually resolves to the Greek text at this ID in the API catalogue.
 */
export const GREEK_BIBLE_ID = 3428;
export const GREEK_LABEL    = "Text-Critical Greek New Testament";

// ---------------------------------------------------------------------------
// Preferred version helpers — client-side localStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = "nt_prime_version";

/**
 * Read the user's preferred version. Falls back to NIV on the server or
 * when localStorage is unavailable / empty / invalid.
 */
export function getPreferredVersion(): VersionKey {
  if (typeof window === "undefined") return DEFAULT_VERSION;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in VERSIONS) return stored as VersionKey;
  } catch {
    /* swallow */
  }
  return DEFAULT_VERSION;
}

/** Persist the user's version choice. */
export function setPreferredVersion(v: VersionKey): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch {
    /* swallow */
  }
}

// ---------------------------------------------------------------------------
// Deep-link URL builder
// ---------------------------------------------------------------------------

/**
 * Build a YouVersion deep-link URL using the user's currently preferred
 * version (or a passed override).
 */
export function makeYouVersionUrl(
  book: string,
  chapter: string | number,
  verseRange: string,
  version?: VersionKey,
): string | null {
  const usfm = BOOK_TO_USFM[book];
  if (!usfm) return null;

  const startVerse = String(verseRange).split("-")[0].trim();
  const ver        = version ?? getPreferredVersion();
  const versionId  = VERSIONS[ver].id;

  return `https://www.bible.com/bible/${versionId}/${usfm}.${chapter}.${startVerse}`;
}

// ---------------------------------------------------------------------------
// Ref parsing
// ---------------------------------------------------------------------------

const ABBREV_TO_FULL: Record<string, string> = {};
for (const [full, abbr] of Object.entries(BOOK_ABBREVIATIONS)) {
  ABBREV_TO_FULL[abbr] = full;
}

const SORTED_ABBREVS = Object.keys(ABBREV_TO_FULL).sort(
  (a, b) => b.length - a.length,
);

/**
 * Convert an app-style ref (e.g. "Matt 5:42", "1 Cor 13:4-7") to a
 * USFM identifier (e.g. "MAT.5.42", "1CO.13.4-7").
 */
export function refToUSFM(ref: string): string | null {
  const parsed = parseRef(ref);
  if (!parsed) return null;
  return `${parsed.usfmBook}.${parsed.chapter}.${parsed.verseRange}`;
}

/** Extract the full book name from a ref. */
export function refToFullBook(ref: string): string | null {
  const parsed = parseRef(ref);
  return parsed?.fullBook ?? null;
}

/** Parse a ref into its structural parts. Useful for building ranges. */
export interface ParsedRef {
  fullBook:   string;   // "Matthew"
  usfmBook:   string;   // "MAT"
  chapter:    number;
  verseStart: number;
  verseEnd:   number;
  verseRange: string;   // "42" or "4-7"
}

export function parseRef(ref: string): ParsedRef | null {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  let bookAbbr: string | null = null;
  let rest = "";
  for (const abbr of SORTED_ABBREVS) {
    if (
      trimmed.startsWith(abbr) &&
      trimmed.length > abbr.length &&
      trimmed[abbr.length] === " "
    ) {
      bookAbbr = abbr;
      rest = trimmed.slice(abbr.length + 1).trim();
      break;
    }
  }
  if (!bookAbbr || !rest) return null;

  const fullBook = ABBREV_TO_FULL[bookAbbr];
  if (!fullBook) return null;

  const usfmBook = BOOK_TO_USFM[fullBook];
  if (!usfmBook) return null;

  const colonIdx = rest.indexOf(":");
  if (colonIdx === -1) return null;

  const chapter = parseInt(rest.slice(0, colonIdx), 10);
  const verseRange = rest.slice(colonIdx + 1).trim();
  if (!chapter || !verseRange) return null;

  const [startStr, endStr] = verseRange.split("-");
  const verseStart = parseInt(startStr, 10);
  const verseEnd   = endStr ? parseInt(endStr, 10) : verseStart;
  if (!verseStart) return null;

  return { fullBook, usfmBook, chapter, verseStart, verseEnd, verseRange };
}
