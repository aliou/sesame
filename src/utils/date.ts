/**
 * Helper for parsing relative dates
 */

export function parseRelativeDate(input: string): string {
  // If it looks like an ISO date, return as-is
  if (input.match(/^\d{4}-\d{2}-\d{2}/)) {
    return input;
  }

  // Parse relative dates: 7d, 2w, 1m
  const match = input.match(/^(\d+)([dwm])$/);
  if (!match) {
    throw new Error(
      `Invalid date format: ${input}. Use ISO date (YYYY-MM-DD) or relative format (7d, 2w, 1m)`,
    );
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2];

  const now = new Date();
  let target: Date;

  switch (unit) {
    case "d":
      target = new Date(now.getTime() - amount * 24 * 60 * 60 * 1000);
      break;
    case "w":
      target = new Date(now.getTime() - amount * 7 * 24 * 60 * 60 * 1000);
      break;
    case "m":
      target = new Date(now);
      target.setMonth(target.getMonth() - amount);
      break;
    default:
      throw new Error(`Unknown date unit: ${unit}`);
  }

  return target.toISOString().split("T")[0];
}
