CREATE TABLE IF NOT EXISTS schema_migrations (
  id         INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE templates (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  shared_prompt TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE assets (
  id                TEXT PRIMARY KEY,
  content_hash      TEXT NOT NULL UNIQUE,
  mime_type         TEXT NOT NULL,
  byte_size         INTEGER NOT NULL,
  original_filename TEXT,
  created_at        INTEGER NOT NULL
);

CREATE TABLE image_slots (
  id            TEXT PRIMARY KEY,
  owner_kind    TEXT NOT NULL CHECK (owner_kind IN ('template','job')),
  owner_id      TEXT NOT NULL,
  asset_id      TEXT NOT NULL REFERENCES assets(id),
  variable_name TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  position      INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,
  UNIQUE (owner_kind, owner_id, variable_name)
);
CREATE INDEX idx_image_slots_owner ON image_slots(owner_kind, owner_id);

CREATE TABLE jobs (
  id          TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  prompt      TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_jobs_template ON jobs(template_id);

CREATE TABLE generations (
  id              TEXT PRIMARY KEY,
  job_id          TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status          TEXT NOT NULL CHECK (status IN ('pending','running','succeeded','failed')),
  final_prompt    TEXT NOT NULL,
  image_refs_json TEXT NOT NULL,
  result_asset_id TEXT REFERENCES assets(id),
  error_message   TEXT,
  model           TEXT NOT NULL,
  started_at      INTEGER NOT NULL,
  finished_at     INTEGER
);
CREATE INDEX idx_generations_job ON generations(job_id, started_at DESC);
