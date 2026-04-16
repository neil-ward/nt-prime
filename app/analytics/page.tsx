"use client";

/**
 * /analytics -- usage analytics dashboard.
 *
 * Five visualizations showing how users interact with the app:
 * 1. Activity Heatmap        (hour x day-of-week)
 * 2. Most-Viewed Verses      (horizontal bar, top 20)
 * 3. Dataset Interest         (grouped bar by event type)
 * 4. Page Engagement          (horizontal bar by page)
 * 5. Daily Activity Trend     (line + area chart)
 *
 * Range toggle: 7 days / 30 days / All time
 * Fetches from /api/analytics?range={range}
 */

import { useEffect, useState } from "react";
import ActivityHeatmap from "@/components/visualizations/ActivityHeatmap";
import TopVersesChart from "@/components/visualizations/TopVersesChart";
import DatasetInterestChart from "@/components/visualizations/DatasetInterestChart";
import PageEngagementChart from "@/components/visualizations/PageEngagementChart";
import DailyTrendChart from "@/components/visualizations/DailyTrendChart";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnalyticsData {
  heatmap: { dow: number; hour: number; count: number }[];
  topVerses: { ref: string; count: number }[];
  datasetInterest: { dataset: string; event_type: string; count: number }[];
  pageEngagement: { page: string; count: number }[];
  dailyTrend: { day: string; count: number }[];
}

type Range = "7d" | "30d" | "all";

const RANGES: { value: Range; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
];

// ---------------------------------------------------------------------------
// VizSection -- consistent heading + chart container (matches /explore)
// ---------------------------------------------------------------------------

function VizSection({
  num,
  title,
  subtitle,
  children,
}: {
  num: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-stone-200 py-12">
      <div className="flex items-start gap-6 mb-7">
        <span className="text-[10px] font-bold text-stone-300 tabular-nums pt-1 w-4 shrink-0 select-none">
          {num}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-serif text-stone-900 leading-snug mb-1">
            {title}
          </h2>
          <p className="text-sm text-stone-500 leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        </div>
      </div>
      <div className="pl-10">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("30d");

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/analytics?range=${range}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!json.ok) throw new Error(json.error ?? "Unknown error");
        setData({
          heatmap: json.heatmap ?? [],
          topVerses: json.topVerses ?? [],
          datasetInterest: json.datasetInterest ?? [],
          pageEngagement: json.pageEngagement ?? [],
          dailyTrend: json.dailyTrend ?? [],
        });
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [range]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-400 text-sm font-serif italic">Loading analytics...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-red-500 text-sm">Error: {error}</p>
      </div>
    );
  }

  // Check for empty data
  const isEmpty =
    !data ||
    (data.heatmap.length === 0 &&
      data.topVerses.length === 0 &&
      data.datasetInterest.length === 0 &&
      data.pageEngagement.length === 0 &&
      data.dailyTrend.length === 0);

  return (
    <main className="flex-1 bg-stone-50">
      <div className="max-w-5xl mx-auto px-6 lg:px-10 pb-24">

        {/* ---- Page header ---- */}
        <div className="pt-14 pb-10 border-b border-stone-200">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-3">
            Usage Analytics
          </p>
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <h1 className="text-3xl font-serif text-stone-900 leading-tight">
                How People Explore NT Commands
              </h1>
              <p className="text-stone-500 text-sm leading-relaxed max-w-xl mt-1.5">
                Anonymized, aggregated usage patterns showing which pages,
                verses, and datasets draw the most attention -- and when
                people visit.
              </p>
            </div>

            {/* Range toggle */}
            <div className="flex items-center gap-1.5 shrink-0">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all duration-150 ${
                    range === r.value
                      ? "bg-stone-800 text-white border-stone-800"
                      : "bg-white text-stone-400 border-stone-200 hover:text-stone-700 hover:border-stone-300"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---- Empty state ---- */}
        {isEmpty && (
          <div className="py-20 text-center">
            <p className="text-stone-400 text-sm">
              No analytics data yet — events will appear as users browse the app.
            </p>
          </div>
        )}

        {/* ---- Visualizations ---- */}
        {!isEmpty && (
          <>
            {/* 01 -- Activity Heatmap */}
            {data!.heatmap.length > 0 && (
              <VizSection
                num="01"
                title="When are users active?"
                subtitle="Hour-of-day by day-of-week heatmap. Warmer colours indicate more events in that time slot."
              >
                <ActivityHeatmap data={data!.heatmap} />
              </VizSection>
            )}

            {/* 02 -- Top Verses */}
            {data!.topVerses.length > 0 && (
              <VizSection
                num="02"
                title="Which verses draw the most attention?"
                subtitle="The 20 most-viewed verse references across all dataset pages, ordered by view count."
              >
                <TopVersesChart data={data!.topVerses} />
              </VizSection>
            )}

            {/* 03 -- Dataset Interest */}
            {data!.datasetInterest.length > 0 && (
              <VizSection
                num="03"
                title="How do users engage with each dataset?"
                subtitle="Event counts grouped by dataset and interaction type, revealing which datasets attract the most exploration."
              >
                <DatasetInterestChart data={data!.datasetInterest} />
              </VizSection>
            )}

            {/* 04 -- Page Engagement */}
            {data!.pageEngagement.length > 0 && (
              <VizSection
                num="04"
                title="Which pages see the most traffic?"
                subtitle="Total page-view events by route, sorted from most to least visited."
              >
                <PageEngagementChart data={data!.pageEngagement} />
              </VizSection>
            )}

            {/* 05 -- Daily Trend */}
            {data!.dailyTrend.length > 0 && (
              <VizSection
                num="05"
                title="How has activity trended over time?"
                subtitle="Daily event counts over the selected time window. Hover to inspect individual days."
              >
                <DailyTrendChart data={data!.dailyTrend} />
              </VizSection>
            )}
          </>
        )}

      </div>
    </main>
  );
}
