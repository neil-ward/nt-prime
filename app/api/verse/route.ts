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
//     reference, book, chapter, selectedStart, selectedEnd,
//     version, versionLabel,
//     verses:  [ { num, english, greek } ],
//     copyright, greekAttribution
//   }
//
// Dispatch:
//   - VERSIONS[key].provider selects which adapter serves the English text:
//     "youversion" | "esv" | "nlt"
//   - Greek always comes from YouVersion (bibleId 3428)
// ---------------------------------------------------------------------------

import { type NextRequest, NextResponse } from "next/server";
import {
  parseRef,
  VERSIONS,
  GREEK_BIBLE_ID,
  GREEK_LABEL,
  type VersionKey,
} from "@/lib/youversion";
import { AccessDeniedError } from "@/lib/verse-providers/shared";
import * as Yv  from "@/lib/verse-providers/youversion";
import * as Esv from "@/lib/verse-providers/esv";
import * as Nlt from "@/lib/verse-providers/nlt";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const refParam     = searchParams.get("ref");
  const versionParam = (searchParams.get("version") || "NIV").toUpperCase() as VersionKey;
  const contextParam = Math.max(
    0,
    Math.min(10, parseInt(searchParams.get("context") || "4", 10) || 4),
  );

  if (!refParam) {
    return NextResponse.json({ error: "Missing required query parameter: ref" }, { status: 400 });
  }

  // Parse ref
  const parsed = parseRef(refParam);
  if (!parsed) {
    return NextResponse.json({ error: `Could not parse ref: "${refParam}"` }, { status: 400 });
  }

  // Resolve version
  const version = VERSIONS[versionParam];
  if (!version) {
    return NextResponse.json(
      { error: `Unknown version: "${versionParam}". Available: ${Object.keys(VERSIONS).join(", ")}` },
      { status: 400 },
    );
  }

  // Compute context range (±contextParam around the selected range)
  const first = Math.max(1, parsed.verseStart - contextParam);
  const last  = parsed.verseEnd + contextParam;

  // English + Greek in parallel
  let englishMap: Map<number, string | null>;
  let greekMap:   Map<number, string | null>;

  try {
    [englishMap, greekMap] = await Promise.all([
      dispatchEnglish(version.provider, version.id, parsed.fullBook, parsed.usfmBook, parsed.chapter, first, last),
      Yv.fetchRange(GREEK_BIBLE_ID, parsed.usfmBook, parsed.chapter, first, last).catch(() => new Map()),
    ]);
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return NextResponse.json(
        {
          error: `Verse text provider (${err.provider}) denied access. Check that the key is valid and, if required, that the translation's license agreement has been accepted.`,
          code:  "provider_access_denied",
          version: versionParam,
        },
        { status: 403 },
      );
    }
    if (err instanceof Error && err.message.includes("not configured")) {
      return NextResponse.json(
        { error: err.message, code: "not_configured" },
        { status: 503 },
      );
    }
    console.error("[verse] Unhandled error:", err);
    return NextResponse.json({ error: "Could not fetch verse text" }, { status: 502 });
  }

  // Build the verse list; trim trailing null-in-both entries (past chapter end)
  interface VerseOut { num: number; english: string | null; greek: string | null; }
  const verses: VerseOut[] = [];
  for (let n = first; n <= last; n++) {
    verses.push({
      num:     n,
      english: englishMap.get(n) ?? null,
      greek:   greekMap.get(n) ?? null,
    });
  }
  while (verses.length && verses[verses.length - 1].english === null && verses[verses.length - 1].greek === null) {
    verses.pop();
  }

  if (!verses.length) {
    return NextResponse.json({ error: `No verses found for ${refParam}` }, { status: 404 });
  }

  const selectedPresent = verses.some(
    (v) => v.num >= parsed.verseStart && v.num <= parsed.verseEnd && v.english,
  );
  if (!selectedPresent) {
    return NextResponse.json(
      { error: `Selected verse ${parsed.verseRange} not available in ${versionParam}` },
      { status: 404 },
    );
  }

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

/** Route the English-text fetch to the configured provider. */
function dispatchEnglish(
  provider: "youversion" | "esv" | "nlt",
  bibleId:  number,
  fullBook: string,  // "Matthew", "1 Corinthians"
  usfmBook: string,  // "MAT", "1CO"
  chapter:  number,
  first:    number,
  last:     number,
): Promise<Map<number, string | null>> {
  switch (provider) {
    case "youversion":
      return Yv.fetchRange(bibleId, usfmBook, chapter, first, last);
    case "esv":
      return Esv.fetchRange(bibleId, fullBook, chapter, first, last);
    case "nlt":
      return Nlt.fetchRange(bibleId, fullBook, chapter, first, last);
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}
