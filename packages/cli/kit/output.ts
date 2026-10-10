// Adapted from @378labs/sbx-cli-kit 4.3.0 (homelab/sandbox libraries/cli-kit).

import { label } from "./colors";
import { getCompact, getOutputMode, getPretty, getQuiet } from "./context";

export type TableColumn<T> = {
  header: string;
  get: (row: T) => unknown;
};

const COLUMN_GAP = "   ";
// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI SGR sequences are control sequences by definition
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function visibleLength(value: string): number {
  return value.replace(ANSI_PATTERN, "").length;
}

function padVisible(value: string, width: number): string {
  const pad = width - visibleLength(value);
  return pad > 0 ? value + " ".repeat(pad) : value;
}

export function jsonSpacing(
  options: { pretty?: boolean; compact?: boolean },
  isTty: boolean,
): number {
  if (options.pretty) return 2;
  if (options.compact) return 0;
  return isTty ? 2 : 0;
}

export function writeJson(value: unknown): void {
  const spacing = jsonSpacing(
    { pretty: getPretty(), compact: getCompact() },
    process.stdout.isTTY === true,
  );
  process.stdout.write(`${JSON.stringify(value, null, spacing)}\n`);
}

export function writeHuman(text: string): void {
  process.stdout.write(`${text}\n`);
}

/** Diagnostics, progress, and hints. Always stderr so stdout stays data. */
export function writeStderr(text: string): void {
  process.stderr.write(`${text}\n`);
}

/** Progress lines for human mode. Silent with --quiet or JSON output. */
export function writeProgress(text: string): void {
  if (getQuiet() || isJson()) return;
  writeStderr(text);
}

export function writeConfirmation(text: string): void {
  if (getQuiet()) return;
  process.stdout.write(`${text}\n`);
}

export function isJson(): boolean {
  return getOutputMode() === "json";
}

export function renderTable<T>(columns: TableColumn<T>[], rows: T[]): string {
  const header = columns.map((column) => label(column.header.toUpperCase()));
  const body = rows.map((row) =>
    columns.map((column) => formatCell(column.get(row))),
  );
  const matrix = [header, ...body];
  const widths = columns.map((_, index) =>
    Math.max(...matrix.map((cells) => visibleLength(cells[index] ?? ""))),
  );
  return matrix
    .map((cells) =>
      cells
        .map((cell, index) =>
          index === cells.length - 1 ? cell : padVisible(cell, widths[index]),
        )
        .join(COLUMN_GAP)
        .trimEnd(),
    )
    .join("\n");
}

export function renderFields(rows: [string, string][]): string {
  const width = Math.max(...rows.map(([key]) => key.length));
  return rows
    .map(
      ([key, value]) =>
        `${padVisible(label(key.toUpperCase()), width)}${COLUMN_GAP}${value}`,
    )
    .join("\n");
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return "-";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const rendered =
    value >= 10 || unit === 0 || Number.isInteger(value)
      ? Math.round(value).toString()
      : value.toFixed(1);
  return `${rendered}${units[unit]}`;
}

function formatCell(value: unknown): string {
  if (value === undefined || value === null) return "-";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}
