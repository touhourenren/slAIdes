CREATE TABLE IF NOT EXISTS project_index (
  path TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  title TEXT NOT NULL,
  last_opened_at TEXT NOT NULL,
  last_saved_at TEXT,
  document_hash TEXT,
  is_missing INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recovery_drafts (
  tab_id TEXT PRIMARY KEY,
  original_path TEXT,
  recovery_path TEXT NOT NULL,
  title TEXT NOT NULL,
  document_hash TEXT,
  document_revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL
);
