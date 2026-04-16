"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "./analytics";

/** Tracks a `page_view` event once per route change. */
export function usePageView() {
  const pathname = usePathname();
  useEffect(() => {
    track("page_view", { page: pathname });
  }, [pathname]);
}
