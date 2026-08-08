/**
 * Skill usage detection.
 *
 * A session can pick up a skill in two ways:
 *
 * 1. Injection — the `skill-autocomplete` hook turns a `?skill-name` reference
 *    into a `custom_message` entry with `customType: "skill-invocation"`, whose
 *    content is a `<skill name="..." location="...">` block and whose `details`
 *    carry `{ name, path }`.
 * 2. Reading — the agent reads a `SKILL.md` file with a read tool, which is how
 *    skills listed in the system prompt get loaded.
 */

import { basename, dirname } from "node:path";
import type { SkillUsage, Turn } from "../types/session";

const SKILL_INVOCATION_CUSTOM_TYPE = "skill-invocation";
const SKILL_FILENAME = "skill.md";
const READ_TOOLS = new Set(["read", "read_file", "view", "cat"]);
const PATH_ARG_KEYS = ["path", "file_path", "filePath"];

/** Matches the opening tag of an injected skill block. */
const SKILL_BLOCK_PATTERN = /<skill\s+name="([^"]*)"\s+location="([^"]*)"/;

/** Derive the skill name from a SKILL.md path (its containing directory). */
export function skillNameFromPath(path: string): string | null {
  if (basename(path).toLowerCase() !== SKILL_FILENAME) return null;
  const name = basename(dirname(path));
  if (!name || name === "." || name === "/") return null;
  return name;
}

function readString(
  source: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = source?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function detectInvocation(turn: Turn): SkillUsage | null {
  if (turn.customType !== SKILL_INVOCATION_CUSTOM_TYPE) return null;

  let name = readString(turn.details, "name");
  let path = readString(turn.details, "path");

  if (!name || !path) {
    // Fall back to the rendered block when details are missing or partial.
    const match = SKILL_BLOCK_PATTERN.exec(turn.textContent);
    if (match) {
      name ??= match[1].trim() || null;
      path ??= match[2].trim() || null;
    }
  }

  if (!name && path) name = skillNameFromPath(path);
  if (!name) return null;

  return { name, path, source: "invocation" };
}

function detectReads(turn: Turn): SkillUsage[] {
  const usages: SkillUsage[] = [];

  for (const toolCall of turn.toolCalls) {
    if (!READ_TOOLS.has(toolCall.name.toLowerCase())) continue;

    for (const key of PATH_ARG_KEYS) {
      const value = toolCall.args[key];
      if (typeof value !== "string" || !value.trim()) continue;

      const path = value.trim();
      const name = skillNameFromPath(path);
      if (name) usages.push({ name, path, source: "read" });
      break;
    }
  }

  return usages;
}

/**
 * Collect every skill referenced by a session's turns, de-duplicated on
 * name + path + source and kept in first-seen order.
 */
export function detectSkills(turns: Turn[]): SkillUsage[] {
  const seen = new Set<string>();
  const skills: SkillUsage[] = [];

  const add = (usage: SkillUsage) => {
    const key = `${usage.source}\u0000${usage.name}\u0000${usage.path ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    skills.push(usage);
  };

  for (const turn of turns) {
    const invocation = detectInvocation(turn);
    if (invocation) add(invocation);
    for (const read of detectReads(turn)) add(read);
  }

  return skills;
}
