---
"@aliou/sesame": minor
---

Record skill usage actor/detail and add fuzzy skill search.

`session_skills.source` is replaced by `actor` (`user` | `agent`) plus `detail` (`slash` | `autocomplete` | null). A third detection shape recognizes `/skill:name` slash invocations, where pi inlines a `<skill name= location=>` block at the start of the user message. Migration 5 backfills `actor` from the legacy `source` column.

A new global skill catalog (`skills` + `skills_fts`, migration 6) records skill description versions — one row per distinct (name, description, path), bumped on `last_seen_at` when re-encountered. Descriptions come from invocation hook details or SKILL.md frontmatter.

- `SearchOptions` / `ListSessionsOptions` gain `skillQuery` (fuzzy over name + description; an unmatched query returns no sessions)
- Library adds `matchSkills`, `upsertSkillCatalog`, `skillNameExists`, `parseSkillDescription`, and the `SkillMatch` type; `SkillSummary` replaces `sources` with `actors` + `details` and gains `description`
- `ListSkillsOptions.source` becomes `actor`
- CLI: `sesame search --skill <text>` falls back to fuzzy matching when the text is not an exact skill name; `sesame skills --source` becomes `--actor` and prints the latest known description
