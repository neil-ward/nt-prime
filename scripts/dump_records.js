#!/usr/bin/env node
/* ------------------------------------------------------------------------
 * dump_records.js — snapshot the Supabase `records` table to
 * public/data/nt_data.json so git history tracks data edits and the
 * offline backup stays current.
 *
 * Run on demand:
 *   node --env-file=.env.local scripts/dump_records.js
 *
 * Then commit the updated JSON:
 *   git add public/data/nt_data.json
 *   git commit -m "data: snapshot records"
 * ------------------------------------------------------------------------ */

const fs   = require("fs");
const path = require("path");

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const OUT_PATH = path.join(__dirname, "..", "public", "data", "nt_data.json");

// Columns we DON'T want in the JSON snapshot — DB-only bookkeeping
const OMIT = new Set(["id", "created_at", "updated_at"]);

async function main() {
  // Page through all rows. PostgREST default limit is 1000; one page covers
  // our ~400-record dataset comfortably, but paging guards future growth.
  const all = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/records?select=*&order=book,chapter,dataset&limit=${PAGE}&offset=${offset}`,
      {
        headers: {
          apikey:        SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    if (!res.ok) {
      console.error("Fetch failed:", res.status, await res.text());
      process.exit(1);
    }
    const page = await res.json();
    all.push(...page);
    if (page.length < PAGE) break;
  }

  console.log(`Dumped ${all.length} records.`);

  // Strip bookkeeping cols; keep JSON output stable for good git diffs
  const clean = all.map((r) => {
    const out = {};
    Object.keys(r)
      .filter((k) => !OMIT.has(k))
      .sort()   // sort keys so the JSON diff is stable
      .forEach((k) => { out[k] = r[k]; });
    return out;
  });

  fs.writeFileSync(OUT_PATH, JSON.stringify(clean, null, 2) + "\n");
  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
