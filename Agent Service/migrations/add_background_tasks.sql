-- Migration: Add background_tasks table for long-running agent tasks
-- Date: 2026-01-28

CREATE TABLE IF NOT EXISTS background_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  current_step TEXT,
  result TEXT,
  error TEXT,
  research_mode BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_background_tasks_user_id ON background_tasks(user_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_background_tasks_status ON background_tasks(status);
