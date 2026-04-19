"use client";

// ---------------------------------------------------------------------------
// /admin/records — CRUD UI for the `records` Supabase table.
//
// Wrapped in <AdminGate>. The gated child fetches, filters, renders the
// list, and opens the RecordEditor in a slide-in panel on row click or
// when the user clicks "Add record".
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminGate, { useAdminToken } from "@/components/AdminGate";
import RecordEditor from "@/components/RecordEditor";
import type { NTRecord, Dataset } from "@/lib/types";
import { DATASET_COLORS, DATASET_COLORS_LIGHT, OT_ROOT_CATEGORIES } from "@/lib/constants";

export default function AdminRecordsPage() {
  return (
    <AdminGate
      title="Records editor"
      subtitle="Edit, add, or delete records in the NT command dataset."
    >
      <RecordsContent />
    </AdminGate>
  );
}

// ---------------------------------------------------------------------------

function RecordsContent() {
  const { token, lockOut } = useAdminToken();

  const [records, setRecords] = useState<NTRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Filters
  const [search,           setSearch]           = useState("");
  const [datasetFilter,    setDatasetFilter]    = useState<Dataset | "all">("all");
  const [otRootFilter,     setOtRootFilter]     = useState<"all" | "has" | "empty">("all");
  const [otCategoryFilter, setOtCategoryFilter] = useState<string>("");

  // Editor state
  const [editing, setEditing] = useState<NTRecord | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/records", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        lockOut();
        return;
      }
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || "Request failed");
      setRecords(body.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [token, lockOut]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // ---- Filter ----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (datasetFilter !== "all" && r.dataset !== datasetFilter) return false;
      if (otRootFilter === "has"   && !r.ot_root_category)         return false;
      if (otRootFilter === "empty" && !!r.ot_root_category)        return false;
      if (otCategoryFilter && r.ot_root_category !== otCategoryFilter) return false;
      if (!q) return true;
      return [r.ref, r.summary, r.category, r.theme, r.speaker]
        .some((v) => v?.toLowerCase?.().includes(q));
    });
  }, [records, search, datasetFilter, otRootFilter, otCategoryFilter]);

  // ---- Mutations ----
  async function saveEdit(patch: Partial<NTRecord>) {
    if (!editing) return;
    const res = await fetch("/api/admin/records", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify({ id: editing.id, patch }),
    });
    const body = await res.json();
    if (!res.ok || !body.ok) throw new Error(body.error || `HTTP ${res.status}`);
    setEditing(null);
    fetchRecords();
  }

  async function saveNew(row: Partial<NTRecord>) {
    const res = await fetch("/api/admin/records", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify({ record: row }),
    });
    const body = await res.json();
    if (!res.ok || !body.ok) throw new Error(body.error || `HTTP ${res.status}`);
    setCreating(false);
    fetchRecords();
  }

  async function deleteRecord() {
    if (!editing) return;
    const res = await fetch("/api/admin/records", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify({ id: editing.id }),
    });
    const body = await res.json();
    if (!res.ok || !body.ok) throw new Error(body.error || `HTTP ${res.status}`);
    setEditing(null);
    fetchRecords();
  }

  // ---- Stats for header ----
  const otRootCoverage = records.filter((r) => r.ot_root_category).length;

  return (
    <main className="flex-1 bg-stone-50 flex overflow-hidden" style={{ height: "calc(100vh - 3rem)" }}>
      {/* ── Main list ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 pb-12">
          {/* Header */}
          <div className="pt-10 pb-6 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2">
                Admin
              </p>
              <h1 className="text-3xl font-serif text-stone-900 leading-tight">Records</h1>
              <p className="text-sm text-stone-500 leading-relaxed mt-1">
                {records.length} total ·{" "}
                <span className="text-stone-700 font-medium">
                  {otRootCoverage}/{records.length}
                </span>{" "}
                with an OT root category
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCreating(true)}
                className="px-3 py-1.5 rounded bg-stone-800 text-white text-[12px] font-semibold hover:bg-stone-700 transition-colors"
              >
                + Add record
              </button>
              <button
                onClick={lockOut}
                className="text-[11px] text-stone-400 hover:text-stone-700 underline underline-offset-2"
              >
                Lock
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-end gap-4 pb-4 border-b border-stone-200 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5">
                Search
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ref, summary, theme…"
                className="w-full px-3 py-1.5 text-[12px] bg-white border border-stone-200 rounded text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400 transition-colors"
              />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5">Dataset</p>
              <div className="flex gap-1.5">
                {(["all", "A", "B", "D"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDatasetFilter(d)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${
                      datasetFilter === d
                        ? "bg-stone-800 text-white border-stone-800"
                        : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    {d === "all" ? "All" : d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5">OT root</p>
              <div className="flex gap-1.5">
                {(["all", "has", "empty"] as const).map((o) => (
                  <button
                    key={o}
                    onClick={() => setOtRootFilter(o)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${
                      otRootFilter === o
                        ? "bg-stone-800 text-white border-stone-800"
                        : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    {o === "all" ? "All" : o === "has" ? "Filled" : "Empty"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5">Category</p>
              <select
                value={otCategoryFilter}
                onChange={(e) => setOtCategoryFilter(e.target.value)}
                className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-stone-200 rounded text-stone-600 hover:border-stone-300 focus:outline-none focus:border-stone-400 transition-colors"
              >
                <option value="">All categories</option>
                {OT_ROOT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* List */}
          <div className="pt-4">
            {loading ? (
              <p className="text-stone-400 text-sm font-serif italic py-8 text-center">Loading…</p>
            ) : error ? (
              <p className="text-red-600 text-sm py-8 text-center">{error}</p>
            ) : filtered.length === 0 ? (
              <p className="text-stone-400 text-sm py-8 text-center">
                No records match these filters.
              </p>
            ) : (
              <>
                <p className="text-[11px] text-stone-400 mb-2">
                  Showing {filtered.length} of {records.length}
                </p>
                <ul className="divide-y divide-stone-200/60 bg-white border border-stone-200 rounded overflow-hidden">
                  {filtered.map((r) => {
                    const dsBg = DATASET_COLORS_LIGHT[r.dataset];
                    const dsFg = DATASET_COLORS[r.dataset];
                    return (
                      <li
                        key={r.id}
                        className="flex items-start gap-3 px-4 py-2.5 hover:bg-stone-50 cursor-pointer transition-colors"
                        onClick={() => setEditing(r)}
                      >
                        <span
                          className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tabular-nums"
                          style={{ backgroundColor: dsBg, color: dsFg }}
                        >
                          {r.dataset}
                        </span>
                        <span className="w-32 shrink-0 text-[12px] font-serif font-semibold text-stone-800 pt-px">
                          {r.ref}
                        </span>
                        <span className="flex-1 text-[11px] text-stone-500 line-clamp-1 pt-px">
                          {r.summary || (
                            <span className="italic text-stone-300">(no summary)</span>
                          )}
                        </span>
                        {r.ot_root_category ? (
                          <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                            {r.ot_root_category}
                          </span>
                        ) : (
                          <span className="shrink-0 text-[9px] text-stone-300 italic">
                            no OT root
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Slide-in editor ── */}
      {editing && (
        <aside className="w-[520px] shrink-0 border-l border-stone-200 bg-white flex flex-col overflow-hidden animate-[slideLeft_200ms_ease-out]">
          <RecordEditor
            record={editing}
            onSave={saveEdit}
            onClose={() => setEditing(null)}
            onDelete={deleteRecord}
          />
        </aside>
      )}

      {creating && (
        <aside className="w-[520px] shrink-0 border-l border-stone-200 bg-white flex flex-col overflow-hidden animate-[slideLeft_200ms_ease-out]">
          <RecordEditor
            record={{ dataset: "A" as Dataset, primary_record: true, commonly_cited: false }}
            isNew
            onSave={saveNew}
            onClose={() => setCreating(false)}
          />
        </aside>
      )}
    </main>
  );
}
