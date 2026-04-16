-- ==========================================================================
-- NT Prime — Feedback table setup
--
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- Creates a feedback table that stores user-submitted bugs/ideas/questions
-- from the floating widget. RLS is enabled with no anon policies, so the
-- table is only accessible via the service_role key (used by the API routes).
-- ==========================================================================

CREATE TABLE IF NOT EXISTS feedback (
  id         BIGSERIAL    PRIMARY KEY,
  category   TEXT         NOT NULL CHECK (category IN ('bug', 'idea', 'question')),
  message    TEXT         NOT NULL,
  email      TEXT,
  page       TEXT,
  user_agent TEXT,
  session_id TEXT,
  status     TEXT         NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'resolved')),
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_status  ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated roles. Default deny.
-- All access goes through the service_role key used by the API routes.
