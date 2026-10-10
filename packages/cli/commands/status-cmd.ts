/**
 * sesame status - show index statistics.
 */

import { getStats } from "@aliou/sesame";
import { command } from "@drizzle-team/brocli";
import { openIndex, sesamePaths } from "../context";
import {
  formatBytes,
  isJson,
  renderFields,
  writeHuman,
  writeJson,
} from "../kit/output";

export const statusCommand = command({
  name: "status",
  desc: "Show index statistics and location",
  handler: async () => runStatus(),
});

async function runStatus(): Promise<void> {
  const paths = sesamePaths();
  const db = openIndex();
  try {
    const stats = getStats(db);
    if (isJson()) {
      writeJson({ ...stats, databasePath: paths.databasePath });
      return;
    }
    writeHuman(
      renderFields([
        ["Sessions", stats.sessionCount.toLocaleString()],
        ["Chunks", stats.chunkCount.toLocaleString()],
        ["Database", formatBytes(stats.dbSizeBytes)],
        ["Last sync", stats.lastSyncAt ?? "never"],
        ["Location", paths.databasePath],
      ]),
    );
  } finally {
    db.close();
  }
}
