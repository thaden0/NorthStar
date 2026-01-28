-- Migration: Add memory system tables
-- Date: 2026-01-28

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Memory Tags table
CREATE TABLE IF NOT EXISTS memory_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT,
  icon TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Memories table
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  summary TEXT,
  embedding vector(384),
  event_date DATE,
  event_date_end DATE,
  expiry_date DATE,
  relevance_days_before INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  priority INTEGER DEFAULT 5,
  source TEXT DEFAULT 'agent' NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Memory Tag Assignments table
CREATE TABLE IF NOT EXISTS memory_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES memory_tags(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_event_date ON memories(event_date);
CREATE INDEX IF NOT EXISTS idx_memories_is_active ON memories(is_active);
CREATE INDEX IF NOT EXISTS idx_memory_tag_assignments_memory_id ON memory_tag_assignments(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_tag_assignments_tag_id ON memory_tag_assignments(tag_id);

-- Add default tags (Person, Event, Goal, Preference, Work, Personal)
INSERT INTO memory_tags (name, description, color, icon) VALUES
  ('Person', 'Information about people', '#2196F3', 'person'),
  ('Event', 'Specific events or meetings', '#4CAF50', 'event'),
  ('Goal', 'User goals and objectives', '#FF9800', 'flag'),
  ('Preference', 'User preferences and likes', '#E91E63', 'favorite'),
  ('Work', 'Work-related information', '#607D8B', 'work'),
  ('Personal', 'Personal information', '#9C27B0', 'face')
ON CONFLICT (name) DO NOTHING;
