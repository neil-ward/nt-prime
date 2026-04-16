"use client";

// ---------------------------------------------------------------------------
// /admin/feedback — private dashboard for reviewing user feedback.
//
// Auth: a single bearer token stored in localStorage under nt_admin_token.
// First-time visitors see a password prompt; the token is sent as
// Authorization: Bearer <token> on every admin API call.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";

interface FeedbackRow {
  id:         number;
  category:   "bug" | "idea" | "question";
  message:    string;
  email:      string | null;
  page:       string | null;
  user_agent: string | null;
  session_id: string | null;
  status:     "new" | "read" | "resolved";
  created_at: string;
}

type StatusFilter   = "all" | "new" | "read" | "resolved";
type CategoryFilter = "all" | "bug" | "idea" | "question";
type Sort           = "desc" | "asc";

const CATEGORY_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  bug:      { bg: "#fef2f2", fg: "#b91c1c", label: "Bug" },
  idea:     { bg: "#eff6ff", fg: "#1d4ed8", label: "Idea" },
  question: { bg: "#fef3c7", fg: "#92400e", label: "Question" },
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  new:      { bg: "#ecfdf5", fg: "#047857", label: "New" },
  read:     { bg: "#f5f5f4", fg: "#78716c", label: "Read" },
  resolved: { bg: "#f0f9ff", fg: "#0369a1", label: "Resolved" },
};

const TOKEN_KEY = "nt_admin_token";

