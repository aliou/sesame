import { describe, expect, test } from "vitest";
import type { Turn } from "../types/session";
import { detectSkills, skillNameFromPath } from "./detect-skills";

function turn(partial: Partial<Turn>): Turn {
  return {
    role: "system",
    textContent: "",
    codeBlocks: [],
    toolCalls: [],
    ...partial,
  };
}

describe("skillNameFromPath", () => {
  test("returns the containing directory name", () => {
    expect(skillNameFromPath("/a/b/vitest/SKILL.md")).toBe("vitest");
  });

  test("is case-insensitive on the filename", () => {
    expect(skillNameFromPath("/a/b/vitest/skill.md")).toBe("vitest");
  });

  test("returns null for non-skill files", () => {
    expect(skillNameFromPath("/a/b/vitest/README.md")).toBeNull();
    expect(skillNameFromPath("SKILL.md")).toBeNull();
  });
});

describe("detectSkills", () => {
  test("detects an injected skill invocation from details", () => {
    const skills = detectSkills([
      turn({
        sourceType: "custom_message",
        customType: "skill-invocation",
        textContent: "[skill-invocation]\n<skill name=...>",
        details: { name: "sbxctl", path: "/skills/sbxctl/SKILL.md" },
      }),
    ]);

    expect(skills).toEqual([
      { name: "sbxctl", path: "/skills/sbxctl/SKILL.md", source: "invocation" },
    ]);
  });

  test("falls back to the rendered skill block when details are missing", () => {
    const skills = detectSkills([
      turn({
        sourceType: "custom_message",
        customType: "skill-invocation",
        textContent:
          '[skill-invocation]\n<skill name="vitest" location="/skills/vitest/SKILL.md">\nbody\n</skill>',
      }),
    ]);

    expect(skills).toEqual([
      { name: "vitest", path: "/skills/vitest/SKILL.md", source: "invocation" },
    ]);
  });

  test("ignores other custom message types", () => {
    expect(
      detectSkills([
        turn({
          sourceType: "custom_message",
          customType: "note",
          details: { name: "vitest", path: "/skills/vitest/SKILL.md" },
        }),
      ]),
    ).toEqual([]);
  });

  test("detects SKILL.md reads", () => {
    const skills = detectSkills([
      turn({
        role: "assistant",
        toolCalls: [
          { name: "Read", args: { path: "/skills/biome/SKILL.md" } },
          {
            name: "read_file",
            args: { file_path: "/other/tailwind/skill.md" },
          },
        ],
      }),
    ]);

    expect(skills).toEqual([
      { name: "biome", path: "/skills/biome/SKILL.md", source: "read" },
      { name: "tailwind", path: "/other/tailwind/skill.md", source: "read" },
    ]);
  });

  test("ignores reads of non-skill files", () => {
    expect(
      detectSkills([
        turn({
          role: "assistant",
          toolCalls: [{ name: "Read", args: { path: "/skills/biome/ref.md" } }],
        }),
      ]),
    ).toEqual([]);
  });

  test("de-duplicates repeated usages but keeps distinct sources", () => {
    const skills = detectSkills([
      turn({
        customType: "skill-invocation",
        details: { name: "vitest", path: "/skills/vitest/SKILL.md" },
      }),
      turn({
        role: "assistant",
        toolCalls: [
          { name: "Read", args: { path: "/skills/vitest/SKILL.md" } },
          { name: "Read", args: { path: "/skills/vitest/SKILL.md" } },
        ],
      }),
    ]);

    expect(skills).toEqual([
      { name: "vitest", path: "/skills/vitest/SKILL.md", source: "invocation" },
      { name: "vitest", path: "/skills/vitest/SKILL.md", source: "read" },
    ]);
  });
});
