"use client";

import { usePageView } from "@/lib/usePageView";

/**
 * Thin client wrapper that enables automatic page-view tracking.
 * Placed inside layout.tsx (which is a Server Component).
 */
export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  usePageView();
  return <>{children}</>;
}
