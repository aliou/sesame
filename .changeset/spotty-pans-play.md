---
"@aliou/sesame": minor
"@aliou/sesame-cli": minor
---

Add skill-based filtering.

Sesame now records which skills each session used, from two signals: `skill-invocation` custom messages injected by the `skill-autocomplete` hook, and read tool calls that load a `SKILL.md` file. Usage is stored in a new `session_skills` table.

- `sesame search --skill <name>` filters by exact skill name (case-insensitive)
- `sesame search --skill-path <substring>` filters by `SKILL.md` path; combined with `--skill` both must match the same skill
- `sesame skills` lists indexed skills with session counts, sources, and paths
- Search output lists each result's skills
- Library adds `SearchOptions.skill` / `skillPath`, the same two options on `ListSessionsOptions`, plus `getSessionSkills`, `getSkillsForSessions`, `listIndexedSkills`, `detectSkills`, `skillNameFromPath`, and `ParsedSession.skills`

Migration 4 resets stored mtimes, so the next `sesame index` backfills skills for existing indexes.

`insertSession` now replaces an existing session inside its transaction, so an interrupted re-index can no longer leave a session deleted without a replacement.
