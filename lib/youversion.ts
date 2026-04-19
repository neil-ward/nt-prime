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

/**
 * USFM book codes keyed by full English book name.
 * Covers all 39 OT + 27 NT books so the verse modal can display OT
 * antecedent passages alongside NT commands.
 */
export const BOOK_TO_USFM: Record<string, string> = {
  // ── Old Testament ──
  Genesis:         "GEN",
  Exodus:          "EXO",
  Leviticus:       "LEV",
  Numbers:         "NUM",
  Deuteronomy:     "DEU",
  Joshua:          "JOS",
  Judges:          "JDG",
  Ruth:            "RUT",
  "1 Samuel":      "1SA",
  "2 Samuel":      "2SA",
  "1 Kings":       "1KI",
  "2 Kings":       "2KI",
  "1 Chronicles":  "1CH",
  "2 Chronicles":  "2CH",
  Ezra:            "EZR",
  Nehemiah:        "NEH",
  Esther:          "EST",
  Job:             "JOB",
  Psalms:          "PSA",
  Proverbs:        "PRO",
  Ecclesiastes:    "ECC",
  "Song of Songs": "SNG",
  Isaiah:          "ISA",
  Jeremiah:        "JER",
  Lamentations:    "LAM",
  Ezekiel:         "EZK",
  Daniel:          "DAN",
  Hosea:           "HOS",
  Joel:            "JOL",
  Amos:            "AMO",
  Obadiah:         "OBA",
  Jonah:           "JON",
  Micah:           "MIC",
  Nahum:           "NAM",
  Habakkuk:        "HAB",
  Zephaniah:       "ZEP",
  Haggai:          "HAG",
  Zechariah:       "ZEC",
  Malachi:         "MAL",
  // ── New Testament ──
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
  // ── Deuterocanonical / Apocrypha (common in scholarly cross-refs) ──
  Tobit:       "TOB",
  Judith:      "JDT",
  Sirach:      "SIR",
  Wisdom:      "WIS",
  "1 Maccabees": "1MA",
  "2 Maccabees": "2MA",
  Baruch:      "BAR",
  Revelation:        "REV",
};

// ---------------------------------------------------------------------------
// Supported translations — each ID works for BOTH the Platform API
// (api.youversion.com) AND bible.com deep links.
// Some translations require accepting their license agreement in the
// YouVersion developer portal before the API returns content (403 otherwise).
// Examples: NLT requires Tyndale's agreement. ESV is intentionally omitted
// because it isn't available via the Platform API at all (Crossway licensing).
// ---------------------------------------------------------------------------

export type VerseProvider = "youversion" | "esv" | "nlt";

export interface VersionSpec {
  id:        number;          // bible.com ID — used for ↗ deep links
  label:     string;
  copyright: string;
  provider:  VerseProvider;   // which upstream API serves the text
}

export const VERSIONS: Record<string, VersionSpec> = {
  NIV: {
    id: 111,
    label: "New International Version",
    copyright:
      "Scripture quotations taken from the Holy Bible, New International Version®, NIV®. Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.™",
    provider: "youversion",
  },
  ESV: {
    id: 59,
    label: "English Standard Version",
    copyright:
      "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.",
    provider: "esv",
  },
  NLT: {
    id: 116,
    label: "New Living Translation",
    copyright:
      "Scripture quotations taken from the Holy Bible, New Living Translation, copyright © 1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale House Publishers, Carol Stream, Illinois 60188. All rights reserved.",
    provider: "nlt",
  },
  NASB2020: {
    id: 2692,
    label: "New American Standard Bible 2020",
    copyright:
      "Scripture quotations taken from the (NASB®) New American Standard Bible®, Copyright © 2020 by The Lockman Foundation. Used by permission.",
    provider: "youversion",
  },
  NASB1995: {
    id: 100,
    label: "New American Standard Bible 1995",
    copyright:
      "Scripture quotations taken from the New American Standard Bible® (NASB), Copyright © 1960, 1971, 1977, 1995 by The Lockman Foundation. Used by permission.",
    provider: "youversion",
  },
  BSB: {
    id: 3034,
    label: "Berean Standard Bible",
    copyright: "The Holy Bible, Berean Standard Bible, BSB. Public domain.",
    provider: "youversion",
  },
  AMP: {
    id: 1588,
    label: "Amplified Bible",
    copyright:
      "Scripture quotations taken from the Amplified® Bible (AMP), Copyright © 2015 by The Lockman Foundation. Used by permission.",
    provider: "youversion",
  },
  ASV: {
    id: 12,
    label: "American Standard Version",
    copyright: "American Standard Version. Public domain.",
    provider: "youversion",
  },
  LSV: {
    id: 2660,
    label: "Literal Standard Version",
    copyright:
      "Scripture quotations taken from the Literal Standard Version (LSV). Copyright © 2020 Covenant Press.",
    provider: "youversion",
  },
};

