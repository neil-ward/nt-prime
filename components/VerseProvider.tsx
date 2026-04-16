"use client";

// ---------------------------------------------------------------------------
// VerseProvider — app-wide context for opening verse-text modals.
//
// Responsibilities:
//   - Tracks the currently open ref (if any)
//   - Owns the user's preferred Bible version (localStorage-persisted)
//   - Renders <VerseModal> when a ref is open
//
// Usage:
//   const { openVerse, version, setVersion } = useVerse();
// ---------------------------------------------------------------------------

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import VerseModal from "@/components/VerseModal";
import {
  DEFAULT_VERSION,
  getPreferredVersion,
  setPreferredVersion,
  type VersionKey,
} from "@/lib/youversion";

interface VerseContextValue {
  openVerse:  (ref: string) => void;
  closeVerse: () => void;
  version:    VersionKey;
  setVersion: (v: VersionKey) => void;
}

const VerseContext = createContext<VerseContextValue>({
  openVerse:  () => {},
  closeVerse: () => {},
  version:    DEFAULT_VERSION,
  setVersion: () => {},
});

export function useVerse() {
  return useContext(VerseContext);
}

export default function VerseProvider({ children }: { children: React.ReactNode }) {
  const [activeRef, setActiveRef] = useState<string | null>(null);
  const [version, setVersionState] = useState<VersionKey>(DEFAULT_VERSION);

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    setVersionState(getPreferredVersion());
  }, []);

  const openVerse = useCallback((ref: string) => {
    setActiveRef(ref);
  }, []);

  const closeVerse = useCallback(() => {
    setActiveRef(null);
  }, []);

  const setVersion = useCallback((v: VersionKey) => {
    setVersionState(v);
    setPreferredVersion(v);
  }, []);

  return (
    <VerseContext.Provider value={{ openVerse, closeVerse, version, setVersion }}>
      {children}
      {activeRef && (
        <VerseModal
          ref_={activeRef}
          version={version}
          onVersionChange={setVersion}
          onClose={closeVerse}
        />
      )}
    </VerseContext.Provider>
  );
}
