-- ==========================================================================
-- NT Prime — Records table setup
--
-- Run this ONCE in the Supabase SQL Editor to migrate the 385 NT command
-- records from the static public/data/nt_data.json file into Supabase.
--
-- After running this:
--   1. Execute `node scripts/seed_records.js` from the project root to
--      upsert the JSON contents into this table.
--   2. Deploy the app; the new /api/records endpoint reads from here.
--
-- Schema mirrors the NTRecord type in lib/types.ts, plus two new fields
-- for the OT / ANE ethical-root dimension (ot_root_category + notes).
-- ==========================================================================

CREATE TABLE IF NOT EXISTS records (
  id                     BIGSERIAL    PRIMARY KEY,

  -- Identity
  book                   TEXT         NOT NULL,
  chapter                TEXT         NOT NULL,
  verse_range            TEXT         NOT NULL,
  ref                    TEXT         NOT NULL,
  url                    TEXT,

  -- Classification
  dataset                TEXT         NOT NULL CHECK (dataset IN ('A','B','D')),
  dataset_label          TEXT,
  nt_section             TEXT,
  category               TEXT,
  category_code          TEXT,
  theme                  TEXT,
  subtheme               TEXT,

  -- Context
  literary_context       TEXT,
  passage_type           TEXT,
  passage_type_group     TEXT,
  command_strength       TEXT,
  command_strength_group TEXT,

  -- Attribution
  speaker                TEXT,
  speaker_group          TEXT,
  audience               TEXT,

  -- Scholarly apparatus
  parallel_passages      TEXT,
  parallel_id            TEXT,
  primary_record         BOOLEAN      DEFAULT false,
  gk_keywords            TEXT,
  ot_antecedent          TEXT,
  summary                TEXT,
  interpretive_notes     TEXT,

  -- NEW: OT / ANE ethical root
  -- The "boundary stone" example: a NT communal-life command whose
  -- ANE root is a justice-and-mercy protection of weaker neighbors.
  ot_root_category       TEXT,
  ot_root_notes          TEXT,

  -- SBC citation tag
  commonly_cited         BOOLEAN      DEFAULT false,

  -- Q2 fields (nullable; only Dataset D records are scored)
  q2_crg                 TEXT,
  q2_pfs                 TEXT,
  q2_uca                 TEXT,
  q2_ic                  TEXT,
  q2_mca                 TEXT,
  q2_typical_application TEXT,
  q2_consistency_rating  TEXT,
  q2_notes               TEXT,

  created_at             TIMESTAMPTZ  DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  DEFAULT NOW()
);

-- Natural-key uniqueness so the seed script's upsert is safe to re-run
CREATE UNIQUE INDEX IF NOT EXISTS idx_records_natural_key
  ON records(ref, dataset, category_code);

-- Common filter dimensions
CREATE INDEX IF NOT EXISTS idx_records_dataset       ON records(dataset);
CREATE INDEX IF NOT EXISTS idx_records_book          ON records(book);
CREATE INDEX IF NOT EXISTS idx_records_speaker_group ON records(speaker_group);

-- ==========================================================================
-- RLS: public SELECT, admin-only writes via service_role
-- ==========================================================================

ALTER TABLE records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read records"
  ON records FOR SELECT
  TO anon, authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies are defined. Writes are only possible
-- through the service_role key (used by /api/admin/records, which is
-- gated by ADMIN_TOKEN). Anon and authenticated users are default-denied.

-- ==========================================================================
-- Automatic updated_at bump
-- ==========================================================================

CREATE OR REPLACE FUNCTION bump_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS records_bump_updated_at ON records;
CREATE TRIGGER records_bump_updated_at
  BEFORE UPDATE ON records
  FOR EACH ROW
  EXECUTE FUNCTION bump_updated_at();
