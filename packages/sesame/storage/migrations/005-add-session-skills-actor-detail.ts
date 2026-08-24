import type { Database } from "../db";
import type { Migration } from "./index";

/**
 * Add actor and detail columns to session_skills and backfill actor from the
 * legacy source column.
 *
 * - actor: "user" = injected by a user action (slash command or autocomplete),
 *   "agent" = the agent read the SKILL.md itself.
 * - detail: "slash" | "autocomplete" for user invocations, null otherwise.
 *   Old rows keep detail NULL; their invocation style was not recorded.
 *
 * The legacy source column is left in place but no longer read by the code.
 */
const migration: Migration = {
  id: 5,
  description: "add actor and detail columns to session_skills",
  fn: (db: Database) => {
    // SCHEMA may already have created session_skills in its final shape for
    // partially migrated databases, so guard every step.
    const columns = new Set(
      (
        db.prepare("PRAGMA table_info(session_skills)").all() as Array<{
          name: string;
        }>
      ).map((column) => column.name),
    );

    if (!columns.has("actor")) {
      db.exec(
        "ALTER TABLE session_skills ADD COLUMN actor TEXT NOT NULL DEFAULT 'user'",
      );
    }
    if (!columns.has("detail")) {
      db.exec("ALTER TABLE session_skills ADD COLUMN detail TEXT");
    }

    if (columns.has("source")) {
      db.exec(`
        UPDATE session_skills
        SET actor = CASE
          WHEN source = 'invocation' THEN 'user'
          WHEN source = 'read' THEN 'agent'
          ELSE 'user'
        END
      `);
    }

    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_session_skills_actor ON session_skills(actor)",
    );
  },
};

export default migration;
