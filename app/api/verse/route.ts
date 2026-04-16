// ---------------------------------------------------------------------------
// GET /api/verse — fetch a Bible passage with surrounding context + Greek
//
// Query params:
//   ref     — App-style reference (e.g. "Matt 5:42", "1 Cor 13:4-7")
//   version — Translation key from VERSIONS map (default NIV)
//   context — Verses to include on each side of the selection (default 4)
//
// Returns:
//   {
//     reference:     "Matthew 5:38-46",
//     book:          "Matthew",
//     chapter:       5,
//     selectedStart: 42,
//     selectedEnd:   42,
//     version:       "NIV",
//     verses:        [ { num, english, greek } ],
//     copyright:     "…",
//     greekAttribution: "…"
//   }
//
// Implementation notes:
//   - N parallel YouVersion fetches (2 per verse: English + Greek).
//   - Per-verse in-memory cache keyed (bibleId, usfm) for 15 min.
//   - Gracefully handles 404s (past chapter end, or Greek missing).
// ---------------------------------------------------------------------------

import { type NextRequest, NextResponse } from "next/server";
import {
  parseRef,
  VERSIONS,
  GREEK_BIBLE_ID,
  GREEK_LABEL,
  type VersionKey,
} from "@/lib/youversion";

// ---------------------------------------------------------------------------
// Per-verse in-memory cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  text:      string | null;   // null means 404 (caches negative results)
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function cacheKey(bibleId: number, usfm: string) {
  return `${bibleId}:${usfm}`;
}

/** Sentinel thrown when a Bible version is denied (not licensed on this key). */
class AccessDeniedError extends Error {
  constructor(public bibleId: number) {
    super(`Access denied for bible ${bibleId}`);
  }
}

/**
 * Fetch a single verse from the YouVersion Platform API.
 * Returns null on 404. Throws AccessDeniedError on 403. Throws on other errors.
 */
async function fetchVerse(
  bibleId: number,
  usfm: string,
  token: string,
): Promise<string | null> {
  const key = cacheKey(bibleId, usfm);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.text;
  }

  const url = `https://api.youversion.com/v1/bibles/${bibleId}/passages/${encodeURIComponent(usfm)}`;
  const res = await fetch(url, {
    headers: { "X-YVP-App-Key": token, Accept: "application/json" },
  });

  if (res.status === 404) {
    cache.set(key, { text: null, fetchedAt: Date.now() });
    return null;
  }

  if (res.status === 403) {
    throw new AccessDeniedError(bibleId);
  }

  if (!res.ok) {
    throw new Error(`YouVersion API ${res.status} for ${usfm}`);
  }

  const data = await res.json();
  const text = (data.content || data.text || "").trim();
  cache.set(key, { text, fetchedAt: Date.now() });
  return text || null;
}

// ---------------------------------------------------------------------------
// Range expansion — pericope heuristic (±context verses)
// ---------------------------------------------------------------------------

