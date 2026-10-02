---
"@aliou/sesame": patch
"@aliou/sesame-cli": patch
---

Fix a crash indexing sessions whose tool results carry a non-codemode `details.calls` (e.g. `mcpScript` uses `{operation, path, ok}` without a `name`). The codemode `details` fallback now only applies to codemode results, and nested call records without a name are skipped.
