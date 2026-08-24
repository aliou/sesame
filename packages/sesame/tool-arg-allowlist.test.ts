import { describe, expect, it } from "vitest";
import {
  extractToolArgs,
  isAllowedToolArg,
  TOOL_ARG_ALLOWLIST,
} from "./tool-arg-allowlist";

describe("isAllowedToolArg", () => {
  it("matches tool and key case-insensitively", () => {
    expect(isAllowedToolArg("Find", "Pattern")).toBe(true);
    expect(isAllowedToolArg("read", "path")).toBe(true);
  });

  it("rejects unknown tools and keys", () => {
    expect(isAllowedToolArg("nope", "path")).toBe(false);
    expect(isAllowedToolArg("read", "limit")).toBe(false);
    expect(isAllowedToolArg("bash", "cwd")).toBe(false);
  });
});

describe("extractToolArgs", () => {
  it("keeps allowlisted string params, trimmed", () => {
    expect(
      extractToolArgs("find", { pattern: "  useStorage  ", path: "/tmp" }),
    ).toEqual([
      { key: "pattern", value: "useStorage" },
      { key: "path", value: "/tmp" },
    ]);
  });

  it("drops params outside the allowlist", () => {
    expect(
      extractToolArgs("read", { path: "/a", offset: 1, limit: 10 }),
    ).toEqual([{ key: "path", value: "/a" }]);
  });

  it("returns [] for unknown tools", () => {
    expect(extractToolArgs("whatever", { path: "/a" })).toEqual([]);
  });

  it("stringifies number scalars, skips objects", () => {
    expect(
      extractToolArgs("process", {
        action: "start",
        name: "dev",
        command: { nested: true },
      }),
    ).toEqual([
      { key: "action", value: "start" },
      { key: "name", value: "dev" },
    ]);
    expect(
      extractToolArgs("find_sessions", {
        query: "hooks",
        cwd: 42 as unknown,
      }),
    ).toEqual([
      { key: "query", value: "hooks" },
      { key: "cwd", value: "42" },
    ]);
  });

  it("skips empty strings", () => {
    expect(extractToolArgs("bash", { command: "   " })).toEqual([]);
  });

  it("allowlist covers the documented tools", () => {
    expect(Object.keys(TOOL_ARG_ALLOWLIST).sort()).toEqual([
      "bash",
      "edit",
      "find",
      "find_sessions",
      "grep",
      "list_sessions",
      "ls",
      "process",
      "read",
      "read_session",
      "read_url",
      "synthetic_web_search",
      "write",
    ]);
  });
});
