// ---------------------------------------------------------------------------
// POST /api/track — ingest analytics events
//
// Accepts a batch of events from the client-side analytics module.
// Inserts into the Supabase `events` table via the service-role client.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const ALLOWED_TYPES = new Set([
  "page_view",
  "verse_link_click",
  "record_expand",
  "viz_segment_click",
  "sidebar_open",
  "verse_text_view",
  "filter_change",
]);

interface RawEvent {
  event_type: string;
  ref?: string;
  dataset?: string;
  page?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const events: RawEvent[] = Array.isArray(body.events) ? body.events : [];
    const sessionId = req.headers.get("x-session-id") || crypto.randomUUID();

    if (events.length === 0) {
      return NextResponse.json({ ok: false, error: "No events" }, { status: 400 });
    }

    // Validate and sanitise
    const rows = events
      .filter((e) => e.event_type && ALLOWED_TYPES.has(e.event_type))
      .map((e) => ({
        event_type: e.event_type,
        ref:        typeof e.ref === "string"     ? e.ref.slice(0, 100)     : null,
        dataset:    typeof e.dataset === "string"  ? e.dataset.slice(0, 10) : null,
        page:       typeof e.page === "string"     ? e.page.slice(0, 100)   : null,
        metadata:   typeof e.metadata === "object" ? e.metadata             : {},
        session_id: sessionId,
      }));

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "No valid events" }, { status: 400 });
    }

    const { error } = await supabaseAdmin().from("events").insert(rows);

    if (error) {
      console.error("[track] Supabase insert error:", error.message);
      return NextResponse.json({ ok: false, error: "Insert failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, count: rows.length });
  } catch (err) {
    console.error("[track] Unexpected error:", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
