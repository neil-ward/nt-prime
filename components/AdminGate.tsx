"use client";

// ---------------------------------------------------------------------------
// AdminGate — wrap admin-only content with a shared token gate.
//
// Usage:
//   <AdminGate title="Q2 Review">
//     <YourRestrictedContent />
//   </AdminGate>
//
// Anything nested can also call useAdminToken() to retrieve the unlocked
// token (for authenticated fetch calls) or lockOut() to clear it.
//
// Verification:
//   The component calls GET /api/admin/verify on mount with the stored
//   token; if it 401s the token is cleared and the user is re-prompted.
//   Unlock also verifies before accepting the input.
// ---------------------------------------------------------------------------

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const TOKEN_KEY = "nt_admin_token";

// ---------------------------------------------------------------------------
// Context — exposes the current token and a lockOut helper to children.
// ---------------------------------------------------------------------------

interface AdminContextValue {
  token:   string;
  lockOut: () => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdminToken(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error("useAdminToken must be used inside an <AdminGate>");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Verify helper
// ---------------------------------------------------------------------------

async function verify(token: string): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/verify", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AdminGateProps {
  title?:    string;
  subtitle?: string;
  children:  React.ReactNode;
}

export default function AdminGate({
  title    = "Admin access",
  subtitle = "Enter the admin token to view this page.",
  children,
}: AdminGateProps) {
  const [token,      setToken]      = useState<string | null>(null);
  const [input,      setInput]      = useState("");
  const [hydrated,   setHydrated]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // On mount: read stored token, verify it's still valid. If not, clear.
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setHydrated(true);
      return;
    }
    verify(stored).then((ok) => {
      if (ok) {
        setToken(stored);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
      setHydrated(true);
    });
  }, []);

  const lockOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setInput("");
    setError(null);
  }, []);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    const t = input.trim();
    if (!t || submitting) return;
    setSubmitting(true);
    setError(null);
    const ok = await verify(t);
    if (ok) {
      localStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      setInput("");
    } else {
      setError("Invalid token");
    }
    setSubmitting(false);
  }

  // Before hydration we render nothing to avoid flashing the gate for
  // users whose token is already valid.
  if (!hydrated) return null;

  if (!token) {
    return (
      <main className="flex-1 flex items-center justify-center bg-stone-50 px-6">
        <form onSubmit={unlock} className="w-full max-w-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-3">
            Admin access
          </p>
          <h1 className="text-2xl font-serif text-stone-900 leading-tight mb-2">
            {title}
          </h1>
          <p className="text-sm text-stone-500 leading-relaxed mb-5">
            {subtitle}
          </p>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Token"
            autoFocus
            className="w-full px-3 py-2 text-[13px] bg-white border border-stone-300 rounded text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-500 transition-colors"
          />
          {error && (
            <p className="text-[11px] text-red-600 mt-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={!input.trim() || submitting}
            className="w-full mt-3 px-4 py-2 rounded bg-stone-800 text-white text-[13px] font-semibold hover:bg-stone-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Checking…" : "Unlock"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <AdminContext.Provider value={{ token, lockOut }}>
      {children}
    </AdminContext.Provider>
  );
}
