-- ==========================================================================
-- NT Prime — Analytics filter update
--
-- Run this ONCE in the Supabase SQL Editor to:
--   1. Update the 5 analytics RPC functions to exclude admin/test pages
--      (/admin/*, /analytics, /smoke, /smoke-test) so owner activity
--      doesn't skew the public dashboard.
--   2. Delete historical events from those same pages so the charts
--      start clean.
--
-- Safe to re-run: all DDL uses CREATE OR REPLACE, and the DELETE is
-- idempotent (further runs are no-ops once the data is gone).
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Updated RPC functions with admin/test exclusion baked in.
--    The filter is applied identically in every function:
--      page IS NULL                             -- events with no page, keep
--      OR page NOT LIKE '/admin/%'              -- exclude /admin/* (all admin)
--      AND page NOT IN ('/analytics',           -- exclude the analytics dash
--                       '/smoke',               -- exclude smoke tests
--                       '/smoke-test')          -- exclude smoke tests
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION analytics_hourly_heatmap(cutoff_days INT DEFAULT 30)
RETURNS TABLE(dow INT, hour INT, count BIGINT) AS $$
  SELECT EXTRACT(DOW FROM created_at)::INT AS dow,
         EXTRACT(HOUR FROM created_at)::INT AS hour,
         COUNT(*) AS count
  FROM events
  WHERE created_at > NOW() - (cutoff_days || ' days')::INTERVAL
    AND (page IS NULL OR
         (page NOT LIKE '/admin/%'
          AND page NOT IN ('/analytics', '/smoke', '/smoke-test')))
  GROUP BY dow, hour
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION analytics_top_verses(cutoff_days INT DEFAULT 30, lim INT DEFAULT 20)
RETURNS TABLE(ref TEXT, count BIGINT) AS $$
  SELECT ref, COUNT(*) AS count
  FROM events
  WHERE ref IS NOT NULL
    AND created_at > NOW() - (cutoff_days || ' days')::INTERVAL
    AND (page IS NULL OR
         (page NOT LIKE '/admin/%'
          AND page NOT IN ('/analytics', '/smoke', '/smoke-test')))
  GROUP BY ref
  ORDER BY count DESC
  LIMIT lim
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION analytics_dataset_interest(cutoff_days INT DEFAULT 30)
RETURNS TABLE(dataset TEXT, event_type TEXT, count BIGINT) AS $$
  SELECT dataset, event_type, COUNT(*) AS count
  FROM events
  WHERE dataset IS NOT NULL
    AND created_at > NOW() - (cutoff_days || ' days')::INTERVAL
    AND (page IS NULL OR
         (page NOT LIKE '/admin/%'
          AND page NOT IN ('/analytics', '/smoke', '/smoke-test')))
  GROUP BY dataset, event_type
  ORDER BY dataset
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION analytics_page_engagement(cutoff_days INT DEFAULT 30)
RETURNS TABLE(page TEXT, count BIGINT) AS $$
  SELECT page, COUNT(*) AS count
  FROM events
  WHERE page IS NOT NULL
    AND page NOT LIKE '/admin/%'
    AND page NOT IN ('/analytics', '/smoke', '/smoke-test')
    AND created_at > NOW() - (cutoff_days || ' days')::INTERVAL
  GROUP BY page
  ORDER BY count DESC
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION analytics_daily_trend(cutoff_days INT DEFAULT 30)
RETURNS TABLE(day DATE, count BIGINT) AS $$
  SELECT DATE(created_at) AS day, COUNT(*) AS count
  FROM events
  WHERE created_at > NOW() - (cutoff_days || ' days')::INTERVAL
    AND (page IS NULL OR
         (page NOT LIKE '/admin/%'
          AND page NOT IN ('/analytics', '/smoke', '/smoke-test')))
  GROUP BY day
  ORDER BY day
$$ LANGUAGE sql STABLE;

-- --------------------------------------------------------------------------
-- 2. Purge historical events from admin/test pages.
--    Run this once to clean up smoke-test and admin-viewing data from
--    the earlier development/testing phase.
-- --------------------------------------------------------------------------

DELETE FROM events
WHERE page IS NOT NULL
  AND (page LIKE '/admin/%'
       OR page IN ('/analytics', '/smoke', '/smoke-test'));
