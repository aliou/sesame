import { describe, expect, test } from "vitest";
import { parseRelativeDate } from "./date.ts";

describe("parseRelativeDate", () => {
  test("7d returns date 7 days ago", () => {
    const result = parseRelativeDate("7d");
    const expected = new Date();
    expected.setDate(expected.getDate() - 7);
    const expectedDate = expected.toISOString().split("T")[0];

    expect(result).toBe(expectedDate);
  });

  test("2w returns date 14 days ago", () => {
    const result = parseRelativeDate("2w");
    const expected = new Date();
    expected.setDate(expected.getDate() - 14);
    const expectedDate = expected.toISOString().split("T")[0];

    expect(result).toBe(expectedDate);
  });

  test("1m returns date ~30 days ago", () => {
    const result = parseRelativeDate("1m");
    const expected = new Date();
    expected.setMonth(expected.getMonth() - 1);
    const expectedDate = expected.toISOString().split("T")[0];

    expect(result).toBe(expectedDate);
  });

  test("3m returns date 3 months ago", () => {
    const result = parseRelativeDate("3m");
    const expected = new Date();
    expected.setMonth(expected.getMonth() - 3);
    const expectedDate = expected.toISOString().split("T")[0];

    expect(result).toBe(expectedDate);
  });

  test("ISO date 2026-01-15 returns as-is", () => {
    const result = parseRelativeDate("2026-01-15");
    expect(result).toBe("2026-01-15");
  });

  test("ISO datetime 2026-01-15T10:30:00Z returns date part", () => {
    const result = parseRelativeDate("2026-01-15T10:30:00Z");
    expect(result).toBe("2026-01-15T10:30:00Z");
  });

  test("Invalid input throws", () => {
    expect(() => parseRelativeDate("invalid")).toThrow("Invalid date format");
    expect(() => parseRelativeDate("7x")).toThrow("Invalid date format");
    expect(() => parseRelativeDate("abc")).toThrow("Invalid date format");
    expect(() => parseRelativeDate("")).toThrow("Invalid date format");
  });
});
