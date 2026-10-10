/**
 * sesame skills - list skills used across indexed sessions.
 */

import { listIndexedSkills, type SkillSummary } from "@aliou/sesame";
import { command, number, string } from "@drizzle-team/brocli";
import { loadSesameConfig, openIndex, parseDateFlag } from "../context";
import { label } from "../kit/colors";
import { isJson, writeHuman, writeJson } from "../kit/output";

const MAX_DISPLAYED_PATHS = 3;

type SkillsFlags = {
  cwd?: string;
  after?: string;
  before?: string;
  actor?: "user" | "agent";
  limit: number;
};

export const skillsCommand = command({
  name: "skills",
  desc: "List skills used across indexed sessions, most used first",
  options: {
    cwd: string("cwd").desc("Only sessions whose cwd starts with this path"),
    after: string("after").desc(
      "Sessions modified after date (7d, 2w, 1m, YYYY-MM-DD)",
    ),
    before: string("before").desc("Sessions modified before date"),
    actor: string("actor")
      .enum("user", "agent")
      .desc("Who loaded the skill: user (slash command) or agent (read)"),
    limit: number("limit")
      .int()
      .min(1)
      .default(100)
      .desc("Max rows (capped at 1000)"),
  },
  handler: async (flags: SkillsFlags) => runSkills(flags),
});

async function runSkills(flags: SkillsFlags): Promise<void> {
  const options = {
    cwd: flags.cwd,
    after: parseDateFlag("--after", flags.after),
    before: parseDateFlag("--before", flags.before),
    actor: flags.actor,
    limit: flags.limit,
  };
  await loadSesameConfig();
  const db = openIndex();
  try {
    const skills = listIndexedSkills(db, options);
    if (isJson()) {
      writeJson({ skillCount: skills.length, skills });
      return;
    }
    writeHuman(renderSkills(skills));
  } finally {
    db.close();
  }
}

export function renderSkills(skills: SkillSummary[]): string {
  if (skills.length === 0) return "No skills found in the index.";
  const blocks = skills.map((skill) => {
    const actors = skill.actors.length > 0 ? skill.actors.join("+") : "unknown";
    const lines = [
      `${skill.name} ${label(`(${skill.sessionCount} sessions, ${actors})`)}`,
    ];
    if (skill.description) lines.push(`    "${skill.description}"`);
    for (const path of skill.paths.slice(0, MAX_DISPLAYED_PATHS)) {
      lines.push(`    ${label(path)}`);
    }
    const hidden = skill.paths.length - MAX_DISPLAYED_PATHS;
    if (hidden > 0) {
      lines.push(`    ${label(`... ${hidden} more paths (-o json for all)`)}`);
    }
    return lines.join("\n");
  });
  return `Found ${skills.length} skills\n\n${blocks.join("\n")}`;
}
