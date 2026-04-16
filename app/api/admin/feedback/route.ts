// ---------------------------------------------------------------------------
// /api/admin/feedback — token-protected admin endpoint for feedback management.
//
//   GET     — list feedback (filter by status & category, sort by date)
//   PATCH   — update status { id, status }
//   DELETE  — remove a row { id }
//
// Auth:
//   Requires `Authorization: Bearer <ADMIN_TOKEN>` header. ADMIN_TOKEN must
//   match the env var exactly. Returns 401 otherwise.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const ALLOWED_STATUSES   = new Set(["new", "read", "resolved"]);
const ALLOWED_CATEGORIES = new Set(["bug", "idea", "question"]);

function checkAuth(req: NextRequest): NextResponse | null {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_TOKEN not configured on the server" },
      { status: 503 },
    );
  }
  const header = req.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (provided !== token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET — list
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const authFail = checkAuth(req);
  if (authFail) return authFail;

  const { searchParams } = req.nextUrl;
  const status   = searchParams.get("status")   || "all";
  const category = searchParams.get("category") || "all";
  const order    = searchParams.get("order") === "asc" ? "asc" : "desc";

  let q = supabaseAdmin().from("feedback").select("*");

  if (status !== "all" && ALLOWED_STATUSES.has(status)) {
    q = q.eq("status", status);
  }
  if (category !== "all" && ALLOWED_CATEGORIES.has(category)) {
    q = q.eq("category", category);
  }

  const { data, error } = await q.order("created_at", { ascending: order === "asc" });

  if (error) {
    console.error("[admin/feedback] List error:", error.message);
    return NextResponse.json({ ok: false, error: "Query failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, feedback: data ?? [] });
}

// ---------------------------------------------------------------------------
// PATCH — update status
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const authFail = checkAuth(req);
  if (authFail) return authFail;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body.id === "number" ? body.id : Number(body.id);
  if (!id || !Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  const status = typeof body.status === "string" ? body.status : "";
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("feedback")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[admin/feedback] Update error:", error.message);
    return NextResponse.json({ ok: false, error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, feedback: data });
}

// ---------------------------------------------------------------------------
// DELETE — remove
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  const authFail = checkAuth(req);
  if (authFail) return authFail;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body.id === "number" ? body.id : Number(body.id);
  if (!id || !Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabaseAdmin().from("feedback").delete().eq("id", id);

  if (error) {
    console.error("[admin/feedback] Delete error:", error.message);
    return NextResponse.json({ ok: false, error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
