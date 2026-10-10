import { describe, expect, test } from "vitest";
import { parseToolArg } from "./search-cmd";

describe("parseToolArg", () => {
  test("parses tool:key=value and lowercases tool and key", () => {
    expect(parseToolArg("Bash:Command=git push")).toEqual({
      tool: "bash",
      key: "command",
      value: "git push",
    });
  });

  test("keeps = inside the value", () => {
    expect(parseToolArg("bash:command=a=b").value).toBe("a=b");
  });

  test.each(["bash", "bash:command", "bash:command=", ":command=x"])(
    "rejects malformed %s",
    (spec) => {
      expect(() => parseToolArg(spec)).toThrow("expected tool:key=value");
    },
  );

  test("rejects tools and keys outside the allowlist", () => {
    expect(() => parseToolArg("nope:x=y")).toThrow('unknown tool "nope"');
    expect(() => parseToolArg("bash:path=y")).toThrow(
      'unknown parameter "path"',
    );
  });
});
