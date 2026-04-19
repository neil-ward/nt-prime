// ---------------------------------------------------------------------------
// Tyndale NLT API adapter.
//
// Base:   https://api.nlt.to/api/
// Auth:   ?key=<KEY> query parameter
// Signup: https://api.nlt.to/Account/Register
//
// Returns HTML with clean <verse_export> wrappers:
//   <verse_export orig="matt_5_42" bk="matt" ch="5" vn="42">
//     <span class="vn">42</span>
//     <span class="red">Give to those who ask…</span>
//   </verse_export>
// Each wrapper is one verse — trivial to parse.
// ---------------------------------------------------------------------------

import { AccessDeniedError, stripHtml, type VerseMap } from "./shared";

// NLT API book-name quirks: it accepts some full names and some abbreviations
// but not consistently. These values have all been verified against the live
// API — DO NOT change without re-testing.
const NLT_BOOK: Record<string, string> = {
  // ── Old Testament ──
  Genesis:         "Genesis",
  Exodus:          "Exodus",
  Leviticus:       "Leviticus",
  Numbers:         "Numbers",
  Deuteronomy:     "Deuteronomy",
  Joshua:          "Joshua",
  Judges:          "Judges",
  Ruth:            "Ruth",
  "1 Samuel":      "1Sam",
  "2 Samuel":      "2Sam",
  "1 Kings":       "1Kgs",
  "2 Kings":       "2Kgs",
  "1 Chronicles":  "1Chr",
  "2 Chronicles":  "2Chr",
  Ezra:            "Ezra",
  Nehemiah:        "Nehemiah",
  Esther:          "Esther",
  Job:             "Job",
  Psalms:          "Ps",
  Proverbs:        "Proverbs",
  Ecclesiastes:    "Ecclesiastes",
  "Song of Songs": "Song",
  Isaiah:          "Isaiah",
  Jeremiah:        "Jeremiah",
  Lamentations:    "Lamentations",
  Ezekiel:         "Ezekiel",
  Daniel:          "Daniel",
  Hosea:           "Hosea",
  Joel:            "Joel",
  Amos:            "Amos",
  Obadiah:         "Obadiah",
  Jonah:           "Jonah",
  Micah:           "Micah",
  Nahum:           "Nahum",
  Habakkuk:        "Habakkuk",
  Zephaniah:       "Zephaniah",
  Haggai:          "Haggai",
  Zechariah:       "Zechariah",
  Malachi:         "Malachi",
  // ── New Testament ──
  Matthew:           "Matthew",
  Mark:              "Mark",
  Luke:              "Luke",
  John:              "John",
  Acts:              "Acts",
  Romans:            "Rom",
  "1 Corinthians":   "1Cor",
  "2 Corinthians":   "2Cor",
  Galatians:         "Gal",
  Ephesians:         "Eph",
  Philippians:       "Phil",
  Colossians:        "Col",
  "1 Thessalonians": "1Thes",
  "2 Thessalonians": "2Thes",
  "1 Timothy":       "1Tim",
  "2 Timothy":       "2Tim",
  Titus:             "Titus",
  Philemon:          "Phlm",
  Hebrews:           "Heb",
  James:             "Jas",
  "1 Peter":         "1Pet",
  "2 Peter":         "2Pet",
  "1 John":          "1Jn",
  "2 John":          "2Jn",
  "3 John":          "3Jn",
  Jude:              "Jude",
  Revelation:        "Rev",
};

interface CacheEntry {
  map:       VerseMap;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function fetchRange(
  _bibleId: number,       // unused — NLT only has one version
  usfmToBookName: string, // canonical book name, e.g. "Matthew"
  chapter: number,
  first: number,
  last: number,
): Promise<VerseMap> {
  const key = process.env.NLT_API_KEY;
  if (!key) throw new Error("NLT_API_KEY not configured");

  const refBook = NLT_BOOK[usfmToBookName];
  if (!refBook) throw new Error(`No NLT mapping for book "${usfmToBookName}"`);
  const ref = `${refBook}.${chapter}:${first}-${last}`;
  const cacheK = `nlt:${ref}`;

  const cached = cache.get(cacheK);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return new Map(cached.map);
  }

  const url = new URL("https://api.nlt.to/api/passages");
  url.searchParams.set("ref",     ref);
  url.searchParams.set("key",     key);
  url.searchParams.set("version", "NLT");

  const res = await fetch(url.toString(), { headers: { Accept: "text/html" } });

  if (res.status === 401 || res.status === 403) {
    throw new AccessDeniedError("NLT", `status ${res.status}`);
  }
  if (!res.ok) {
    throw new Error(`NLT API ${res.status} for ${ref}`);
  }

  const html = await res.text();
  const map  = parseNltHtml(html);
  cache.set(cacheK, { map: new Map(map), fetchedAt: Date.now() });
  return map;
}

/** Extract per-verse text from NLT API HTML. */
function parseNltHtml(html: string): VerseMap {
  const map: VerseMap = new Map();
  if (!html) return map;

  const wrapperRe = /<verse_export\b[^>]*\bvn="(\d+)"[^>]*>([\s\S]*?)<\/verse_export>/g;
  let m: RegExpExecArray | null;

  while ((m = wrapperRe.exec(html)) !== null) {
    const num = parseInt(m[1], 10);
    if (!num) continue;

    // Scrub the bits we don't want in the verse text. Order matters:
    // <span class="tn"> wraps <span class="tn-ref">, so remove the inner
    // span first — otherwise the lazy outer-match closes early and leaves
    // the footnote body mixed with the verse text.
    const inner = m[2]
      .replace(/<span\s+class="vn">[\s\S]*?<\/span>/g, "")
      .replace(/<a\b[^>]*class="a-tn"[^>]*>[\s\S]*?<\/a>/g, "")
      // Inner reference tag — nested inside tn
      .replace(/<span\b[^>]*class="tn-ref"[^>]*>[\s\S]*?<\/span>/g, "")
      // Now the outer tn span has no nested spans, so the lazy match works
      .replace(/<span\b[^>]*class="tn"[^>]*>[\s\S]*?<\/span>/g, "")
      // Section subheadings (sometimes appear inside a verse wrapper)
      .replace(/<h\d\b[^>]*>[\s\S]*?<\/h\d>/g, "");

    const text = stripHtml(inner);
    map.set(num, text || null);
  }

  return map;
}
