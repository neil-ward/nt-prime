"use client";

// ---------------------------------------------------------------------------
// useVerseText — fetch Bible verse text from /api/verse
//
// Usage:
//   const { text, loading, error, copyright } = useVerseText("Matt 5:42");
//
// Features:
//   - Module-level cache so repeated refs are instant
//   - Request deduplication (concurrent calls for the same ref share one fetch)
//   - Tracks a `verse_text_view` analytics event on successful fetch
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

interface VerseResult {
  text: string;
  copyright: string;
}

// Module-level cache: ref → result (persists across component mounts)
const _cache = new Map<string, VerseResult>();

// In-flight dedup: ref → shared promise
const _inflight = new Map<string, Promise<VerseResult>>();

async function fetchVerse(ref: string): Promise<VerseResult> {
  // Check cache first
  const cached = _cache.get(ref);
  if (cached) return cached;

  // Dedup concurrent requests
  const existing = _inflight.get(ref);
  if (existing) return existing;

  const promise = (async () => {
    const res = await fetch(`/api/verse?ref=${encodeURIComponent(ref)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const result: VerseResult = {
      text: data.text || "",
      copyright: data.copyright || "",
    };
    _cache.set(ref, result);
    return result;
  })();

  _inflight.set(ref, promise);
  promise.finally(() => _inflight.delete(ref));

  return promise;
}

export interface UseVerseTextReturn {
  text: string | null;
  loading: boolean;
  error: string | null;
  copyright: string | null;
}

export function useVerseText(ref: string | null): UseVerseTextReturn {
  const [text, setText] = useState<string | null>(null);
  const [copyright, setCopyright] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref) {
      setText(null);
      setCopyright(null);
      setError(null);
      setLoading(false);
      return;
    }

    // If already cached, return synchronously (no loading flash)
    const cached = _cache.get(ref);
    if (cached) {
      setText(cached.text);
      setCopyright(cached.copyright);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setText(null);
    setCopyright(null);

    fetchVerse(ref)
      .then((result) => {
        if (cancelled) return;
        setText(result.text);
        setCopyright(result.copyright);
        setLoading(false);
        track("verse_text_view", { ref });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [ref]);

  return { text, loading, error, copyright };
}
