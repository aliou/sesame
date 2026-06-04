import { closeSync, openSync, readSync } from "node:fs";

/**
 * Maximum bytes to read when extracting the first line.
 * 4 KiB is enough for any realistic JSONL header line.
 * If a header exceeds this, readFirstLine returns null and the file
 * is treated as non-parseable (logged as a warning by the caller).
 */
const FIRST_LINE_BUF_SIZE = 4096;

/**
 * Read only the first line of a file efficiently.
 *
 * Reads at most FIRST_LINE_BUF_SIZE bytes from the start of the file, then
 * returns text up to the first `\n` (or the entire read if no newline).
 *
 * This avoids loading potentially multi-MB session files into memory just to
 * inspect the header.
 *
 * Returns null if the file cannot be read, is empty, or if the first line
 * exceeds FIRST_LINE_BUF_SIZE bytes (which would indicate an unreasonably
 * large header and likely a non-Pi file).
 */
export function readFirstLine(filePath: string): string | null {
  let fd: number | undefined;
  try {
    fd = openSync(filePath, "r");
    const buf = Buffer.alloc(FIRST_LINE_BUF_SIZE);
    const bytesRead = readSync(fd, buf, 0, FIRST_LINE_BUF_SIZE, 0);
    if (bytesRead === 0) return null;

    // Slice to the newline *before* toString to avoid mid-character
    // UTF-8 corruption if the buffer boundary lands inside a multi-byte
    // sequence.
    const newlineIdx = buf.indexOf("\n", 0, "utf-8");
    const end = newlineIdx === -1 ? bytesRead : newlineIdx;

    // If we read the full buffer without hitting a newline, the header line
    // is unreasonably large. Return null so the caller treats this as
    // non-parseable rather than silently truncating.
    if (newlineIdx === -1 && bytesRead === FIRST_LINE_BUF_SIZE) {
      return null;
    }

    return buf.subarray(0, end).toString("utf-8");
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
