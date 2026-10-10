import { describe, expect, test } from "vitest";
import { formatWatchEvent } from "./watch-cmd";

const indexed = {
  timestamp: "2026-05-08T12:00:00.000Z",
  path: "/sessions",
  added: 1,
  updated: 0,
  skipped: 42,
  errors: 0,
};

describe("formatWatchEvent", () => {
  test("human line by default", () => {
    expect(formatWatchEvent(indexed, false)).toBe(
      "2026-05-08T12:00:00.000Z /sessions added=1 updated=0 skipped=42 errors=0",
    );
  });

  test("one compact JSON object with --output json", () => {
    expect(formatWatchEvent(indexed, true)).toBe(JSON.stringify(indexed));
  });

  test("error events", () => {
    const event = { timestamp: indexed.timestamp, path: "/x", error: "boom" };
    expect(formatWatchEvent(event, false)).toBe(
      "2026-05-08T12:00:00.000Z /x error: boom",
    );
    expect(JSON.parse(formatWatchEvent(event, true))).toEqual(event);
  });
});