export type VersionKey = keyof typeof VERSIONS;

/** Default translation when the user hasn't chosen one. */
export const DEFAULT_VERSION: VersionKey = "NIV";

/**
 * Greek New Testament — modern critical text.
 * Served via the same Platform API; no separate licensing needed.
 * ID 3428 = "The Text-Critical English New Testament" (grcTCGNT)
 *   actually resolves to the Greek text at this ID in the API catalog.
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
// Ref parsing — supports OT + NT
// ---------------------------------------------------------------------------

/**
 * Abbreviations used in the ot_antecedent field for OT books.
 * NT abbreviations come from BOOK_ABBREVIATIONS in lib/constants.ts.
 */
const OT_BOOK_ABBREVIATIONS: Record<string, string> = {
  Genesis:         "Gen",
  Exodus:          "Exod",
  Leviticus:       "Lev",
  Numbers:         "Num",
  Deuteronomy:     "Deut",
  Joshua:          "Josh",
  Judges:          "Judg",
  Ruth:            "Ruth",
  "1 Samuel":      "1 Sam",
  "2 Samuel":      "2 Sam",
  "1 Kings":       "1 Kgs",
  "2 Kings":       "2 Kgs",
  "1 Chronicles":  "1 Chr",
  "2 Chronicles":  "2 Chr",
  Ezra:            "Ezra",
  Nehemiah:        "Neh",
  Esther:          "Esth",
  Job:             "Job",
  Psalms:          "Ps",
  Proverbs:        "Prov",
  Ecclesiastes:    "Eccl",
  "Song of Songs": "Song",
  Isaiah:          "Isa",
  Jeremiah:        "Jer",
  Lamentations:    "Lam",
  Ezekiel:         "Ezek",
  Daniel:          "Dan",
  Hosea:           "Hos",
  Joel:            "Joel",
  Amos:            "Amos",
  Obadiah:         "Obad",
  Jonah:           "Jonah",
  Micah:           "Mic",
  Nahum:           "Nah",
  Habakkuk:        "Hab",
  Zephaniah:       "Zeph",
  Haggai:          "Hag",
  Zechariah:       "Zech",
  Malachi:         "Mal",
};

/**
 * Additional OT + DC abbreviation aliases commonly found in scholarly refs
 * beyond the canonical short forms above. Mapped to the full book name.
 */
const OT_ALIASES: Record<string, string> = {
  Ex:    "Exodus",
  Dt:    "Deuteronomy",
  Jos:   "Joshua",
  Jdg:   "Judges",
  "1Sam": "1 Samuel",
  "2Sam": "2 Samuel",
  "1Ki":  "1 Kings",
  "2Ki":  "2 Kings",
  "1Ch":  "1 Chronicles",
  "2Ch":  "2 Chronicles",
  Est:   "Esther",
  Pss:   "Psalms",
  Pslm:  "Psalms",
  Pro:   "Proverbs",
  Ecc:   "Ecclesiastes",
  Qoh:   "Ecclesiastes",
  Cant:  "Song of Songs",
  Is:    "Isaiah",
  Jrm:   "Jeremiah",
  Eze:   "Ezekiel",
  Dn:    "Daniel",
  Oba:   "Obadiah",
  Jon:   "Jonah",
  Nam:   "Nahum",
  Zph:   "Zephaniah",
  Zec:   "Zechariah",
  // Deuterocanonical short forms
  Tob:   "Tobit",
  Jdth:  "Judith",
  Sir:   "Sirach",
  Wis:   "Wisdom",
  "1Macc": "1 Maccabees",
  "2Macc": "2 Maccabees",
  Bar:   "Baruch",
};

