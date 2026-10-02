import type { Database } from "../db";

export default {
  id: 9,
  description: "Add via column to chunks for nested tool calls (e.g. codemode)",
  fn: (db: Database) => {
    db.exec(`ALTER TABLE chunks ADD COLUMN via TEXT`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_via ON chunks(via)`);
  },
};
