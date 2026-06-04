import { vol } from "memfs";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { readFirstLine } from "./io";

vi.mock("node:fs");

describe("readFirstLine", () => {
  beforeEach(() => {
    vol.reset();
  });

  test("reads the first line from a single-line file", () => {
    vol.fromJSON({ "/tmp/session.txt": "hello world" });

    expect(readFirstLine("/tmp/session.txt")).toBe("hello world");
  });

  test("reads only the first line from a multi-line file", () => {
    vol.fromJSON({
      "/tmp/session.txt": "first line\nsecond line\nthird line",
    });

    expect(readFirstLine("/tmp/session.txt")).toBe("first line");
  });

  test("handles files whose first line is shorter than buffer size", () => {
    vol.fromJSON({
      "/tmp/session.jsonl": '{"type":"session","id":"abc123"}\nmore data',
    });

    expect(readFirstLine("/tmp/session.jsonl")).toBe(
      '{"type":"session","id":"abc123"}',
    );
  });

  test("handles large files efficiently", () => {
    const firstLine = '{"type":"session","id":"large-test"}';
    vol.fromJSON({
      "/tmp/large-session.jsonl": `${firstLine}\n${"x".repeat(1024 * 1024)}`,
    });

    expect(readFirstLine("/tmp/large-session.jsonl")).toBe(firstLine);
  });

  test("returns null when first line exceeds 4KB", () => {
    vol.fromJSON({ "/tmp/long-line.txt": "x".repeat(5000) });

    expect(readFirstLine("/tmp/long-line.txt")).toBeNull();
  });

  test("returns null for empty files", () => {
    vol.fromJSON({ "/tmp/empty.txt": "" });

    expect(readFirstLine("/tmp/empty.txt")).toBeNull();
  });

  test("returns null for nonexistent files", () => {
    expect(readFirstLine("/tmp/missing.txt")).toBeNull();
  });

  test("handles a file with only a newline", () => {
    vol.fromJSON({ "/tmp/newline.txt": "\nsecond line" });

    expect(readFirstLine("/tmp/newline.txt")).toBe("");
  });
});
