import type { Database } from "../db";
import addIsError from "./001-add-is-error";
import addMetadata from "./002-add-metadata";
import addTreeFields from "./003-add-tree-fields";
import addSessionSkills from "./004-add-session-skills";
import addSessionSkillsActorDetail from "./005-add-session-skills-actor-detail";

export interface Migration {
  id: number;
  description: string;
  fn: (db: Database) => void;
}

/**
 * All schema migrations in order.
 *
 * Rules:
 * - Never remove or reorder existing entries.
 * - Append new migrations to the end of the array.
 * - The SCHEMA constant in db.ts must always reflect the latest table
 *   definitions so that fresh databases are created correctly without
 *   running migrations.
 */
export const migrations: Migration[] = [
  addIsError,
  addMetadata,
  addTreeFields,
  addSessionSkills,
  addSessionSkillsActorDetail,
];
