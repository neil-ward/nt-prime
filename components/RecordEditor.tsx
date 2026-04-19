"use client";

// ---------------------------------------------------------------------------
// RecordEditor — reusable form for viewing/editing an NTRecord.
//
// Used by the /admin/records page. Emits `onSave(patch)` with the diffed
// fields so the API's PATCH only sends what actually changed.
// ---------------------------------------------------------------------------

import { useMemo, useState } from "react";
import type { NTRecord } from "@/lib/types";
import { OT_ROOT_CATEGORIES } from "@/lib/constants";

interface RecordEditorProps {
  /** The record to edit. Pass a blank stub for "Add new". */
  record:  Partial<NTRecord>;
  /** Whether this is a new (unsaved) record. */
  isNew?:  boolean;
  onSave:  (patch: Partial<NTRecord>) => Promise<void>;
  onClose: () => void;
  onDelete?: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Field definitions — grouped into sections for rendering.
// ---------------------------------------------------------------------------

type FieldType = "text" | "textarea" | "bool" | "select" | "select-or-other";

interface FieldDef {
  key:      keyof NTRecord;
  label:    string;
  type:     FieldType;
  options?: readonly string[];   // for select / select-or-other
  hint?:    string;
}

const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Identity",
    fields: [
      { key: "book",         label: "Book",         type: "text" },
      { key: "chapter",      label: "Chapter",      type: "text" },
      { key: "verse_range",  label: "Verse range",  type: "text", hint: "e.g. \"42\" or \"4-7\"" },
      { key: "ref",          label: "Ref",          type: "text", hint: "e.g. \"Matt 5:42\"" },
      { key: "url",          label: "URL",          type: "text" },
    ],
  },
  {
    title: "Classification",
    fields: [
      { key: "dataset",       label: "Dataset",       type: "select", options: ["A", "B", "D"] },
      { key: "dataset_label", label: "Dataset label", type: "text" },
      { key: "nt_section",    label: "NT section",    type: "select",
        options: ["Gospels", "Acts", "Pauline Epistles", "General Epistles", "Revelation"] },
      { key: "category",      label: "Category",      type: "text" },
      { key: "category_code", label: "Category code", type: "text" },
      { key: "theme",         label: "Theme",         type: "text" },
      { key: "subtheme",      label: "Subtheme",      type: "text" },
    ],
  },
  {
    title: "Context",
    fields: [
      { key: "literary_context",       label: "Literary context",       type: "textarea" },
      { key: "passage_type",           label: "Passage type",           type: "text" },
      { key: "passage_type_group",     label: "Passage type group",     type: "text" },
      { key: "command_strength",       label: "Command strength",       type: "text" },
      { key: "command_strength_group", label: "Command strength group", type: "select",
        options: ["Explicit Command", "Direct Imperative", "Implicit Command", "Implied Command", "Warning", "Narrative Example"] },
    ],
  },
  {
    title: "Attribution",
    fields: [
      { key: "speaker",       label: "Speaker",       type: "text" },
      { key: "speaker_group", label: "Speaker group", type: "select",
        options: ["Jesus", "Paul", "Peter", "John", "James", "Hebrews", "John the Baptist", "Jude", "Other"] },
      { key: "audience",      label: "Audience",      type: "text" },
    ],
  },
  {
    title: "Scholarly apparatus",
    fields: [
      { key: "summary",            label: "Summary",            type: "textarea" },
      { key: "interpretive_notes", label: "Interpretive notes", type: "textarea" },
      { key: "gk_keywords",        label: "Greek keywords",     type: "text" },
      { key: "ot_antecedent",      label: "OT antecedent",      type: "textarea" },
      { key: "parallel_passages",  label: "Parallel passages",  type: "text" },
      { key: "parallel_id",        label: "Parallel id",        type: "text" },
      { key: "primary_record",     label: "Primary record",     type: "bool" },
      { key: "commonly_cited",     label: "SBC commonly cited", type: "bool" },
    ],
  },
  {
    title: "OT / ANE ethical root",
    fields: [
      { key: "ot_root_category", label: "OT root category", type: "select-or-other",
        options: OT_ROOT_CATEGORIES,
        hint: "Pick the dominant OT/ANE register, or choose Other… for edge cases." },
      { key: "ot_root_notes",    label: "OT root notes",    type: "textarea",
        hint: "Historical/ANE reasoning — why the OT root differs from the surface reading (e.g. boundary-stone rule = Justice & Mercy, because it protected weaker neighbors from land-fraud)" },
    ],
  },
  {
    title: "Q2 consistency (Dataset D only)",
    fields: [
      { key: "q2_crg",                 label: "CRG — Congregational/Role Guidance", type: "select", options: ["", "Y", "P", "N"] },
      { key: "q2_pfs",                 label: "PFS — Preached From the Pulpit",     type: "select", options: ["", "Y", "P", "N"] },
      { key: "q2_uca",                 label: "UCA — Used in Church Accountability", type: "select", options: ["", "Y", "P", "N"] },
      { key: "q2_ic",                  label: "IC — Institutional Consistency",      type: "select", options: ["", "Y", "P", "N"] },
      { key: "q2_mca",                 label: "MCA — Ministerial/Cultural Acceptance", type: "select", options: ["", "Y", "P", "N"] },
      { key: "q2_consistency_rating",  label: "Overall rating", type: "select",
        options: ["", "CONSISTENT", "PARTIALLY CONSISTENT", "SELECTIVE", "INCONSISTENT"] },
      { key: "q2_typical_application", label: "Typical application", type: "textarea" },
      { key: "q2_notes",               label: "Q2 notes",            type: "textarea" },
    ],
  },
];

