/**
 * Index command - scans and indexes session files
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { indexSessions } from "../indexer/index";
import { PiParser } from "../parsers/pi";
import { dropAll, openDatabase } from "../storage/db";
import { expandPath, loadConfig } from "../utils/config";
import { getXDGPaths } from "../utils/xdg";

export default async function indexCommand(args: string[]): Promise<void> {
  // Parse --full flag
  const fullRebuild = args.includes("--full");

  // Load configuration
  const config = await loadConfig();

  // Get data directory and ensure it exists
  const paths = getXDGPaths();
  mkdirSync(paths.data, { recursive: true });

  // Open database
  const dbPath = join(paths.data, "index.sqlite");
  const db = openDatabase(dbPath);

  try {
    // Drop all data if --full flag is set
    if (fullRebuild) {
      console.log("Dropping existing index...");
      dropAll(db);
    }

    let totalAdded = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Index each source
    for (const source of config.sources) {
      const expandedPath = expandPath(source.path);

      // Get parser (only "pi" is supported for now)
      if (source.parser !== "pi") {
        console.error(
          `Skipping source ${source.path}: unsupported parser "${source.parser}"`,
        );
        continue;
      }

      const parser = new PiParser();

      console.log(`\nIndexing ${expandedPath}...`);
      const result = await indexSessions(db, expandedPath, parser);

      // Print results for this source
      if (result.added > 0) {
        console.log(`  Added: ${result.added}`);
      }
      if (result.updated > 0) {
        console.log(`  Updated: ${result.updated}`);
      }
      if (result.skipped > 0) {
        console.log(`  Skipped: ${result.skipped}`);
      }
      if (result.errors > 0) {
        console.error(`  Errors: ${result.errors}`);
      }

      // Accumulate totals
      totalAdded += result.added;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
    }

    // Print summary
    console.log(`\n${"=".repeat(50)}`);
    console.log("Indexing complete");
    console.log(`  Total added:   ${totalAdded}`);
    console.log(`  Total updated: ${totalUpdated}`);
    console.log(`  Total skipped: ${totalSkipped}`);
    if (totalErrors > 0) {
      console.log(`  Total errors:  ${totalErrors}`);
    }
  } finally {
    db.close();
  }
}
