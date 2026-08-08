/**
 * Sesame library entry point
 */

export type { IndexResult } from "./indexer/index";
export { indexFile, indexSessions } from "./indexer/index";
export { detectSkills, skillNameFromPath } from "./parsers/detect-skills";
export { PiParser } from "./parsers/pi";
export type {
  Database,
  ListSessionsOptions,
  ListSkillsOptions,
  SearchOptions,
  SearchResult,
  SkillSummary,
  StoredChunk,
  StoredSession,
  StoredSkill,
} from "./storage/db";

export {
  deleteSession,
  dropAll,
  getSession,
  getSessionMtime,
  getSessionSkills,
  getSkillsForSessions,
  getStats,
  insertSession,
  listIndexedSkills,
  listSessions,
  openDatabase,
  search,
  setMetadata,
} from "./storage/db";
export type {
  ParsedSession,
  SessionMetadata,
  SkillUsage,
  SkillUsageSource,
  ToolCall,
  Turn,
} from "./types/session";
export type { SesameConfig } from "./utils/config";
export { expandPath, loadConfig } from "./utils/config";
export { parseRelativeDate } from "./utils/date";
export type { IndexLockHandle } from "./utils/index-lock";
export { acquireIndexLock } from "./utils/index-lock";
export { getXDGPaths } from "./utils/xdg";
