/**
 * Skill usage detection.
 *
 * A session can pick up a skill in three ways:
 *
 * 1. Invocation (slash) — the user types /skill:name at the start of a user message, and Pi inlines a <skill name="..." location="..."> block.
 * 2. Invocation (autocomplete) — the skill-autocomplete hook expands a ?skill-name reference into a custom_message with customType: "skill-invocation".
 * 3. Reading — the agent reads a SKILL.md file with a read tool.
 */

import { basename, dirname } from "node:path";
import type { SkillUsage, Turn } from "../types/session";

const SKILL_INVOCATION_CUSTOM_TYPE = "skill-invocation";
const SKILL_FILENAME = "skill.md";
const READ_TOOLS = new Set(["read", "read_file", "view", "cat"]);
const PATH_ARG_KEYS = ["path", "file_path", "filePath"];

/** Matches the opening tag of an injected skill block. */
const SKILL_BLOCK_PATTERN = /<skill\s+name="([^"]*)"\s+location="([^"]*)"/;

/** Same block, but only at the very start of the text. */
const LEADING_SKILL_BLOCK_PATTERN = new RegExp(
  `^${SKILL_BLOCK_PATTERN.source}`,
);

/**
 * Parse the description from a SKILL.md's frontmatter.
 *
 * Frontmatter is the block between the first pair of `---` lines at the very
 * start of the file. The description is the value of the `description:` key
 * on a single line, with surrounding quotes stripped. Returns null when the
 * frontmatter or the key is missing.
 */
export function parseSkillDescription(markdown: string): string | null {
  const open = markdown.match(/^---\r?\n/);
  if (!open) return null;

  const rest = markdown.slice(open[0].length);
  const close = rest.match(/^---\r?(\n|$)/m);
  if (!close || close.index === undefined) return null;

  const frontmatter = rest.slice(0, close.index);
  for (const line of frontmatter.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("description:")) continue;

    let description = trimmed.slice("description:".length).trim();
    if (
      (description.startsWith('"') && description.endsWith('"')) ||
      (description.startsWith("'") && description.endsWith("'"))
    ) {
      description = description.slice(1, -1).trim();
    }
    return description || null;
  }

  return null;
}

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

/**
 * Detect a skill when the user types /skill:name at the START of their message.
 * Patterns:
 * - /skill:name: calls the skill with named parameters (maybe embedded in text)
 * - User role turns with textContent.startsWith('<skill name="..." location="...">')
 * The inline block can precede any user-typed content; we extract the first skill block.
 */
function detectSlashInvocation(turn: Turn): SkillUsage | null {
  if (turn.role !== "user") return null;

  // pi core inlines the block at the very start of the user's message.
  const text = turn.textContent.trimStart();

  const blockMatch = LEADING_SKILL_BLOCK_PATTERN.exec(text);
  if (blockMatch) {
    const name = blockMatch[1].trim() || null;
    const path = blockMatch[2].trim() || null;

    if (!name || !path) return null;

    return {
      name,
      path,
      actor: "user",
      detail: "slash",
    };
  }

  return null;
}

/**
 * Detect a skill from a custom_message skill-invocation.
 * Triggered when the skill-autocomplete hook expands a ?skill-name reference.
 */
function detectAutocompleteInvocation(turn: Turn): SkillUsage | null {
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

  return {
    name,
    path,
    actor: "user",
    detail: "autocomplete",
    description: readString(turn.details, "description"),
  };
}

/**
 * Detect a skill from a read tool call that loads a SKILL.md file.
 * Patterns:
 * - read(path: "/path/to/skills/vitest/SKILL.md")
 * - read_file(file_path: "/path/to/skills/vitest/SKILL.md")
 * - view(filePath: "/path/to/skills/vitest/SKILL.md")
 * - cat(filePath: "/path/to/skills/vitest/SKILL.md")
 */
function detectReads(turn: Turn): SkillUsage[] {
  const usages: SkillUsage[] = [];

  for (const toolCall of turn.toolCalls) {
    if (!READ_TOOLS.has(toolCall.name.toLowerCase())) continue;

    for (const key of PATH_ARG_KEYS) {
      const value = toolCall.args[key];
      if (typeof value !== "string" || !value.trim()) continue;

      const path = value.trim();
      const name = skillNameFromPath(path);
      if (name) {
        usages.push({
          name,
          path,
          actor: "agent",
          detail: null,
        });
      }
      break;
    }
  }

  return usages;
}

/**
 * Collect every skill referenced by a session's turns, de-duplicated on
 * name + path + actor + detail and kept in first-seen order.
 */
export function detectSkills(turns: Turn[]): SkillUsage[] {
  // Combine all skill detection methods to avoid missing any.
  // Remove `source` from the add() function key for deduplication.
  const seeSkills = new Set<string>();
  const skills: SkillUsage[] = [];

  const add = (usage: SkillUsage) => {
    // Deduplicate on name + path + actor + detail (not on the deprecated source field)
    const key = `${usage.actor}\u0000${usage.name}\u0000${usage.path ?? ""}\u0000${usage.detail ?? ""}`;
    if (seeSkills.has(key)) return;
    seeSkills.add(key);
    skills.push(usage);
  };

  for (const turn of turns) {
    // Try all three detection methods for each turn.
    // Detect slash invocation first (new shape) and keep the fallback autocomplete behavior too.
    const slashInvocation = detectSlashInvocation(turn);
    if (slashInvocation) add(slashInvocation);
    const autocompleteInvocation = detectAutocompleteInvocation(turn);
    if (autocompleteInvocation) add(autocompleteInvocation);
    for (const read of detectReads(turn)) add(read);
  }

  return skills;
}