// ---------------------------------------------------------------------------

export default function RecordEditor({
  record, isNew = false, onSave, onClose, onDelete,
}: RecordEditorProps) {
  const initial = useMemo(() => ({ ...record }), [record]);
  const [draft,  setDraft]   = useState<Partial<NTRecord>>({ ...initial });
  const [saving, setSaving]  = useState(false);
  const [error,  setError]   = useState<string | null>(null);

  function update<K extends keyof NTRecord>(key: K, value: NTRecord[K] | string | null) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  // Compute patch = fields in draft that differ from initial.
  const patch = useMemo(() => {
    const p: Record<string, unknown> = {};
    for (const key of Object.keys(draft)) {
      const k = key as keyof NTRecord;
      if (draft[k] !== initial[k]) p[k] = draft[k];
    }
    return p;
  }, [draft, initial]);

  const hasChanges = Object.keys(patch).length > 0;

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(isNew ? draft : patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!onDelete || saving) return;
    if (!confirm(`Delete "${record.ref}"? This can't be undone.`)) return;
    setSaving(true);
    setError(null);
    try {
      await onDelete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setSaving(false);
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-none px-5 py-3 border-b border-stone-200 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
            {isNew ? "New record" : `Edit · id ${record.id}`}
          </p>
          <h2 className="text-[15px] font-serif font-semibold text-stone-900 truncate">
            {draft.ref || "(untitled)"}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-stone-300 hover:text-stone-600 transition-colors text-lg leading-none"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-3">
              {s.title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              {s.fields.map((f) => (
                <Field
                  key={f.key}
                  def={f}
                  value={draft[f.key] as unknown}
                  onChange={(v) => update(f.key, v as never)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Footer */}
      <div className="flex-none px-5 py-3 border-t border-stone-200 bg-stone-50/60">
        {error && (
          <p className="text-[11px] text-red-600 mb-2 bg-red-50 border border-red-100 rounded px-2 py-1">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving || (!isNew && !hasChanges)}
            className="px-4 py-1.5 rounded bg-stone-800 text-white text-[12px] font-semibold hover:bg-stone-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : isNew ? "Create record" : "Save changes"}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 rounded text-[12px] font-medium text-stone-500 hover:text-stone-800 transition-colors"
          >
            Cancel
          </button>
          {!isNew && onDelete && (
            <button
              onClick={remove}
              disabled={saving}
              className="ml-auto px-3 py-1.5 rounded text-[12px] font-semibold border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
        {hasChanges && !isNew && (
          <p className="text-[10px] text-stone-400 mt-1.5">
            {Object.keys(patch).length} field{Object.keys(patch).length !== 1 ? "s" : ""} changed
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field — renders a single input based on its FieldDef.
// ---------------------------------------------------------------------------

function Field({
  def, value, onChange,
}: {
  def:      FieldDef;
  value:    unknown;
  onChange: (v: unknown) => void;
}) {
  const v = value as string | boolean | null | undefined;
  const displayValue = v == null ? "" : String(v);
  const isWide = def.type === "textarea";

  return (
    <label className={`flex flex-col gap-1 ${isWide ? "sm:col-span-2" : ""}`}>
      <span className="text-[10px] font-semibold text-stone-500">
        {def.label}
      </span>
      {def.type === "textarea" ? (
        <textarea
          value={displayValue}
          onChange={(e) => onChange(e.target.value || null)}
          rows={3}
          className="w-full px-2 py-1.5 text-[12px] bg-stone-50 border border-stone-200 rounded text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400 focus:bg-white transition-colors resize-y"
        />
      ) : def.type === "select" ? (
        <select
          value={displayValue}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full px-2 py-1.5 text-[12px] bg-stone-50 border border-stone-200 rounded text-stone-800 focus:outline-none focus:border-stone-400 focus:bg-white transition-colors"
        >
          {def.options!.map((opt) => (
            <option key={opt} value={opt}>{opt || "—"}</option>
          ))}
        </select>
      ) : def.type === "select-or-other" ? (
        <SelectOrOther
          value={displayValue}
          options={def.options!}
          onChange={onChange}
        />
      ) : def.type === "bool" ? (
        <div className="flex items-center gap-2 h-[30px]">
          <input
            type="checkbox"
            checked={!!v}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-[11px] text-stone-500">{v ? "true" : "false"}</span>
        </div>
      ) : (
        <input
          type="text"
          value={displayValue}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full px-2 py-1.5 text-[12px] bg-stone-50 border border-stone-200 rounded text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400 focus:bg-white transition-colors"
        />
      )}
      {def.hint && <span className="text-[9px] text-stone-400 italic">{def.hint}</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// SelectOrOther — dropdown + free-text escape hatch.
//
// Renders a <select> with the predefined options plus an "Other…" item.
// If the current value doesn't match any option, the widget remembers that
// "Other" is selected and shows the text input below so the user can read
// and edit the custom value. Picking a predefined option from the dropdown
// hides the text input and updates the saved value to the selected option.
// ---------------------------------------------------------------------------

const OTHER = "__other__";

function SelectOrOther({
  value, options, onChange,
}: {
  value:    string;
  options:  readonly string[];
  onChange: (v: string | null) => void;
}) {
  const isInList = !value || options.includes(value as (typeof options)[number]);
  // "Other" mode is active when we have a value that's not in the list.
  const [otherMode, setOtherMode] = useState(!isInList && !!value);

  function handleSelectChange(next: string) {
    if (next === OTHER) {
      setOtherMode(true);
      // Keep current value if it's already a custom string; otherwise blank
      // it so the user types a new one.
      if (isInList) onChange(null);
    } else {
      setOtherMode(false);
      onChange(next || null);
    }
  }

  const selectValue = otherMode ? OTHER : value;

  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={selectValue}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="w-full px-2 py-1.5 text-[12px] bg-stone-50 border border-stone-200 rounded text-stone-800 focus:outline-none focus:border-stone-400 focus:bg-white transition-colors"
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
        <option value={OTHER}>Other…</option>
      </select>
      {otherMode && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="Custom category"
          autoFocus
          className="w-full px-2 py-1.5 text-[12px] bg-amber-50 border border-amber-200 rounded text-stone-800 placeholder-stone-300 focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
        />
      )}
    </div>
  );
}
