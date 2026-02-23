import type { Database } from "../db";
import type { Migration } from "./index";

const migration: Migration = {
  id: 1,
  description: "add is_error column to chunks",
  fn: (db: Database) => {
    db.exec("ALTER TABLE chunks ADD COLUMN is_error INTEGER DEFAULT NULL");
  },
};

export default migration;
