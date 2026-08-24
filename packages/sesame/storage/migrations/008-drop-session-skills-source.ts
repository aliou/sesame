import type { Database } from "../db";
import type { Migration } from "./index";

/**
 * Drop the legacy session_skills.source column.
 *
 * Migration 005 backfilled actor from source but kept the column. On
 * migrated databases it is TEXT NOT NULL with no default, so inserts that
 * only write (session_id, name, path, actor, detail) fail with
 * "NOT NULL constraint failed: session_skills.source". Nothing reads the
 * column anymore, so drop it. Guarded because SCHEMA may have pre-created
 * the table in its final shape (no source column).
 */
const migration: Migration = {
  id: 8,
  description: "drop legacy source column from session_skills",
  fn: (db: Database) => {
    const columns = new Set(
      (
        db.prepare("PRAGMA table_info(session_skills)").all() as Array<{
          name: string;
        }>
      ).map((column) => column.name),
    );

    if (columns.has("source")) {
      db.exec("ALTER TABLE session_skills DROP COLUMN source");
    }
  },
};

export default migration;