// Combined abbreviation → full-book map.
// Sources (in order, later wins on collision):
//   - Full book names themselves (so "Isaiah 35:5-6" parses, not just "Isa 35:5-6")
//   - NT abbreviations from constants (Matt, 1 Cor, …)
//   - OT abbreviations (Gen, Exod, 1 Sam, …)
//   - Scholarly OT aliases (Dt, Eze, Qoh, Cant, …)
const ABBREV_TO_FULL: Record<string, string> = {};
// Full names map to themselves — handles "Isaiah 35:5-6", "1 Corinthians 13:4-7", etc.
for (const full of Object.keys(BOOK_TO_USFM)) {
  ABBREV_TO_FULL[full] = full;
}
for (const [full, abbr] of Object.entries(BOOK_ABBREVIATIONS)) {
  ABBREV_TO_FULL[abbr] = full;
}
for (const [full, abbr] of Object.entries(OT_BOOK_ABBREVIATIONS)) {
  ABBREV_TO_FULL[abbr] = full;
}
for (const [alias, full] of Object.entries(OT_ALIASES)) {
  ABBREV_TO_FULL[alias] = full;
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
  // Strip parenthetical annotations like "Exod 12 (Passover)" before parsing.
  // Also normalize en-dashes and em-dashes → hyphens throughout.
  const cleaned = ref
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/[–—]/g, "-")
    .trim();
  if (!cleaned) return null;

  // Match abbreviation. Allow: space, ".", or a digit directly after
  // the book name (so "Gen 4", "Gen.4", and "Gen4" all parse).
  let bookAbbr: string | null = null;
  let rest = "";
  for (const abbr of SORTED_ABBREVS) {
    if (!cleaned.startsWith(abbr)) continue;
    if (cleaned.length === abbr.length) continue;
    const next = cleaned[abbr.length];
    if (next === " " || next === "." || /[0-9]/.test(next)) {
      bookAbbr = abbr;
      rest = cleaned.slice(abbr.length).replace(/^[\s.]+/, "").trim();
      break;
    }
  }
  if (!bookAbbr || !rest) return null;

  const fullBook = ABBREV_TO_FULL[bookAbbr];
  if (!fullBook) return null;

  const usfmBook = BOOK_TO_USFM[fullBook];
  if (!usfmBook) return null;

  const colonIdx = rest.indexOf(":");

  // ── No colon: whole-chapter reference (e.g. "Exod 32", "Isa 53") or
  //    cross-chapter range (e.g. "Gen 6-8", "Lev 17-18"). Treat as the
  //    first verse of the first chapter so the reader lands on something
  //    and can tell they're in the right passage.
  if (colonIdx === -1) {
    const chapterPart = rest.split("-")[0].split(",")[0].trim();
    const chapter     = parseInt(chapterPart, 10);
    if (!chapter) return null;
    return {
      fullBook, usfmBook, chapter,
      verseStart: 1, verseEnd: 1, verseRange: "1",
    };
  }

  const chapter = parseInt(rest.slice(0, colonIdx), 10);
  // Keep only the first verse range; drop comma-separated continuations.
  const verseRange = rest.slice(colonIdx + 1)
    .split(",")[0]
    .trim();
  if (!chapter || !verseRange) return null;

  const [startStr, endStr] = verseRange.split("-");
  const verseStart = parseInt(startStr, 10);
  const verseEnd   = endStr ? parseInt(endStr, 10) : verseStart;
  if (!verseStart) return null;

  return {
    fullBook, usfmBook, chapter, verseStart, verseEnd,
    verseRange: verseEnd === verseStart ? String(verseStart) : `${verseStart}-${verseEnd}`,
  };
}

// ---------------------------------------------------------------------------
// OT antecedent splitter
// ---------------------------------------------------------------------------

/**
 * Parse an ot_antecedent string into individual refs. The field is
 * semicolon-separated, and continuation refs may omit the book (e.g.
 * "Isa 35:5–6; 61:1" where "61:1" inherits "Isa"). This function
 * propagates the most recently parsed book forward so those parse cleanly.
 *
 * Returns an array of { raw, parsed } so callers can surface unparseable
 * entries without losing them.
 */
export interface SplitAntecedent {
  raw:    string;
  parsed: ParsedRef | null;
}

export function splitOTAntecedent(s: string | null | undefined): SplitAntecedent[] {
  if (!s) return [];

  const out: SplitAntecedent[] = [];
  let lastBookAbbr: string | null = null;

  for (const part of s.split(";").map((p) => p.trim()).filter(Boolean)) {
    // Does this part start with a recognized book?
    let startsWithBook = false;
    for (const abbr of SORTED_ABBREVS) {
      if (part.startsWith(abbr)) {
        const next = part[abbr.length];
        if (next === " " || next === "." || next === undefined || /[0-9]/.test(next)) {
          startsWithBook = true;
          lastBookAbbr = abbr;
          break;
        }
      }
    }

    // If no book, prepend the last-seen book so "61:1" → "Isa 61:1"
    const candidate = startsWithBook
      ? part
      : (lastBookAbbr ? `${lastBookAbbr} ${part}` : part);

    out.push({ raw: part, parsed: parseRef(candidate) });
  }

  return out;
}
