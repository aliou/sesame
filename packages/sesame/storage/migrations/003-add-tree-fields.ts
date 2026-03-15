import type { Database } from "../db";

export default {
  id: 3,
  description:
    "Add parent_session_id to sessions and entry_id/parent_entry_id/timestamp/source_type to chunks for tree structure support",
  fn: (db: Database) => {
    // Add parent_session_id to sessions
    db.exec(`ALTER TABLE sessions ADD COLUMN parent_session_id TEXT`);

    // Add entry tree fields to chunks
    db.exec(`ALTER TABLE chunks ADD COLUMN entry_id TEXT`);
    db.exec(`ALTER TABLE chunks ADD COLUMN parent_entry_id TEXT`);
    db.exec(`ALTER TABLE chunks ADD COLUMN timestamp TEXT`);
    db.exec(`ALTER TABLE chunks ADD COLUMN source_type TEXT`);

    // Add indexes for tree queries
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_sessions_parent ON sessions(parent_session_id)`,
    );
    db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_entry ON chunks(entry_id)`);
  },
};
