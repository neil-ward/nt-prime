// ---------------------------------------------------------------------------
// GET /api/analytics — aggregated analytics for the dashboard page
//
// Query param: ?range=7d|30d|all  (default 30d)
//
// Calls five Supabase RPC functions in parallel, returns combined JSON.
// Uses the anon (public) client since the analytics page is public.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { supabasePublic } from "@/lib/supabase";

function parseDays(range: string | null): number {
  if (range === "7d")  return 7;
  if (range === "all") return 3650; // ~10 years — effectively all
  return 30;
}

export async function GET(req: NextRequest) {
  try {
    const range = req.nextUrl.searchParams.get("range");
    const days  = parseDays(range);
    const sb    = supabasePublic();

    const [heatmap, topVerses, datasetInterest, pageEngagement, dailyTrend] =
      await Promise.all([
        sb.rpc("analytics_hourly_heatmap",   { cutoff_days: days }),
        sb.rpc("analytics_top_verses",       { cutoff_days: days, lim: 20 }),
        sb.rpc("analytics_dataset_interest", { cutoff_days: days }),
        sb.rpc("analytics_page_engagement",  { cutoff_days: days }),
        sb.rpc("analytics_daily_trend",      { cutoff_days: days }),
      ]);

    // Collect any RPC errors
    const errors = [heatmap, topVerses, datasetInterest, pageEngagement, dailyTrend]
      .filter((r) => r.error)
      .map((r) => r.error?.message);

    if (errors.length > 0) {
      console.error("[analytics] RPC errors:", errors);
      return NextResponse.json(
        { ok: false, error: "Query failed", details: errors },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        range: range || "30d",
        heatmap:         heatmap.data         ?? [],
        topVerses:       topVerses.data       ?? [],
        datasetInterest: datasetInterest.data ?? [],
        pageEngagement:  pageEngagement.data  ?? [],
        dailyTrend:      dailyTrend.data      ?? [],
      },
      {
        headers: {
          // Cache for 5 minutes — analytics don't need real-time freshness
          "Cache-Control": "public, max-age=300, s-maxage=300",
        },
      },
    );
  } catch (err) {
    console.error("[analytics] Unexpected error:", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
