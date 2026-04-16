// ---------------------------------------------------------------------------
// POST /api/feedback — accept user feedback from the floating widget.
//
// Body:
//   { category: 'bug'|'idea'|'question', message: string,
//     email?: string, page?: string, session_id?: string }
//
// Inserts into the `feedback` table via the service-role Supabase client.
// Light per-IP rate limiting (5 / minute) to deter form spam.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const ALLOWED_CATEGORIES = new Set(["bug", "idea", "question"]);

const MESSAGE_MIN = 1;
const MESSAGE_MAX = 2000;
const EMAIL_MAX   = 200;

// Simple "looks like an email" regex — not RFC-perfect; just catches typos
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// In-memory per-IP rate limit
// ---------------------------------------------------------------------------

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 5;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // Get IP for rate limiting. Netlify forwards via x-forwarded-for.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (!rateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many submissions — please wait a minute." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Validate category
  const category = typeof body.category === "string" ? body.category : "";
  if (!ALLOWED_CATEGORIES.has(category)) {
    return NextResponse.json(
      { ok: false, error: "Invalid category" },
      { status: 400 },
    );
  }

  // Validate message
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < MESSAGE_MIN || message.length > MESSAGE_MAX) {
    return NextResponse.json(
      { ok: false, error: `Message must be ${MESSAGE_MIN}–${MESSAGE_MAX} characters` },
      { status: 400 },
    );
  }

  // Optional email
  let email: string | null = null;
  if (typeof body.email === "string" && body.email.trim()) {
    const trimmed = body.email.trim().slice(0, EMAIL_MAX);
    if (!EMAIL_RE.test(trimmed)) {
      return NextResponse.json(
        { ok: false, error: "Email doesn't look valid" },
        { status: 400 },
      );
    }
    email = trimmed;
  }

  // Optional page, session_id
  const page = typeof body.page === "string" ? body.page.slice(0, 200) : null;
  const session_id =
    typeof body.session_id === "string" ? body.session_id.slice(0, 64) : null;
  const user_agent = (req.headers.get("user-agent") || "").slice(0, 500) || null;

  const { error } = await supabaseAdmin()
    .from("feedback")
    .insert({ category, message, email, page, session_id, user_agent });

  if (error) {
    console.error("[feedback] Insert error:", error.message);
    return NextResponse.json(
      { ok: false, error: "Could not save feedback" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
