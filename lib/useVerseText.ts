"use client";

// ---------------------------------------------------------------------------
// useVerseText — fetch a passage (context verses + Greek) from /api/verse
//
// Usage:
//   const { passage, loading, error } = useVerseText("Matt 5:42", "NIV");
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import type { VersionKey } from "@/lib/youversion";

// ---------------------------------------------------------------------------
// Types — mirror the /api/verse response
// ---------------------------------------------------------------------------

export interface Verse {
  num:     number;
  english: string | null;
  greek:   string | null;
}

export interface Passage {
  reference:        string;
  book:             string;
  chapter:          number;
  selectedStart:    number;
  selectedEnd:      number;
  version:          VersionKey;
  versionLabel:     string;
  verses:           Verse[];
  copyright:        string;
  greekAttribution: string;
}

// ---------------------------------------------------------------------------
// Cache + request dedup
// ---------------------------------------------------------------------------

function cacheKey(ref: string, version: VersionKey) {
  return `${ref}::${version}`;
}

const _cache    = new Map<string, Passage>();
const _inflight = new Map<string, Promise<Passage>>();

async function fetchPassage(ref: string, version: VersionKey): Promise<Passage> {
  const key = cacheKey(ref, version);

  const cached = _cache.get(key);
  if (cached) return cached;

  const existing = _inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const url = `/api/verse?ref=${encodeURIComponent(ref)}&version=${version}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as Passage;
    _cache.set(key, data);
    return data;
  })();

  _inflight.set(key, promise);
  promise.finally(() => _inflight.delete(key));

  return promise;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseVerseTextReturn {
  passage: Passage | null;
  loading: boolean;
  error:   string | null;
}

export function useVerseText(
  ref:     string | null,
  version: VersionKey,
): UseVerseTextReturn {
  const [passage, setPassage] = useState<Passage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!ref) {
      setPassage(null);
      setError(null);
      setLoading(false);
      return;
    }

    // Cached — synchronous update, no loading flash
    const cached = _cache.get(cacheKey(ref, version));
    if (cached) {
      setPassage(cached);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPassage(null);

    fetchPassage(ref, version)
      .then((p) => {
        if (cancelled) return;
        setPassage(p);
        setLoading(false);
        track("verse_text_view", { ref, metadata: { version } });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [ref, version]);

  return { passage, loading, error };
}
