#!/usr/bin/env node
/* ------------------------------------------------------------------------
 * seed_records.js — load public/data/nt_data.json into the Supabase
 * `records` table.
 *
 * Safe to re-run: upserts on the natural key (ref, dataset, category_code).
 * Reads env from .env.local (Node 20+ --env-file).
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed_records.js
 * ------------------------------------------------------------------------ */

const fs = require("fs");
const path = require("path");

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const DATA_PATH = path.join(__dirname, "..", "public", "data", "nt_data.json");

async function main() {
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const records = JSON.parse(raw);
  console.log(`Read ${records.length} records from ${DATA_PATH}`);

  // Map JSON fields → DB columns. Defaults for new fields.
  const rows = records.map((r) => ({
    book:                   r.book,
    chapter:                String(r.chapter),
    verse_range:            r.verse_range,
    ref:                    r.ref,
    url:                    r.url ?? null,

    dataset:                r.dataset,
    dataset_label:          r.dataset_label ?? null,
    nt_section:             r.nt_section ?? null,
    category:               r.category ?? null,
    category_code:          r.category_code ?? null,
    theme:                  r.theme ?? null,
    subtheme:               r.subtheme ?? null,

    literary_context:       r.literary_context ?? null,
    passage_type:           r.passage_type ?? null,
    passage_type_group:     r.passage_type_group ?? null,
    command_strength:       r.command_strength ?? null,
    command_strength_group: r.command_strength_group ?? null,

    speaker:                r.speaker ?? null,
    speaker_group:          r.speaker_group ?? null,
    audience:               r.audience ?? null,

    parallel_passages:      r.parallel_passages ?? null,
    parallel_id:            r.parallel_id ?? null,
    primary_record:         !!r.primary_record,
    gk_keywords:            r.gk_keywords ?? null,
    ot_antecedent:          r.ot_antecedent ?? null,
    summary:                r.summary ?? null,
    interpretive_notes:     r.interpretive_notes ?? null,

    // New fields — not yet populated in JSON; start empty
    ot_root_category:       r.ot_root_category ?? null,
    ot_root_notes:          r.ot_root_notes ?? null,

    commonly_cited:         !!r.commonly_cited,

    q2_crg:                 r.q2_crg ?? null,
    q2_pfs:                 r.q2_pfs ?? null,
    q2_uca:                 r.q2_uca ?? null,
    q2_ic:                  r.q2_ic ?? null,
    q2_mca:                 r.q2_mca ?? null,
    q2_typical_application: r.q2_typical_application ?? null,
    q2_consistency_rating:  r.q2_consistency_rating ?? null,
    q2_notes:               r.q2_notes ?? null,
  }));

  // Upsert in batches of 100 so we stay well under PostgREST's limits
  const BATCH = 100;
  let ok = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/records?on_conflict=ref,dataset,category_code`,
      {
        method: "POST",
        headers: {
          apikey:          SUPABASE_SERVICE_ROLE_KEY,
          Authorization:   `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type":  "application/json",
          Prefer:          "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(batch),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`Batch ${i}-${i + batch.length} failed (${res.status}):`, body);
      process.exit(1);
    }
    ok += batch.length;
    process.stdout.write(`\r  upserted ${ok}/${rows.length}…`);
  }
  console.log("\nSeed complete.");

  // Verify count
  const countRes = await fetch(
    `${SUPABASE_URL}/rest/v1/records?select=id`,
    {
      headers: {
        apikey:         SUPABASE_SERVICE_ROLE_KEY,
        Authorization:  `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer:         "count=exact",
        Range:          "0-0",
      },
    },
  );
  const total = countRes.headers.get("content-range")?.split("/")[1];
  console.log(`Rows in records table: ${total}`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
