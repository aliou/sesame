/**
 * Sesame library entry point
 */

export type { IndexResult } from "./indexer/index";
export { indexSessions } from "./indexer/index";
export { PiParser } from "./parsers/pi";
export type {
  SearchOptions,
  SearchResult,
  StoredChunk,
  StoredSession,
} from "./storage/db";

export {
  deleteSession,
  dropAll,
  getSessionMtime,
  getStats,
  insertSession,
  openDatabase,
  search,
} from "./storage/db";
export type {
  ParsedSession,
  SessionParser,
  ToolCall,
  Turn,
} from "./types/session";
export type { SesameConfig, SessionSource } from "./utils/config";
export { expandPath, loadConfig } from "./utils/config";
export { parseRelativeDate } from "./utils/date";
export { getXDGPaths } from "./utils/xdg";
