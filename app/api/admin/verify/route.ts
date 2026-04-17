// ---------------------------------------------------------------------------
// GET /api/admin/verify — lightweight bearer-token check.
//
// Returns 200 if `Authorization: Bearer <token>` matches ADMIN_TOKEN.
// Returns 401 otherwise. No body payload, no data access.
//
// Used by <AdminGate> on admin-only pages to confirm the stored token is
// still valid before rendering gated content.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
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
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
