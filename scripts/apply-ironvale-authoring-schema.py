from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / 'schema.sql'
schema = path.read_text(encoding='utf-8')
block = '''

-- Rift Engine AI Builder review inbox retained as authoring infrastructure.
CREATE TABLE IF NOT EXISTS ai_builder_drafts (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  name TEXT NOT NULL,
  draft_json TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'public-ai-builder',
  tool_version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  loaded_at INTEGER,
  loaded_by TEXT,
  FOREIGN KEY(loaded_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_builder_drafts_created ON ai_builder_drafts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_builder_drafts_loaded ON ai_builder_drafts(loaded_at,created_at DESC);
'''
if 'CREATE TABLE IF NOT EXISTS ai_builder_drafts' not in schema:
    path.write_text(schema.rstrip() + block + '\n', encoding='utf-8')
print('Ironvale authoring schema preserved.')
