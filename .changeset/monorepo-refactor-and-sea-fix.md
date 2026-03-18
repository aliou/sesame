---
"@aliou/sesame": patch
---

Refactored the project into a pnpm monorepo with separate workspace packages for the library, CLI, pi extension, and skill. No public API changes to the library itself.

Fixed the CLI SEA binary build to correctly bundle the `@aliou/sesame` dependency instead of leaving it as an external require, which caused the binary to crash with `ERR_UNKNOWN_BUILTIN_MODULE` at runtime.
