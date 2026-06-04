import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { readFirstLine } from "./io";

describe("readFirstLine", () => {
  let tempFiles: string[] = [];

  afterEach(() => {
    for (const f of tempFiles) {
      try {
        unlinkSync(f);
      } catch {
        void 0;
      }
    }
    tempFiles = [];
  });

  function tempPath(): string {
    const p = join(
      tmpdir(),
      `sesame-io-test-${Date.now()}-${Math.random()}.txt`,
    );
    tempFiles.push(p);
    return p;
  }

  test("reads the first line from a single-line file", () => {
    const path = tempPath();
    writeFileSync(path, "hello world");

    expect(readFirstLine(path)).toBe("hello world");
  });

  test("reads only the first line from a multi-line file", () => {
    const path = tempPath();
    writeFileSync(path, "first line\nsecond line\nthird line");

    expect(readFirstLine(path)).toBe("first line");
  });

  test("handles files whose first line is shorter than buffer size", () => {
    const path = tempPath();
    writeFileSync(path, '{"type":"session","id":"abc123"}\nmore data');

    expect(readFirstLine(path)).toBe('{"type":"session","id":"abc123"}');
  });

  test("handles large files efficiently (only reads first 4KB)", () => {
    const path = tempPath();
    // First line is short, rest of file is large
    const firstLine = '{"type":"session","id":"large-test"}';
    // Pad to over 1MB
    const body = `\n${"x".repeat(1024 * 1024)}`;
    writeFileSync(path, firstLine + body);

    // readFirstLine should return only the first line without reading the whole file
    expect(readFirstLine(path)).toBe(firstLine);
  });

  test("returns null when first line exceeds 4KB (no newline found)", () => {
    const path = tempPath();
    // Single line longer than 4KB, no newline
    writeFileSync(path, "x".repeat(5000));

    expect(readFirstLine(path)).toBeNull();
  });

  test("returns null for empty files", () => {
    const path = tempPath();
    writeFileSync(path, "");

    expect(readFirstLine(path)).toBeNull();
  });

  test("returns null for nonexistent files", () => {
    expect(readFirstLine("/nonexistent/path/file.txt")).toBeNull();
  });

  test("handles a file with only a newline", () => {
    const path = tempPath();
    writeFileSync(path, "\nsecond line");

    expect(readFirstLine(path)).toBe("");
  });
});
