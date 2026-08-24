/**
 * Shared CLI argument parsing helpers.
 *
 * Every value-taking flag must fail loudly when its value is missing, and
 * numeric flags must validate their value. Centralizing this keeps the
 * per-command parsers consistent with clig.dev conventions.
 */

/**
 * Read the value for a flag at `index` (the value lives at `index + 1`).
 * Throws when the value is missing or absent at the end of argv.
 */
export function takeValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value === undefined) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

/**
 * Read and validate a positive integer value for a flag at `index`.
 * Throws when the value is missing or not a positive integer.
 */
export function takePositiveInt(
  args: string[],
  index: number,
  flag: string,
): number {
  const raw = takeValue(args, index, flag);
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return value;
}