function expandRange(
  chapter: number,
  selStart: number,
  selEnd: number,
  context: number,
): { first: number; last: number } {
  // Lower bound: selected start - context, but never below 1
  const first = Math.max(1, selStart - context);
  // Upper bound: selected end + context. We don't know chapter length up
  // front — we'll stop at the first 404 when fetching.
  const last  = selEnd + context;
  void chapter;
  return { first, last };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const token = process.env.YOUVERSION_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Verse text not configured — set YOUVERSION_API_TOKEN" },
      { status: 503 },
    );
  }

  const { searchParams } = request.nextUrl;
  const refParam     = searchParams.get("ref");
  const versionParam = (searchParams.get("version") || "NIV").toUpperCase() as VersionKey;
  const contextParam = Math.max(0, Math.min(10, parseInt(searchParams.get("context") || "4", 10) || 4));

  if (!refParam) {
    return NextResponse.json(
      { error: "Missing required query parameter: ref" },
      { status: 400 },
    );
  }

  // 1. Parse the ref
  const parsed = parseRef(refParam);
  if (!parsed) {
    return NextResponse.json(
      { error: `Could not parse ref: "${refParam}"` },
      { status: 400 },
    );
  }

  // 2. Resolve version
  const version = VERSIONS[versionParam];
  if (!version) {
    return NextResponse.json(
      { error: `Unknown version: "${versionParam}". Available: ${Object.keys(VERSIONS).join(", ")}` },
      { status: 400 },
    );
  }

  // 3. Compute range
  const { first, last } = expandRange(
    parsed.chapter,
    parsed.verseStart,
    parsed.verseEnd,
    contextParam,
  );

  // 4. Build USFM ids for every verse in the range
  const verseNumbers: number[] = [];
  for (let v = first; v <= last; v++) verseNumbers.push(v);

  // If the English version isn't licensed for this API key, the first fetch
  // will throw AccessDeniedError. Do a single probe fetch first to surface a
  // clean error rather than drowning it in Promise.all results.
  try {
    await fetchVerse(version.id, `${parsed.usfmBook}.${parsed.chapter}.${parsed.verseStart}`, token);
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return NextResponse.json(
        {
          error: `This translation (${versionParam}) isn't enabled on your YouVersion developer key. Open https://developers.youversion.com/ and accept the license agreement for ${versionParam}, then try again.`,
          code: "version_not_licensed",
          version: versionParam,
        },
        { status: 403 },
      );
    }
    // fall through for other errors — handled below
  }

  const englishFetches = verseNumbers.map((n) =>
    fetchVerse(version.id, `${parsed.usfmBook}.${parsed.chapter}.${n}`, token)
      .catch(() => null),
  );
  const greekFetches = verseNumbers.map((n) =>
    fetchVerse(GREEK_BIBLE_ID, `${parsed.usfmBook}.${parsed.chapter}.${n}`, token)
      .catch(() => null),
  );

  const [englishResults, greekResults] = await Promise.all([
    Promise.all(englishFetches),
    Promise.all(greekFetches),
  ]);

  // 5. Build verses array, trimming trailing 404s (we overshoot last verse
  //    to cover chapter-end edge cases)
  interface VerseOut {
    num:     number;
    english: string | null;
    greek:   string | null;
  }

  const verses: VerseOut[] = verseNumbers.map((num, i) => ({
    num,
    english: englishResults[i],
    greek:   greekResults[i],
  }));

  // Trim trailing verses that are null in both languages (past chapter end)
  while (
    verses.length > 0 &&
    verses[verses.length - 1].english === null &&
    verses[verses.length - 1].greek === null
  ) {
    verses.pop();
  }

  if (verses.length === 0) {
    return NextResponse.json(
      { error: `No verses found for ${refParam}` },
      { status: 404 },
    );
  }

  // 6. Ensure the selected verse(s) are actually present
  const selectedPresent = verses.some(
    (v) => v.num >= parsed.verseStart && v.num <= parsed.verseEnd && v.english,
  );
  if (!selectedPresent) {
    return NextResponse.json(
      { error: `Selected verse ${parsed.verseRange} not available in ${versionParam}` },
      { status: 404 },
    );
  }

  // 7. Build display reference string
  const displayFirst = verses[0].num;
  const displayLast  = verses[verses.length - 1].num;
  const reference =
    displayFirst === displayLast
      ? `${parsed.fullBook} ${parsed.chapter}:${displayFirst}`
      : `${parsed.fullBook} ${parsed.chapter}:${displayFirst}-${displayLast}`;

  return NextResponse.json(
    {
      reference,
      book:             parsed.fullBook,
      chapter:          parsed.chapter,
      selectedStart:    parsed.verseStart,
      selectedEnd:      parsed.verseEnd,
      version:          versionParam,
      versionLabel:     version.label,
      verses,
      copyright:        version.copyright,
      greekAttribution: `Greek: ${GREEK_LABEL}, via YouVersion Platform API.`,
    },
    { headers: { "Cache-Control": "private, max-age=900" } },
  );
}
