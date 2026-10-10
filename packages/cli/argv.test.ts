import { describe, expect, test } from "vitest";
import { decodeRepeated, foldRepeatedOptions, hoistCommand } from "./argv";

const argv = (...args: string[]) => ["node", "sesame", ...args];

describe("foldRepeatedOptions", () => {
  test("folds repeated search options into one JSON value each", () => {
    expect(
      foldRepeatedOptions(
        argv(
          "-o",
          "json",
          "search",
          "q",
          "--exclude",
          "a",
          "--arg",
          "bash:command=x=y",
          "--exclude=b",
          "--tools",
        ),
      ),
    ).toEqual(
      argv(
        "-o",
        "json",
        "search",
        "q",
        "--tools",
        "--exclude",
        '["a","b"]',
        "--arg",
        '["bash:command=x=y"]',
      ),
    );
  });

  test("leaves a flag with no value for Brocli to report", () => {
    expect(foldRepeatedOptions(argv("search", "--exclude"))).toEqual(
      argv("search", "--exclude"),
    );
    expect(foldRepeatedOptions(argv("search", "--exclude", "--json"))).toEqual(
      argv("search", "--exclude", "--json"),
    );
  });

  test("keeps everything after -- as is", () => {
    const input = argv("search", "--exclude", "a", "--", "--exclude", "b");
    expect(foldRepeatedOptions(input)).toEqual(
      argv("search", "--exclude", '["a"]', "--", "--exclude", "b"),
    );
  });

  test("ignores other commands", () => {
    const input = argv("complete", "--", "search", "--exclude", "a");
    expect(foldRepeatedOptions(input)).toBe(input);
  });
});

describe("hoistCommand", () => {
  test("moves the command in front of leading global flags", () => {
    expect(
      hoistCommand(argv("--compact", "-o", "json", "search", "q")),
    ).toEqual(argv("search", "--compact", "-o", "json", "q"));
  });

  test.each([
    [["search", "q", "--compact"]],
    [["--compact", "help", "json"]],
    [["--bogus", "status"]],
    [["--debug"]],
  ])("leaves %j alone", (args) => {
    expect(hoistCommand(argv(...args))).toEqual(argv(...args));
  });
});

describe("decodeRepeated", () => {
  test("round-trips folded values", () => {
    expect(decodeRepeated('["a","b"]')).toEqual(["a", "b"]);
    expect(decodeRepeated(undefined)).toEqual([]);
  });
});
