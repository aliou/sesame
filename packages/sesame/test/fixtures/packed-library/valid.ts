import {
  getSkillsForSessions,
  indexFile,
  openDatabase,
  search,
  type IndexResult,
} from "@aliou/sesame";

type IsAny<T> = 0 extends 1 & T ? true : false;

export const searchIsTyped: IsAny<typeof search> = false;
export const indexFileIsTyped: IsAny<typeof indexFile> = false;

const db = openDatabase(":memory:");
const results = search(db, "*");
const sessionIds: string[] = results.map((result) => result.sessionId);
export const skills = getSkillsForSessions(db, sessionIds);
export const indexed: Promise<IndexResult> = indexFile(db, "session.jsonl");
db.close();
