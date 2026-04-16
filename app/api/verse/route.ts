// ---------------------------------------------------------------------------
// GET /api/verse — fetch verse text from YouVersion Platform API
//
// Query params:
//   ref     — App-style reference, e.g. "Matt 5:42", "1 Cor 13:4-7"
//   version — Translation abbreviation (default "NIV")
//
// Returns:
//   { ref, text, version, copyright }
//
// Graceful degradation:
//   - 503 if YOUVERSION_API_TOKEN is not configured
//   - 400 if ref is missing or unparseable
//   - 502 if the upstream API call fails
//
// API details (YouVersion Platform):
//   Base URL:  https://api.youversion.com/v1/
//   Auth:      X-YVP-App-Key header
//   Endpoint:  /bibles/{bibleId}/passages/{USFM}
//   Response:  { id, content, reference }
// ---------------------------------------------------------------------------

import { type NextRequest, NextResponse } from "next/server";
import { refToUSFM } from "@/lib/youversion";

// ---------------------------------------------------------------------------
// Available Bible versions (ID used by YouVersion Platform API)
// ESV is not available through this API — requires separate Crossway license.
// ---------------------------------------------------------------------------

const BIBLE_IDS: Record<string, number> = {
  NIV:      111,    // New International Version 2011
  NASB:     2692,   // New American Standard Bible 2020
  NASB1995: 100,    // NASB 1995
  BSB:      3034,   // Berean Standard Bible
  AMP:      1588,   // Amplified Bible
  ASV:      12,     // American Standard Version
  NLT:      1849,   // The Passion Translation (closest popular option)
  LSV:      2660,   // Literal Standard Version
};

// Copyright notices per version
const COPYRIGHT: Record<string, string> = {
  NIV:  "Scripture quotations taken from the Holy Bible, New International Version®, NIV®. Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.™",
  NASB: "Scripture quotations taken from the (NASB®) New American Standard Bible®. Copyright © 2020 by The Lockman Foundation.",
  BSB:  "Scripture quotations from the Berean Standard Bible. Public domain.",
  AMP:  "Scripture quotations taken from the Amplified® Bible. Copyright © 2015 by The Lockman Foundation.",
  ASV:  "American Standard Version. Public domain.",
  LSV:  "Literal Standard Version. Copyright © 2020 Covenant Press.",
};

// ---------------------------------------------------------------------------
// In-memory cache — keeps verse text for 15 minutes
// ---------------------------------------------------------------------------

interface CacheEntry {
  text: string;
  reference: string;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // 1. Check for API token
  const token = process.env.YOUVERSION_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Verse text not configured — set YOUVERSION_API_TOKEN in .env.local" },
      { status: 503 },
    );
  }

  // 2. Parse query params
  const { searchParams } = request.nextUrl;
  const ref = searchParams.get("ref");
  const versionParam = (searchParams.get("version") || "NIV").toUpperCase();

  if (!ref) {
    return NextResponse.json(
      { error: "Missing required query parameter: ref" },
      { status: 400 },
    );
  }

  // 3. Convert ref to USFM
  const usfm = refToUSFM(ref);
  if (!usfm) {
    return NextResponse.json(
      { error: `Could not parse ref: "${ref}"` },
      { status: 400 },
    );
  }

  // 4. Resolve Bible version ID
  const bibleId = BIBLE_IDS[versionParam];
  if (!bibleId) {
    return NextResponse.json(
      { error: `Unknown version: "${versionParam}". Available: ${Object.keys(BIBLE_IDS).join(", ")}` },
      { status: 400 },
    );
  }

  // 5. Check cache
  const cacheKey = `${usfm}:${bibleId}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(
      {
        ref: cached.reference || ref,
        text: cached.text,
        version: versionParam,
        copyright: COPYRIGHT[versionParam] || "",
      },
      { headers: { "Cache-Control": "private, max-age=900" } },
    );
  }

  // 6. Fetch from YouVersion Platform API
  const apiUrl = `https://api.youversion.com/v1/bibles/${bibleId}/passages/${encodeURIComponent(usfm)}`;
  let apiRes: Response;

  try {
    apiRes = await fetch(apiUrl, {
      headers: {
        "X-YVP-App-Key": token,
        Accept: "application/json",
      },
    });
  } catch (err) {
    console.error("[verse] Fetch error:", err);
    return NextResponse.json(
      { error: "Could not reach YouVersion API" },
      { status: 502 },
    );
  }

  if (!apiRes.ok) {
    const body = await apiRes.text().catch(() => "");
    console.error(`[verse] YouVersion API returned ${apiRes.status} for ${usfm}:`, body);
    return NextResponse.json(
      { error: `YouVersion API error (${apiRes.status})` },
      { status: 502 },
    );
  }

  // 7. Parse response — { id, content, reference }
  let text: string;
  let reference: string;

  try {
    const data = await apiRes.json();
    text = data.content || data.text || "";
    reference = data.reference || ref;

    if (!text) {
      console.warn("[verse] Empty content from API. Full payload:", JSON.stringify(data));
      return NextResponse.json(
        { error: "Verse text was empty in API response" },
        { status: 502 },
      );
    }
  } catch (parseErr) {
    console.error("[verse] JSON parse error:", parseErr);
    return NextResponse.json(
      { error: "Could not parse API response" },
      { status: 502 },
    );
  }

  // 8. Cache
  cache.set(cacheKey, { text, reference, fetchedAt: Date.now() });

  // 9. Return
  return NextResponse.json(
    {
      ref: reference,
      text,
      version: versionParam,
      copyright: COPYRIGHT[versionParam] || "",
    },
    { headers: { "Cache-Control": "private, max-age=900" } },
  );
}
