# Releases

This repo uses `release-please` (not changesets) for npm releases.

## Files

- Workflow: `.github/workflows/publish.yml`
- Release Please config: `release-please-config.json`
- Release Please manifest: `.release-please-manifest.json`
- Changelog: `CHANGELOG.md`

## Trigger model

Release Please watches commits merged to `main`.

A commit is releasable when it follows Conventional Commit semantics:

- `fix:` -> patch
- `feat:` -> minor
- `feat!:` / `fix!:` or `BREAKING CHANGE:` footer -> major

Non-releasable examples:

- `chore:`
- `docs:`
- `test:`

## End-to-end flow

1. You merge regular PRs into `main`.
2. On push to `main`, `publish.yml` runs `release-please-action`.
3. If releasable commits exist since the last tag, Release Please opens or updates a Release PR.
4. The Release PR contains version + changelog updates.
5. You merge the Release PR.
6. On that merge, the same workflow runs again; Release Please creates tag + GitHub release and sets `release_created=true`.
7. The workflow then publishes to npm and uploads Bun binaries to that GitHub release.

## Notes

- No `.changeset/*.md` files are required.
- Release intent comes from commit messages, not per-PR changeset files.
- If you need to force a specific version, use a commit with a `Release-As: x.y.z` footer.
