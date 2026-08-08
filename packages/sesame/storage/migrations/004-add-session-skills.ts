import type { Database } from "../db";
import type { Migration } from "./index";

const migration: Migration = {
  id: 4,
  description: "add session_skills table for skill-based filtering",
  fn: (db: Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS session_skills (
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        path TEXT,
        source TEXT NOT NULL
      )
    `);
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_session_skills_session ON session_skills(session_id)`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_session_skills_name ON session_skills(name)`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_session_skills_path ON session_skills(path)`,
    );

    // Existing rows carry no skill data. Invalidate the stored mtimes so the
    // next `sesame index` re-parses every session instead of skipping it.
    db.exec(`UPDATE sessions SET file_mtime = -1`);
  },
};

export default migration;
