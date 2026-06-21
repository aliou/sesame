---
"@aliou/sesame": minor
"@aliou/sesame-cli": minor
---

Bump Node engine requirement to >=26.0.0 and migrate binary builds to
@tsdown/exe cross-platform SEA (replaces per-platform CI matrix with a
single build job; drops useCodeCache which is incompatible with
cross-platform SEAs). Repos using the flake devShell now get Node 26.
