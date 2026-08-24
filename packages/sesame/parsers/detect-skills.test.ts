/**
 * Tests for skill usage detection.
 */

import { describe, expect, it } from "vitest";
import type { Turn } from "../types/session";
import {
  detectSkills,
  parseSkillDescription,
  skillNameFromPath,
} from "./detect-skills";

describe("skillNameFromPath", () => {
  it("extracts skill name from SKILL.md path", () => {
    expect(skillNameFromPath("/path/to/skills/vitest/SKILL.md")).toBe("vitest");
    expect(skillNameFromPath("/skills/react/SKILL.md")).toBe("react");
  });

  it("is case-insensitive on the filename", () => {
    expect(skillNameFromPath("/a/b/vitest/skill.md")).toBe("vitest");
  });

  it("returns null for non-SKILL.md files", () => {
    expect(skillNameFromPath("/path/to/skills/vitest.md")).toBeNull();
    expect(skillNameFromPath("/path/readme.md")).toBeNull();
    expect(skillNameFromPath("/no/skill.md/meta.js")).toBeNull();
  });

  it("ignores empty or invalid skill names", () => {
    expect(skillNameFromPath("SKILL.md")).toBeNull();
    expect(skillNameFromPath("/SKILL.md")).toBeNull();
  });
});

describe("detectSlashInvocation", () => {
  it('detects inline <skill name="..." location="..."> at start of user message', () => {
    const turn: Turn = {
      role: "user",
      textContent:
        '<skill name="vitest" location="/path/to/skills/vitest/SKILL.md"> test command here',
      codeBlocks: [],
      toolCalls: [],
    };

    const skills = detectSkills([turn]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("vitest");
    expect(skills[0].path).toBe("/path/to/skills/vitest/SKILL.md");
    expect(skills[0].actor).toBe("user");
    expect(skills[0].detail).toBe("slash");
  });

  it("detects inline skill block before other user text", () => {
    const turn: Turn = {
      role: "user",
      textContent:
        '<skill name="frontend-design" location="/path/to/frontend-design/SKILL.md"> this is a test message',
      codeBlocks: [],
      toolCalls: [],
    };

    const skills = detectSkills([turn]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("frontend-design");
    expect(skills[0].actor).toBe("user");
    expect(skills[0].detail).toBe("slash");
  });

  it("does not match agent messages", () => {
    const turn: Turn = {
      role: "assistant",
      textContent: '<skill name="gnupg" location="/path/to/SKILL.md">',
      codeBlocks: [],
      toolCalls: [],
    };

    const skills = detectSkills([turn]);
    expect(skills).toHaveLength(0);
  });

  it("extracts skill name when inline block contains only parsed values", () => {
    const turn: Turn = {
      role: "user",
      textContent: '<skill name="agentic" location="/skills/agentic/SKILL.md">',
      codeBlocks: [],
      toolCalls: [],
    };

    const skills = detectSkills([turn]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("agentic");
    expect(skills[0].actor).toBe("user");
    expect(skills[0].detail).toBe("slash");
  });
});

describe("detectAutocompleteInvocation", () => {
  it("detects custom_message skill-invocation from details", () => {
    const turn: Turn = {
      role: "system",
      customType: "skill-invocation",
      details: {
        name: "biome",
        path: "/skills/biome/SKILL.md",
      },
      textContent:
        '[skill-invocation] <skill name="biome" location="/skills/biome/SKILL.md">',
      codeBlocks: [],
      toolCalls: [],
    };

    const skills = detectSkills([turn]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("biome");
    expect(skills[0].actor).toBe("user");
    expect(skills[0].detail).toBe("autocomplete");
  });

  it("falls back to inline block when details are missing", () => {
    const turn: Turn = {
      role: "system",
      customType: "skill-invocation",
      textContent:
        '<skill name="tailwind" location="/skills/tailwind/SKILL.md"> some content',
      codeBlocks: [],
      toolCalls: [],
    };

    const skills = detectSkills([turn]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("tailwind");
    expect(skills[0].actor).toBe("user");
    expect(skills[0].detail).toBe("autocomplete");
  });

  it("extracts skill name from inline block when details missing name", () => {
    const turn: Turn = {
      role: "system",
      customType: "skill-invocation",
      textContent: '<skill name="" location="/skills/vitest/SKILL.md">',
      codeBlocks: [],
      toolCalls: [],
    };

    const skills = detectSkills([turn]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("vitest");
    expect(skills[0].actor).toBe("user");
    expect(skills[0].detail).toBe("autocomplete");
  });

  it("does not match non-skill-invocation custom messages", () => {
    const turn: Turn = {
      role: "system",
      customType: "compaction",
      textContent: "Session has been compaction",
      details: {},
      codeBlocks: [],
      toolCalls: [],
    };

    const skills = detectSkills([turn]);
    expect(skills).toHaveLength(0);
  });
});

describe("detectReads", () => {
  it("detects read tool with path ending in /SKILL.md", () => {
    const turn: Turn = {
      role: "assistant",
      textContent: "reading skill",
      codeBlocks: [],
      toolCalls: [
        {
          name: "read",
          args: {
            path: "/skills/vitest/SKILL.md",
          },
        },
      ],
    };

    const skills = detectSkills([turn]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("vitest");
    expect(skills[0].path).toBe("/skills/vitest/SKILL.md");
    expect(skills[0].actor).toBe("agent");
    expect(skills[0].detail).toBeNull();
  });

  it("detects read_file with filePath", () => {
    const turn: Turn = {
      role: "assistant",
      textContent: "reading file",
      codeBlocks: [],
      toolCalls: [
        {
          name: "read_file",
          args: {
            filePath: "/skills/react/SKILL.md",
          },
        },
      ],
    };

    const skills = detectSkills([turn]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("react");
    expect(skills[0].actor).toBe("agent");
    expect(skills[0].detail).toBeNull();
  });

  it("detects view with filePath", () => {
    const turn: Turn = {
      role: "assistant",
      textContent: "viewing file",
      codeBlocks: [],
      toolCalls: [
        {
          name: "view",
          args: {
            filePath: "/skills/generating-system-schemas/SKILL.md",
          },
        },
      ],
    };

    const skills = detectSkills([turn]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("generating-system-schemas");
    expect(skills[0].actor).toBe("agent");
    expect(skills[0].detail).toBeNull();
  });

  it("detects cat with filePath", () => {
    const turn: Turn = {
      role: "assistant",
      textContent: "cat file",
      codeBlocks: [],
      toolCalls: [
        {
          name: "cat",
          args: {
            filePath: "/skills/designing-webpages/SKILL.md",
          },
        },
      ],
    };

    const skills = detectSkills([turn]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("designing-webpages");
    expect(skills[0].actor).toBe("agent");
    expect(skills[0].detail).toBeNull();
  });

  it("detects read with file_path alternative key", () => {
    const turn: Turn = {
      role: "assistant",
      textContent: "reading",
      codeBlocks: [],
      toolCalls: [
        {
          name: "read",
          args: {
            file_path: "/skills/typescript-project/SKILL.md",
          },
        },
      ],
    };

    const skills = detectSkills([turn]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("typescript-project");
    expect(skills[0].actor).toBe("agent");
    expect(skills[0].detail).toBeNull();
  });

  it("ignores reads of non-SKILL.md files", () => {
    const turn: Turn = {
      role: "assistant",
      textContent: "reading",
      codeBlocks: [],
      toolCalls: [
        {
          name: "read",
          args: {
            path: "/skills/vitest/README.md",
          },
        },
      ],
    };

    const skills = detectSkills([turn]);
    expect(skills).toHaveLength(0);
  });

  it("ignores read tools without path", () => {
    const turn: Turn = {
      role: "assistant",
      textContent: "reading",
      codeBlocks: [],
      toolCalls: [
        {
          name: "read",
          args: {},
        },
      ],
    };

    const skills = detectSkills([turn]);
    expect(skills).toHaveLength(0);
  });

  it("honors path order, taking the first valid path", () => {
    const turn: Turn = {
      role: "assistant",
      textContent: "reading",
      codeBlocks: [],
      toolCalls: [
        {
          name: "read",
          args: {
            path: "/other/file.md",
            other_key: "/skills/vitest/SKILL.md",
          },
        },
        {
          name: "read",
          args: {
            path: "/another/file.md",
          },
        },
        {
          name: "read",
          args: {
            path: "/skills/vitest/SKILL.md",
          },
        },
      ],
    };

    const skills = detectSkills([turn]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("vitest");
  });
});

describe("comprehensive interaction", () => {
  it("detects all three shapes in one session turn pattern", () => {
    const turn: Turn = {
      role: "user",
      textContent:
        '<skill name="tailwind" location="/skills/tailwind/SKILL.md"> Using tailwind for styling',
      codeBlocks: [],
      toolCalls: [],
    };

    const turn2: Turn = {
      role: "system",
      customType: "skill-invocation",
      details: {
        name: "biome",
        path: "/skills/biome/SKILL.md",
      },
      textContent:
        '[autocomplete] <skill name="biome" location="/skills/biome/SKILL.md">',
      codeBlocks: [],
      toolCalls: [],
    };

    const turn3: Turn = {
      role: "assistant",
      textContent: "Looking up skill",
      codeBlocks: [],
      toolCalls: [
        {
          name: "read",
          args: {
            path: "/skills/typescript-project/SKILL.md",
          },
        },
      ],
    };

    const skills = detectSkills([turn, turn2, turn3]);
    expect(skills).toHaveLength(3);
    expect(skills[0].name).toBe("tailwind");
    expect(skills[0].actor).toBe("user");
    expect(skills[0].detail).toBe("slash");

    expect(skills[1].name).toBe("biome");
    expect(skills[1].actor).toBe("user");
    expect(skills[1].detail).toBe("autocomplete");

    expect(skills[2].name).toBe("typescript-project");
    expect(skills[2].actor).toBe("agent");
    expect(skills[2].detail).toBeNull();
  });
});

describe("deduplication", () => {
  it("collapses repeated usages but keeps distinct usage variants", () => {
    const skills = detectSkills([
      {
        role: "system",
        textContent: "",
        codeBlocks: [],
        toolCalls: [],
        customType: "skill-invocation",
        details: { name: "vitest", path: "/skills/vitest/SKILL.md" },
      },
      {
        role: "assistant",
        textContent: "",
        codeBlocks: [],
        toolCalls: [
          { name: "read", args: { path: "/skills/vitest/SKILL.md" } },
          { name: "read", args: { path: "/skills/vitest/SKILL.md" } },
        ],
      },
    ]);

    expect(skills).toEqual([
      {
        name: "vitest",
        path: "/skills/vitest/SKILL.md",
        actor: "user",
        detail: "autocomplete",
        description: null,
      },
      {
        name: "vitest",
        path: "/skills/vitest/SKILL.md",
        actor: "agent",
        detail: null,
      },
    ]);
  });
});

describe("parseSkillDescription", () => {
  it("extracts an unquoted description from frontmatter", () => {
    const md =
      "---\nname: vitest\ndescription: Vitest testing patterns\n---\n\n# Vitest\n";
    expect(parseSkillDescription(md)).toBe("Vitest testing patterns");
  });

  it("strips surrounding quotes", () => {
    expect(
      parseSkillDescription('---\ndescription: "Quoted value"\n---\n'),
    ).toBe("Quoted value");
    expect(
      parseSkillDescription("---\ndescription: 'Single quoted'\n---\n"),
    ).toBe("Single quoted");
  });

  it("keeps colons inside the description", () => {
    expect(
      parseSkillDescription("---\ndescription: Use when: writing tests\n---\n"),
    ).toBe("Use when: writing tests");
  });

  it("returns null without frontmatter or without the key", () => {
    expect(
      parseSkillDescription("# No frontmatter\ndescription: not this one\n"),
    ).toBeNull();
    expect(parseSkillDescription("---\nname: vitest\n---\n")).toBeNull();
    expect(parseSkillDescription("---\nnever closed\n")).toBeNull();
    expect(parseSkillDescription("")).toBeNull();
  });
});
