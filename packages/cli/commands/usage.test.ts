import { describe, expect, test } from "vitest";
import pkg from "../package.json" with { type: "json" };
import { fullUsageText, printUsageFor, VERSION } from "../usage";

describe("CLI version", () => {
  test("VERSION matches package.json", () => {
    expect(VERSION).toBe(pkg.version);
  });

  test("VERSION is a non-empty semver-like string", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe("full usage", () => {
  test("lists every command", () => {
    const text = fullUsageText();
    for (const command of ["index", "search", "skills", "status", "watch"]) {
      expect(text).toContain(command);
    }
  });

  test("documents global --help and --version", () => {
    const text = fullUsageText();
    expect(text).toContain("--help, -h");
    expect(text).toContain("--version, -V");
  });
});

describe("per-command usage (printUsageFor)", () => {
  test("returns command-specific text for each known command", () => {
    for (const command of ["index", "search", "skills", "status", "watch"]) {
      const text = printUsageFor(command);
      expect(text).toContain(`Usage: sesame ${command}`);
      // Every command's help documents the global flags.
      expect(text).toContain("--help, -h");
      expect(text).toContain("--version, -V");
    }
  });

  test("search usage documents search-only options", () => {
    const text = printUsageFor("search");
    expect(text).toContain("--cwd <path>");
    expect(text).toContain("--limit <n>");
    expect(text).toContain("--skill <text>");
    expect(text).toContain("--arg <t:k=v>");
  });

  test("skills usage documents skills-only options", () => {
    const text = printUsageFor("skills");
    expect(text).toContain("--actor <kind>");
    expect(text).toContain("--limit <n>");
  });

  test("watch usage documents --interval", () => {
    const text = printUsageFor("watch");
    expect(text).toContain("--interval <seconds>");
  });

  test("index usage documents --full", () => {
    const text = printUsageFor("index");
    expect(text).toContain("--full");
  });

  test("returns empty string for unknown command", () => {
    expect(printUsageFor("nope")).toBe("");
  });
});
