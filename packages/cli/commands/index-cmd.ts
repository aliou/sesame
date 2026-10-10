/**
 * sesame index - scan configured session roots and update the index.
 */

import {
  dropAll,
  expandPath,
  type IndexResult,
  indexSessions,
  setMetadata,
} from "@aliou/sesame";
import { boolean, command } from "@drizzle-team/brocli";
import { loadSesameConfig, lockIndex, openIndex } from "../context";
import { warn } from "../kit/colors";
import { setCommandExitCode } from "../kit/context";
import {
  isJson,
  renderFields,
  writeHuman,
  writeJson,
  writeProgress,
  writeStderr,
} from "../kit/output";

/** Exit code when indexing finished but some files failed. */
export const EXIT_DEGRADED = 3;

type SourceResult = IndexResult & { path: string };

export const indexCommand = command({
  name: "index",
  desc: "Index session files (incremental by file mtime)",
  options: {
    full: boolean("full").desc("Drop and rebuild the index from scratch"),
  },
  handler: async (flags: { full?: boolean }) => runIndex(flags.full === true),
});

async function runIndex(full: boolean): Promise<void> {
  const config = await loadSesameConfig();
  const lock = lockIndex("index");
  try {
    const sources = await indexAll(config.piSessionPaths, full);
    report(sources, full);
  } finally {
    lock.release();
  }
}

async function indexAll(
  paths: string[],
  full: boolean,
): Promise<SourceResult[]> {
  const db = openIndex();
  try {
    if (full) {
      writeProgress("Dropping existing index...");
      dropAll(db);
    }
    const sources: SourceResult[] = [];
    for (const path of paths.map(expandPath)) {
      writeProgress(`Indexing ${path}...`);
      const result = await indexSessions(db, path);
      sources.push({ path, ...result });
    }
    const totals = sumResults(sources);
    // Record a sync only for clean runs that changed something.
    if (totals.errors === 0 && totals.added + totals.updated > 0) {
      setMetadata(db, "last_sync_at", new Date().toISOString());
    }
    return sources;
  } finally {
    db.close();
  }
}

export function sumResults(results: IndexResult[]): IndexResult {
  return results.reduce(
    (sum, result) => ({
      added: sum.added + result.added,
      updated: sum.updated + result.updated,
      skipped: sum.skipped + result.skipped,
      errors: sum.errors + result.errors,
    }),
    { added: 0, updated: 0, skipped: 0, errors: 0 },
  );
}

function report(sources: SourceResult[], full: boolean): void {
  const totals = sumResults(sources);
  if (isJson()) {
    writeJson({ full, sources, totals });
  } else {
    writeHuman(
      renderFields([
        ["Added", String(totals.added)],
        ["Updated", String(totals.updated)],
        ["Skipped", String(totals.skipped)],
        ["Errors", String(totals.errors)],
      ]),
    );
  }
  if (totals.errors === 0) return;
  writeStderr(warn(`warning: ${totals.errors} session files failed to index`));
  setCommandExitCode(EXIT_DEGRADED);
}
