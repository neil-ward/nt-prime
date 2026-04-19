// ---------------------------------------------------------------------------
// GET /api/records — public endpoint returning all NT command records.
//
// Source of truth: Supabase `records` table.
// Auth: none — uses the anon key; RLS on the table allows public SELECT.
//
// Cache headers keep the page-render path fast while still letting
// admin edits propagate within ~60 seconds.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { supabasePublic } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabasePublic()
    .from("records")
    .select("*")
    // Keep a stable order so SSR and client match — book, chapter, dataset
    .order("book",    { ascending: true })
    .order("chapter", { ascending: true })
    .order("dataset", { ascending: true });

  if (error) {
    console.error("[records] Supabase error:", error.message);
    return NextResponse.json(
      { error: "Could not load records" },
      { status: 500 },
    );
  }

  return NextResponse.json(data ?? [], {
    headers: {
      // Browser + CDN cache for 60s; stale-while-revalidate lets subsequent
      // requests serve stale data while we refresh in the background.
      "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
    },
  });
}
