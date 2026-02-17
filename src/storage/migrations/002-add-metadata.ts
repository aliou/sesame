import type { Database } from "../db";
import type { Migration } from "./index";

const migration: Migration = {
  id: 2,
  description: "add metadata table",
  fn: (db: Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  },
};

export default migration;
