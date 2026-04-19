// ---------------------------------------------------------------------------
// /api/admin/records — token-protected CRUD for the `records` table.
//
//   GET    — list all records (bypasses cache)
//   POST   — create a new record { record: Partial<NTRecord> }
//   PATCH  — update a record { id, patch: Partial<NTRecord> }
//   DELETE — remove a record { id }
//
// Auth: Authorization: Bearer <ADMIN_TOKEN>
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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
// Allowlisted columns the admin UI is permitted to write.
// Bookkeeping fields (id, created_at, updated_at) are excluded so the client
// can't spoof them; updated_at is bumped by the DB trigger.
// ---------------------------------------------------------------------------

const WRITABLE = new Set<string>([
  "book", "chapter", "verse_range", "ref", "url",
  "dataset", "dataset_label", "nt_section", "category", "category_code",
  "theme", "subtheme",
  "literary_context", "passage_type", "passage_type_group",
  "command_strength", "command_strength_group",
  "speaker", "speaker_group", "audience",
  "parallel_passages", "parallel_id", "primary_record",
  "gk_keywords", "ot_antecedent", "summary", "interpretive_notes",
  "ot_root_category", "ot_root_notes",
  "commonly_cited",
  "q2_crg", "q2_pfs", "q2_uca", "q2_ic", "q2_mca",
  "q2_typical_application", "q2_consistency_rating", "q2_notes",
]);

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    if (WRITABLE.has(k)) out[k] = obj[k];
  }
  return out;
}

// ---------------------------------------------------------------------------
// GET — list
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const authFail = checkAuth(req);
  if (authFail) return authFail;

  const { data, error } = await supabaseAdmin()
    .from("records")
    .select("*")
    .order("book",    { ascending: true })
    .order("chapter", { ascending: true })
    .order("dataset", { ascending: true });

  if (error) {
    console.error("[admin/records] List error:", error.message);
    return NextResponse.json({ ok: false, error: "Query failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, records: data ?? [] });
}

// ---------------------------------------------------------------------------
// POST — create
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const authFail = checkAuth(req);
  if (authFail) return authFail;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const row = sanitize((body.record ?? body) as Record<string, unknown>);

  // Basic required checks
  if (!row.book || !row.chapter || !row.verse_range || !row.ref || !row.dataset) {
    return NextResponse.json(
      { ok: false, error: "Required: book, chapter, verse_range, ref, dataset" },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin()
    .from("records")
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error("[admin/records] Insert error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, record: data });
}

// ---------------------------------------------------------------------------
// PATCH — update
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const authFail = checkAuth(req);
  if (authFail) return authFail;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const id = typeof body.id === "number" ? body.id : Number(body.id);
  if (!id || !Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  const patch = sanitize((body.patch ?? {}) as Record<string, unknown>);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "No writable fields in patch" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("records")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[admin/records] Update error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, record: data });
}

// ---------------------------------------------------------------------------
// DELETE — remove
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  const authFail = checkAuth(req);
  if (authFail) return authFail;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const id = typeof body.id === "number" ? body.id : Number(body.id);
  if (!id || !Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabaseAdmin().from("records").delete().eq("id", id);

  if (error) {
    console.error("[admin/records] Delete error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
