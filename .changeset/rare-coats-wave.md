---
"@aliou/sesame": patch
---

Prevent sqlite lock contention during indexing by adding a cross-process index lock and serializing watch-triggered reindex runs. Also add tests for lock behavior and watch queue serialization.
