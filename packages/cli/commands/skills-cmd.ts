/**
 * Skills command - list skills used across indexed sessions
 */

import { join } from "node:path";
import {
  getXDGPaths,
  type ListSkillsOptions,
  listIndexedSkills,
  loadConfig,
  openDatabase,
  parseRelativeDate,
} from "@aliou/sesame";
import { takePositiveInt, takeValue } from "./args";

const MAX_DISPLAYED_PATHS = 3;

export default async function skillsCommand(args: string[]): Promise<void> {
  const options: ListSkillsOptions = { limit: 100 };
  let json = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--cwd") {
      options.cwd = takeValue(args, i, arg);
      i++;
    } else if (arg === "--after") {
      options.after = parseRelativeDate(takeValue(args, i, arg));
      i++;
    } else if (arg === "--before") {
      options.before = parseRelativeDate(takeValue(args, i, arg));
      i++;
    } else if (arg === "--limit") {
      options.limit = takePositiveInt(args, i, arg);
      i++;
    } else if (arg === "--actor") {
      const actor = takeValue(args, i, arg);
      i++;
      if (actor !== "user" && actor !== "agent") {
        throw new Error(
          `Invalid --actor "${actor}". Expected "user" or "agent".`,
        );
      }
      options.actor = actor;
    } else if (arg === "--json") {
      json = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  await loadConfig();

  const paths = getXDGPaths();
  const db = openDatabase(join(paths.data, "index.sqlite"));

  try {
    const skills = listIndexedSkills(db, options);

    if (json) {
      console.log(
        JSON.stringify({ skillCount: skills.length, skills }, null, 2),
      );
      return;
    }

    if (skills.length === 0) {
      console.log("No skills found in the index.");
      return;
    }

    console.log(`Found ${skills.length} skills\n`);
    for (const skill of skills) {
      const actors =
        skill.actors.length > 0 ? skill.actors.join("+") : "unknown";
      console.log(
        `  ${skill.name} (${skill.sessionCount} sessions, ${actors})`,
      );
      if (skill.description) {
        console.log(`      "${skill.description}"`);
      }
      for (const path of skill.paths.slice(0, MAX_DISPLAYED_PATHS)) {
        console.log(`      ${path}`);
      }
      const hidden = skill.paths.length - MAX_DISPLAYED_PATHS;
      if (hidden > 0) {
        console.log(`      ... ${hidden} more paths (--json for all)`);
      }
    }
  } finally {
    db.close();
  }
}
