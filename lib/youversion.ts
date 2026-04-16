// ---------------------------------------------------------------------------
// YouVersion / Bible.com deep-link utilities
//
// Deep link format:
//   https://www.bible.com/bible/{versionId}/{USFM_BOOK}.{chapter}.{startVerse}
//
// Default version: ESV (59)
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

/** YouVersion version IDs for common translations */
export const YV_VERSIONS = {
  ESV:  59,
  NIV:  111,
  NLT:  116,
  NASB: 100,
  KJV:  1,
  CSB:  1713,
} as const;

export type YVVersion = keyof typeof YV_VERSIONS;

/**
 * Build a YouVersion deep-link URL.
 *
 * @param book       - Full English book name, e.g. "Romans"
 * @param chapter    - Chapter as string or number, e.g. "8" or 8
 * @param verseRange - Verse or verse range string, e.g. "1", "1-3", "12-13"
 * @param version    - Translation key (default "ESV")
 *
 * @returns URL string, or null if the book is unrecognised.
 */
export function makeYouVersionUrl(
  book: string,
  chapter: string | number,
  verseRange: string,
  version: YVVersion = "ESV"
): string | null {
  const usfm = BOOK_TO_USFM[book];
  if (!usfm) return null;

  // Use the first verse in a range
  const startVerse = String(verseRange).split("-")[0].trim();
  const versionId  = YV_VERSIONS[version];

  return `https://www.bible.com/bible/${versionId}/${usfm}.${chapter}.${startVerse}`;
}

// ---------------------------------------------------------------------------
// Reverse map: abbreviation → full book name
// Built once from BOOK_ABBREVIATIONS (e.g. "Matt" → "Matthew").
// Sorted longest-first so "1 Thess" matches before "1 Th…" style prefixes.
// ---------------------------------------------------------------------------

const ABBREV_TO_FULL: Record<string, string> = {};
for (const [full, abbr] of Object.entries(BOOK_ABBREVIATIONS)) {
  ABBREV_TO_FULL[abbr] = full;
}

/** Abbreviations sorted longest-first for greedy matching */
const SORTED_ABBREVS = Object.keys(ABBREV_TO_FULL).sort(
  (a, b) => b.length - a.length,
);

/**
 * Convert an app-style ref (e.g. "Matt 5:42", "1 Cor 13:4-7") to a
 * YouVersion USFM-style identifier (e.g. "MAT.5.42", "1CO.13.4-7").
 *
 * Returns `null` if the ref cannot be parsed or the book is unrecognised.
 */
export function refToUSFM(ref: string): string | null {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  // Find the book abbreviation by trying the longest known abbreviation first.
  let bookAbbr: string | null = null;
  let rest = "";

  for (const abbr of SORTED_ABBREVS) {
    // The ref must start with the abbreviation followed by a space and then
    // the chapter:verse portion.
    if (
      trimmed.startsWith(abbr) &&
      trimmed.length > abbr.length &&
      trimmed[abbr.length] === " "
    ) {
      bookAbbr = abbr;
      rest = trimmed.slice(abbr.length + 1).trim(); // e.g. "13:4-7"
      break;
    }
  }

  if (!bookAbbr || !rest) return null;

  const fullName = ABBREV_TO_FULL[bookAbbr];
  if (!fullName) return null;

  const usfmCode = BOOK_TO_USFM[fullName];
  if (!usfmCode) return null;

  // rest should be "chapter:verse" or "chapter:verseStart-verseEnd"
  const colonIdx = rest.indexOf(":");
  if (colonIdx === -1) return null;

  const chapter = rest.slice(0, colonIdx);
  const verseRange = rest.slice(colonIdx + 1);

  if (!chapter || !verseRange) return null;

  return `${usfmCode}.${chapter}.${verseRange}`;
}

/**
 * Extract the full book name from an app-style ref string.
 *
 * Example: "1 Cor 13:4-7" → "1 Corinthians"
 *
 * Returns `null` if the abbreviation is not recognised.
 */
export function refToFullBook(ref: string): string | null {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  for (const abbr of SORTED_ABBREVS) {
    if (
      trimmed.startsWith(abbr) &&
      (trimmed.length === abbr.length || trimmed[abbr.length] === " ")
    ) {
      return ABBREV_TO_FULL[abbr] ?? null;
    }
  }

  return null;
}
