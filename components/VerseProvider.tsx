"use client";

/**
 * VerseProvider — app-wide context for opening verse text modals.
 *
 * Wrap the app with <VerseProvider> in layout.tsx, then any component
 * can call:
 *
 *   const { openVerse } = useVerse();
 *   <span onClick={() => openVerse("Matt 5:42")} className="cursor-pointer">
 *     Matt 5:42
 *   </span>
 *
 * Only one modal is shown at a time. Opening a new ref replaces the old one.
 */

import { createContext, useCallback, useContext, useState } from "react";
import VerseModal from "@/components/VerseModal";

interface VerseContextValue {
  openVerse: (ref: string) => void;
  closeVerse: () => void;
}

const VerseContext = createContext<VerseContextValue>({
  openVerse: () => {},
  closeVerse: () => {},
});

export function useVerse() {
  return useContext(VerseContext);
}

export default function VerseProvider({ children }: { children: React.ReactNode }) {
  const [activeRef, setActiveRef] = useState<string | null>(null);

  const openVerse = useCallback((ref: string) => {
    setActiveRef(ref);
  }, []);

  const closeVerse = useCallback(() => {
    setActiveRef(null);
  }, []);

  return (
    <VerseContext.Provider value={{ openVerse, closeVerse }}>
      {children}
      {activeRef && <VerseModal ref_={activeRef} onClose={closeVerse} />}
    </VerseContext.Provider>
  );
}
