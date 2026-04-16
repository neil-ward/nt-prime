// ---------------------------------------------------------------------------
// Crossway ESV API adapter.
//
// Base:   https://api.esv.org/v3/
// Auth:   Authorization: Token <KEY>
// Signup: https://api.esv.org/account/create-application/
//
// The ESV API returns a single HTML blob covering the whole requested range.
// We parse verse-number markers to break it into per-verse text.
//
// Verse markers look like:
//   <b class="verse-num woc" id="v40005042-1">42&nbsp;</b>Give to the one…
// The numeric ID is BBCCCVVV (8 digits); the last 3 are the verse number.
// ---------------------------------------------------------------------------

import { AccessDeniedError, stripHtml, type VerseMap } from "./shared";

interface CacheEntry {
  map:       VerseMap;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function fetchRange(
  _bibleId: number,       // unused — ESV only has one version
  usfmToBookName: string, // canonical book name, e.g. "Matthew"
  chapter: number,
  first: number,
  last: number,
): Promise<VerseMap> {
  const key = process.env.ESV_API_KEY;
  if (!key) throw new Error("ESV_API_KEY not configured");

  // Pad the range by one verse on each side — the API occasionally snaps
  // to paragraph boundaries, so asking for a slightly wider window is safer.
  const q = `${usfmToBookName} ${chapter}:${first}-${last}`;
  const cacheK = `esv:${q}`;

  const cached = cache.get(cacheK);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return new Map(cached.map);
  }

  const url = new URL("https://api.esv.org/v3/passage/html/");
  url.searchParams.set("q", q);
  url.searchParams.set("include-headings",        "false");
  url.searchParams.set("include-footnotes",       "false");
  url.searchParams.set("include-short-copyright", "false");
  url.searchParams.set("include-audio-link",      "false");
  url.searchParams.set("include-passage-references", "false");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Token ${key}`, Accept: "application/json" },
  });

  if (res.status === 401 || res.status === 403) {
    throw new AccessDeniedError("ESV", `status ${res.status}`);
  }
  if (!res.ok) {
    throw new Error(`ESV API ${res.status} for ${q}`);
  }

  const data = await res.json();
  const html = (data.passages?.[0] as string) || "";

  const map = parseEsvHtml(html);
  cache.set(cacheK, { map: new Map(map), fetchedAt: Date.now() });
  return map;
}

/**
 * Split the ESV HTML into a map keyed by verse number.
 * We locate every verse-num <b> marker, then capture the HTML between
 * one marker and the next. Stripping tags yields clean verse text.
 */
function parseEsvHtml(html: string): VerseMap {
  const map: VerseMap = new Map();
  if (!html) return map;

  // Marker shapes (ESV uses a different class for the first verse of a chapter):
  //   <b class="verse-num woc" id="v40005042-1">42&nbsp;</b>
  //   <b class="chapter-num" id="v46013001-1">13:1&nbsp;</b>   ← chapter start
  // The numeric id encodes BBCCCVVV — we want the last 3 digits (verse).
  const markerRe =
    /<b\b[^>]*class="[^"]*(?:verse-num|chapter-num)[^"]*"[^>]*id="v\d+(\d{3})-\d+"[^>]*>[\s\S]*?<\/b>/g;

  const markers: { num: number; start: number; len: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(html)) !== null) {
    const num = parseInt(m[1], 10);
    if (num > 0) markers.push({ num, start: m.index, len: m[0].length });
  }

  for (let i = 0; i < markers.length; i++) {
    const textStart = markers[i].start + markers[i].len;
    const textEnd   = i + 1 < markers.length ? markers[i + 1].start : html.length;
    const text      = stripHtml(html.slice(textStart, textEnd));
    map.set(markers[i].num, text || null);
  }

  return map;
}
