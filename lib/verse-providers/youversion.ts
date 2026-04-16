// ---------------------------------------------------------------------------
// YouVersion Platform API adapter.
//
// Base:   https://api.youversion.com/v1/
// Auth:   X-YVP-App-Key header
// Shape:  per-verse fetch, one verse per URL
//
// Used for: NIV, NASB 2020/1995, BSB, AMP, ASV, LSV, plus the Greek NT
//           (bibleId 3428).
// ---------------------------------------------------------------------------

import { AccessDeniedError, type VerseMap } from "./shared";

interface CacheEntry {
  text:      string | null;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function cacheKey(bibleId: number, usfm: string) {
  return `yv:${bibleId}:${usfm}`;
}

/**
 * Fetch a single verse. Returns null for 404. Throws AccessDeniedError for 403.
 */
async function fetchOne(bibleId: number, usfm: string, token: string): Promise<string | null> {
  const key = cacheKey(bibleId, usfm);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.text;

  const url = `https://api.youversion.com/v1/bibles/${bibleId}/passages/${encodeURIComponent(usfm)}`;
  const res = await fetch(url, {
    headers: { "X-YVP-App-Key": token, Accept: "application/json" },
  });

  if (res.status === 404) {
    cache.set(key, { text: null, fetchedAt: Date.now() });
    return null;
  }
  if (res.status === 403) {
    throw new AccessDeniedError("YouVersion", `bible ${bibleId}`);
  }
  if (!res.ok) {
    throw new Error(`YouVersion ${res.status} for ${usfm}`);
  }

  const data = await res.json();
  const text = (data.content || data.text || "").trim() || null;
  cache.set(key, { text, fetchedAt: Date.now() });
  return text;
}

/**
 * Fetch a range of verses from a single Bible version. Makes N parallel
 * requests; per-verse cache makes subsequent opens cheap.
 */
export async function fetchRange(
  bibleId: number,
  usfmBook: string,
  chapter: number,
  first: number,
  last: number,
): Promise<VerseMap> {
  const token = process.env.YOUVERSION_API_TOKEN;
  if (!token) throw new Error("YOUVERSION_API_TOKEN not configured");

  const numbers: number[] = [];
  for (let n = first; n <= last; n++) numbers.push(n);

  const texts = await Promise.all(
    numbers.map((n) =>
      fetchOne(bibleId, `${usfmBook}.${chapter}.${n}`, token).catch((err) => {
        if (err instanceof AccessDeniedError) throw err;
        return null;
      }),
    ),
  );

  const map: VerseMap = new Map();
  numbers.forEach((n, i) => map.set(n, texts[i]));
  return map;
}
