-- ==========================================================================
-- NT Prime Analytics — Supabase Setup Script
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- It creates the events table, indexes, RLS policies, and five analytics
-- functions that the /api/analytics route calls.
-- ==========================================================================

-- 1. Events table
CREATE TABLE IF NOT EXISTS events (
  id         BIGSERIAL    PRIMARY KEY,
  event_type TEXT         NOT NULL,
  ref        TEXT,
  dataset    TEXT,
  page       TEXT,
  metadata   JSONB        DEFAULT '{}',
  session_id TEXT         NOT NULL,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

-- 2. Indexes for fast analytics queries
CREATE INDEX IF NOT EXISTS idx_events_type    ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_ref     ON events(ref);
CREATE INDEX IF NOT EXISTS idx_events_page    ON events(page);

-- 3. Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Service role can insert (used by /api/track)
CREATE POLICY "Service role can insert events"
  ON events FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Anyone can read (analytics page is public)
CREATE POLICY "Public can read events"
  ON events FOR SELECT
  TO anon, authenticated
  USING (true);

-- ==========================================================================
-- 4. Analytics aggregation functions (called via supabase.rpc())
-- ==========================================================================

-- 4a. Activity heatmap — events by day-of-week × hour-of-day
CREATE OR REPLACE FUNCTION analytics_hourly_heatmap(cutoff_days INT DEFAULT 30)
RETURNS TABLE(dow INT, hour INT, count BIGINT) AS $$
  SELECT EXTRACT(DOW FROM created_at)::INT AS dow,
         EXTRACT(HOUR FROM created_at)::INT AS hour,
         COUNT(*) AS count
  FROM events
  WHERE created_at > NOW() - (cutoff_days || ' days')::INTERVAL
  GROUP BY dow, hour
$$ LANGUAGE sql STABLE;

-- 4b. Top verses by engagement
CREATE OR REPLACE FUNCTION analytics_top_verses(cutoff_days INT DEFAULT 30, lim INT DEFAULT 20)
RETURNS TABLE(ref TEXT, count BIGINT) AS $$
  SELECT ref, COUNT(*) AS count
  FROM events
  WHERE ref IS NOT NULL
    AND created_at > NOW() - (cutoff_days || ' days')::INTERVAL
  GROUP BY ref
  ORDER BY count DESC
  LIMIT lim
$$ LANGUAGE sql STABLE;

-- 4c. Dataset interest — events per dataset × event type
CREATE OR REPLACE FUNCTION analytics_dataset_interest(cutoff_days INT DEFAULT 30)
RETURNS TABLE(dataset TEXT, event_type TEXT, count BIGINT) AS $$
  SELECT dataset, event_type, COUNT(*) AS count
  FROM events
  WHERE dataset IS NOT NULL
    AND created_at > NOW() - (cutoff_days || ' days')::INTERVAL
  GROUP BY dataset, event_type
  ORDER BY dataset
$$ LANGUAGE sql STABLE;

-- 4d. Page engagement — events per page
CREATE OR REPLACE FUNCTION analytics_page_engagement(cutoff_days INT DEFAULT 30)
RETURNS TABLE(page TEXT, count BIGINT) AS $$
  SELECT page, COUNT(*) AS count
  FROM events
  WHERE page IS NOT NULL
    AND created_at > NOW() - (cutoff_days || ' days')::INTERVAL
  GROUP BY page
  ORDER BY count DESC
$$ LANGUAGE sql STABLE;

-- 4e. Daily trend — events per calendar day
CREATE OR REPLACE FUNCTION analytics_daily_trend(cutoff_days INT DEFAULT 30)
RETURNS TABLE(day DATE, count BIGINT) AS $$
  SELECT DATE(created_at) AS day, COUNT(*) AS count
  FROM events
  WHERE created_at > NOW() - (cutoff_days || ' days')::INTERVAL
  GROUP BY day
  ORDER BY day
$$ LANGUAGE sql STABLE;
