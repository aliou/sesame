/**
 * Sesame library entry point
 */

export type { IndexResult } from "./indexer/index";
export { indexSessions } from "./indexer/index";
export { PiParser } from "./parsers/pi";
export type {
  Database,
  ListSessionsOptions,
  SearchOptions,
  SearchResult,
  StoredChunk,
  StoredSession,
} from "./storage/db";

export {
  deleteSession,
  dropAll,
  getSession,
  getSessionMtime,
  getStats,
  insertSession,
  listSessions,
  openDatabase,
  search,
  setMetadata,
} from "./storage/db";
export type { ParsedSession, ToolCall, Turn } from "./types/session";
export type { SesameConfig } from "./utils/config";
export { expandPath, loadConfig } from "./utils/config";
export { parseRelativeDate } from "./utils/date";
export type { IndexLockHandle } from "./utils/index-lock";
export { acquireIndexLock } from "./utils/index-lock";
export { getXDGPaths } from "./utils/xdg";
