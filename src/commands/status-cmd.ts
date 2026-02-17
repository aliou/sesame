/**
 * Status command - shows index statistics
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { getStats, openDatabase } from "../storage/db";
import { getXDGPaths } from "../utils/xdg";

export default async function statusCommand(_args: string[]): Promise<void> {
  const paths = getXDGPaths();
  mkdirSync(paths.data, { recursive: true });
  const dbPath = join(paths.data, "index.sqlite");

  const db = openDatabase(dbPath);

  try {
    const stats = getStats(db);

    // Format database size
    const sizeMB = (stats.dbSizeBytes / (1024 * 1024)).toFixed(1);

    // Format numbers with thousands separators
    const formatNumber = (n: number) => n.toLocaleString();

    console.log("Sesame Index Status");
    console.log(`  Sessions: ${formatNumber(stats.sessionCount)}`);
    console.log(`  Chunks:   ${formatNumber(stats.chunkCount)}`);
    console.log(`  Database: ${sizeMB} MB`);
    console.log(`  Last sync: ${stats.lastSyncAt ?? "never"}`);
    console.log(`  Location: ${dbPath}`);
  } finally {
    db.close();
  }
}
