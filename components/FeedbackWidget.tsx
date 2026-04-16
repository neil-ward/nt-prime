"use client";

// ---------------------------------------------------------------------------
// FeedbackWidget — floating bottom-right button that opens a small panel
// for users to submit bugs, ideas, and questions.
//
// Hidden on /admin/* pages (you don't want the site owner submitting
// feedback to themselves while reviewing it).
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Category = "bug" | "idea" | "question";

const CATEGORIES: { value: Category; label: string; hint: string }[] = [
  { value: "bug",      label: "Bug",      hint: "Something isn't working right" },
  { value: "idea",     label: "Idea",     hint: "A feature or improvement" },
  { value: "question", label: "Question", hint: "Clarification or help" },
];

const MESSAGE_MAX = 2000;

export default function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen]         = useState(false);
  const [category, setCategory] = useState<Category>("bug");
  const [message, setMessage]   = useState("");
  const [email, setEmail]       = useState("");
  const [status, setStatus]     =
    useState<"idle" | "sending" | "success" | "error">("idle");
  const [error, setError]       = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Don't render on admin pages
  const isAdmin = pathname?.startsWith("/admin/") ?? false;

  // Focus textarea when panel opens
  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  if (isAdmin) return null;

  function reset() {
    setMessage("");
    setEmail("");
    setCategory("bug");
    setStatus("idle");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || status === "sending") return;

    setStatus("sending");
    setError(null);

    try {
      const session_id =
        typeof window !== "undefined"
          ? sessionStorage.getItem("nt_session_id")
          : null;

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: message.trim(),
          email:   email.trim() || undefined,
          page:    pathname,
          session_id,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok || !body.ok) {
        setStatus("error");
        setError(body.error || `HTTP ${res.status}`);
        return;
      }

      setStatus("success");
      // Close + reset shortly after success
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 1500);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Network error");
    }
  }

  return (
    <>
      {/* ── Floating button ─────────────────────────────────────────────── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full bg-stone-800 text-white text-[12px] font-medium shadow-lg hover:bg-stone-700 hover:shadow-xl transition-all duration-150"
          title="Send feedback"
          aria-label="Send feedback"
        >
          {/* Chat bubble icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Feedback
        </button>
      )}

      {/* ── Expanded panel ──────────────────────────────────────────────── */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-80 bg-white rounded-lg shadow-2xl border border-stone-200 overflow-hidden animate-[slideUp_200ms_ease-out]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-stone-200">
            <h3 className="text-[13px] font-serif font-semibold text-stone-900">
              Send feedback
            </h3>
            <button
              onClick={() => { setOpen(false); reset(); }}
              className="text-stone-300 hover:text-stone-600 transition-colors text-base leading-none"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          {/* Success state */}
          {status === "success" ? (
            <div className="px-4 py-8 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 mb-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-[13px] font-medium text-stone-800">Thanks — sent!</p>
              <p className="text-[11px] text-stone-400 mt-1">
                I&rsquo;ll review your message soon.
              </p>
            </div>
          ) : (
            /* Form */
            <form onSubmit={submit} className="px-4 py-3 space-y-3">
              {/* Category pills */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5">
                  Type
                </label>
                <div className="flex gap-1.5">
                  {CATEGORIES.map((c) => {
                    const active = c.value === category;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setCategory(c.value)}
                        className={`flex-1 px-2.5 py-1.5 rounded text-[11px] font-semibold border transition-all ${
                          active
                            ? "bg-stone-800 text-white border-stone-800"
                            : "bg-white text-stone-500 border-stone-200 hover:border-stone-300 hover:text-stone-700"
                        }`}
                        title={c.hint}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message */}
              <div>
                <label htmlFor="fb-message" className="block text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5">
                  Message
                </label>
                <textarea
                  id="fb-message"
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
                  placeholder="What's on your mind?"
                  rows={4}
                  className="w-full px-2.5 py-1.5 text-[12px] bg-stone-50 border border-stone-200 rounded text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400 focus:bg-white transition-colors resize-none"
                />
                <p className="text-[10px] text-stone-300 mt-0.5 text-right">
                  {message.length}/{MESSAGE_MAX}
                </p>
              </div>

              {/* Email (optional) */}
              <div>
                <label htmlFor="fb-email" className="block text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5">
                  Email <span className="text-stone-300 normal-case tracking-normal">(optional)</span>
                </label>
                <input
                  id="fb-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-2.5 py-1.5 text-[12px] bg-stone-50 border border-stone-200 rounded text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400 focus:bg-white transition-colors"
                />
              </div>

              <p className="text-[10px] text-stone-400 italic leading-snug">
                Your current page and an anonymous session ID will be included so I can reproduce bugs.
              </p>

              {error && (
                <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1.5">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!message.trim() || status === "sending"}
                className="w-full px-3 py-2 rounded bg-stone-800 text-white text-[12px] font-semibold hover:bg-stone-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors"
              >
                {status === "sending" ? "Sending…" : "Send feedback"}
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
