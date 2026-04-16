// ---------------------------------------------------------------------------
// Client-side analytics — fire-and-forget event tracking
//
// Usage:
//   import { track } from "@/lib/analytics";
//   track("verse_link_click", { ref: "Matt 5:42", dataset: "A", page: "/q2" });
//
// Events are batched (2 s debounce) and sent to /api/track in a single POST.
// Errors are silently swallowed — analytics must never break the app.
// ---------------------------------------------------------------------------

export type EventType =
  | "page_view"
  | "verse_link_click"
  | "record_expand"
  | "viz_segment_click"
  | "sidebar_open"
  | "verse_text_view"
  | "filter_change";

export interface TrackPayload {
  ref?:      string;
  dataset?:  string;
  page?:     string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

let _sessionId: string | null = null;
let _batch: Array<TrackPayload & { event_type: EventType }> = [];
let _timer: ReturnType<typeof setTimeout> | null = null;

function getSessionId(): string {
  if (_sessionId) return _sessionId;
  if (typeof window === "undefined") return "ssr";
  try {
    const stored = sessionStorage.getItem("nt_session_id");
    if (stored) { _sessionId = stored; return stored; }
    const id = crypto.randomUUID();
    sessionStorage.setItem("nt_session_id", id);
    _sessionId = id;
    return id;
  } catch {
    // Private browsing or SSR — generate ephemeral id
    _sessionId = crypto.randomUUID();
    return _sessionId;
  }
}

function flush() {
  if (_batch.length === 0) return;
  const events = _batch;
  _batch = [];
  _timer = null;

  const body = JSON.stringify({ events });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-session-id": getSessionId(),
  };

  try {
    fetch("/api/track", {
      method: "POST",
      headers,
      body,
      keepalive: true, // survives page navigation
    }).catch(() => {}); // swallow
  } catch {
    // swallow
  }
}

// Flush when tab becomes hidden (user switches tab or closes)
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function track(eventType: EventType, payload: TrackPayload = {}): void {
  if (typeof window === "undefined") return; // SSR guard

  _batch.push({ event_type: eventType, ...payload });

  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(flush, 2000);
}