function relative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec  = Math.floor(diff / 1000);
  if (sec < 60)   return `${sec}s ago`;
  const min  = Math.floor(sec / 60);
  if (min < 60)   return `${min} min ago`;
  const hr   = Math.floor(min / 60);
  if (hr < 24)    return `${hr} hr ago`;
  const day  = Math.floor(hr / 24);
  if (day < 30)   return `${day} day${day !== 1 ? "s" : ""} ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function AdminFeedbackPage() {
  const [token,   setToken]   = useState<string | null>(null);
  const [input,   setInput]   = useState("");
  const [rows,    setRows]    = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sort,           setSort]           = useState<Sort>("desc");

  // Hydrate token from localStorage once
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) setToken(stored);
  }, []);

  const fetchRows = useCallback(async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status:   statusFilter,
        category: categoryFilter,
        order:    sort,
      });
      const res = await fetch(`/api/admin/feedback?${params}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setError("Token rejected. Please enter a valid token.");
        return;
      }
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || "Request failed");
      setRows(body.feedback);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, sort]);

  // Refetch when filters change (if authorized)
  useEffect(() => {
    if (token) fetchRows(token);
  }, [token, fetchRows]);

  function unlock(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    localStorage.setItem(TOKEN_KEY, trimmed);
    setToken(trimmed);
    setInput("");
  }

  function lockOut() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setRows([]);
  }

  async function updateStatus(id: number, status: FeedbackRow["status"]) {
    if (!token) return;
    await fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id, status }),
    });
    fetchRows(token);
  }

  async function deleteRow(id: number) {
    if (!token) return;
    if (!confirm("Delete this feedback? This can't be undone.")) return;
    await fetch("/api/admin/feedback", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id }),
    });
    fetchRows(token);
  }

  // ────────────────────────────────────────────────────────────────────
  // Token gate
  // ────────────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <main className="flex-1 flex items-center justify-center bg-stone-50 px-6">
        <form onSubmit={unlock} className="w-full max-w-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-3">
            Admin access
          </p>
          <h1 className="text-2xl font-serif text-stone-900 leading-tight mb-2">
            Feedback dashboard
          </h1>
          <p className="text-sm text-stone-500 leading-relaxed mb-5">
            Enter the admin token to view submitted feedback.
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
            className="w-full mt-3 px-4 py-2 rounded bg-stone-800 text-white text-[13px] font-semibold hover:bg-stone-700 transition-colors"
          >
            Unlock
          </button>
        </form>
      </main>
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // Dashboard
  // ────────────────────────────────────────────────────────────────────
  const newCount = rows.filter((r) => r.status === "new").length;

  return (
    <main className="flex-1 bg-stone-50">
      <div className="max-w-4xl mx-auto px-6 lg:px-10 pb-20">
        {/* Header */}
        <div className="pt-12 pb-8">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2">
                Admin
              </p>
              <h1 className="text-3xl font-serif text-stone-900 leading-tight">
                User feedback
              </h1>
              <p className="text-sm text-stone-500 leading-relaxed mt-1">
                {rows.length} total
                {newCount > 0 && (
                  <span className="ml-2 text-emerald-600 font-semibold">
                    · {newCount} new
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={lockOut}
              className="text-[11px] text-stone-400 hover:text-stone-700 underline underline-offset-2"
            >
              Lock
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-start gap-6 flex-wrap pb-6 border-b border-stone-200">
          {/* Status */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5">Status</p>
            <div className="flex gap-1.5">
              {(["all", "new", "read", "resolved"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${
                    statusFilter === s
                      ? "bg-stone-800 text-white border-stone-800"
                      : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"
                  }`}
                >
                  {s === "all" ? "All" : STATUS_STYLE[s].label}
                </button>
              ))}
            </div>
          </div>
          {/* Category */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5">Category</p>
            <div className="flex gap-1.5">
              {(["all", "bug", "idea", "question"] as CategoryFilter[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(c)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${
                    categoryFilter === c
                      ? "bg-stone-800 text-white border-stone-800"
                      : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"
                  }`}
                >
                  {c === "all" ? "All" : CATEGORY_STYLE[c].label}
                </button>
              ))}
            </div>
          </div>
          {/* Sort */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5">Sort</p>
            <div className="flex gap-1.5">
              {(["desc", "asc"] as Sort[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${
                    sort === s
                      ? "bg-stone-800 text-white border-stone-800"
                      : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"
                  }`}
                >
                  {s === "desc" ? "Newest" : "Oldest"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="py-6">
          {loading ? (
            <p className="text-stone-400 text-sm font-serif italic py-8 text-center">
              Loading…
            </p>
          ) : error ? (
            <p className="text-red-600 text-sm py-8 text-center">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-stone-400 text-sm py-8 text-center">
              No feedback matches the current filters.
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => {
                const cat = CATEGORY_STYLE[r.category];
                const st  = STATUS_STYLE[r.status];
                return (
                  <li
                    key={r.id}
                    className="bg-white border border-stone-200 rounded-md p-4 shadow-sm"
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
                          style={{ backgroundColor: cat.bg, color: cat.fg }}
                        >
                          {cat.label}
                        </span>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold"
                          style={{ backgroundColor: st.bg, color: st.fg }}
                        >
                          {st.label}
                        </span>
                        <span className="text-[11px] text-stone-400">
                          {relative(r.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Message */}
                    <p className="text-[13px] text-stone-800 leading-relaxed whitespace-pre-wrap mb-2.5">
                      {r.message}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-[11px] text-stone-400 flex-wrap mb-3">
                      {r.page && (
                        <span>
                          Page:{" "}
                          <code className="font-mono bg-stone-50 border border-stone-200 px-1 rounded">
                            {r.page}
                          </code>
                        </span>
                      )}
                      {r.email && (
                        <span>
                          Email:{" "}
                          <a
                            href={`mailto:${r.email}`}
                            className="text-stone-600 hover:text-stone-900 underline underline-offset-2"
                          >
                            {r.email}
                          </a>
                        </span>
                      )}
                      {r.session_id && (
                        <span title={r.session_id}>
                          Session: {r.session_id.slice(0, 8)}…
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 pt-2.5 border-t border-stone-100">
                      {r.status !== "read" && (
                        <button
                          onClick={() => updateStatus(r.id, "read")}
                          className="px-2 py-1 rounded text-[10px] font-semibold border border-stone-200 text-stone-500 hover:text-stone-800 hover:border-stone-400 transition-colors"
                        >
                          Mark read
                        </button>
                      )}
                      {r.status !== "resolved" && (
                        <button
                          onClick={() => updateStatus(r.id, "resolved")}
                          className="px-2 py-1 rounded text-[10px] font-semibold border border-stone-200 text-stone-500 hover:text-stone-800 hover:border-stone-400 transition-colors"
                        >
                          Mark resolved
                        </button>
                      )}
                      {r.status !== "new" && (
                        <button
                          onClick={() => updateStatus(r.id, "new")}
                          className="px-2 py-1 rounded text-[10px] font-semibold border border-stone-200 text-stone-500 hover:text-stone-800 hover:border-stone-400 transition-colors"
                        >
                          Reopen
                        </button>
                      )}
                      <button
                        onClick={() => deleteRow(r.id)}
                        className="ml-auto px-2 py-1 rounded text-[10px] font-semibold border border-red-100 text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
