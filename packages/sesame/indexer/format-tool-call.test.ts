import { describe, expect, test } from "vitest";
import { formatToolCall } from "./format-tool-call";

describe("formatToolCall", () => {
  test("formats every replacement of a pi edits[] call", () => {
    const text = formatToolCall({
      name: "edit",
      args: {
        path: "src/app.ts",
        edits: [
          { oldText: "const a = 1;", newText: "const a = 2;" },
          { oldText: "return a;", newText: "return a + 1;" },
        ],
      },
    });

    expect(text).toBe(
      [
        "tool: edit",
        "path: src/app.ts",
        "old:\nconst a = 1;",
        "new:\nconst a = 2;",
        "old:\nreturn a;",
        "new:\nreturn a + 1;",
      ].join("\n"),
    );
  });

  test("formats a legacy top-level old/new edit", () => {
    const text = formatToolCall({
      name: "edit",
      args: { path: "a.ts", old_string: "foo", new_string: "bar" },
    });

    expect(text).toBe("tool: edit\npath: a.ts\nold:\nfoo\nnew:\nbar");
  });

  test("skips malformed edits[] entries", () => {
    const text = formatToolCall({
      name: "edit",
      args: { path: "a.ts", edits: [null, "oops", { newText: "added" }] },
    });

    expect(text).toBe("tool: edit\npath: a.ts\nnew:\nadded");
  });

  test("formats powershell like bash", () => {
    const text = formatToolCall({
      name: "powershell",
      args: { command: "Get-ChildItem" },
      result: "a.txt",
    });

    expect(text).toBe(
      "tool: powershell\ncommand: Get-ChildItem\noutput:\na.txt",
    );
  });
});
