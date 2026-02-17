#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/check-publish-ci-deps.sh /path/to/projects
ROOT_DIR="${1:-.}"

shopt -s nullglob

echo "Scanning projects in: $ROOT_DIR"

echo
for project in "$ROOT_DIR"/*; do
  [ -d "$project" ] || continue

  workflows_dir="$project/.github/workflows"
  [ -d "$workflows_dir" ] || continue

  ci_files=("$workflows_dir"/*.yml "$workflows_dir"/*.yaml)
  has_ci=0
  for wf in "${ci_files[@]}"; do
    if grep -Eq "^name:\s*CI\b" "$wf"; then
      has_ci=1
      break
    fi
  done

  [ "$has_ci" -eq 1 ] || continue

  publish_files=("$workflows_dir"/*.yml "$workflows_dir"/*.yaml)
  for wf in "${publish_files[@]}"; do
    if ! grep -Eqi "^name:\s*Publish\b|changesets/action|release-please" "$wf"; then
      continue
    fi

    # Good if publish waits on CI workflow_run.
    if grep -Eq "workflow_run:" "$wf" && grep -Eq "workflows:\s*\[\s*\"?CI\"?\s*\]" "$wf"; then
      echo "OK    $(basename "$project") :: $(basename "$wf") waits on CI"
      continue
    fi

    # Good if publish job depends on a ci/check job in same workflow.
    if grep -Eqi "needs:\s*\[?\s*(ci|check)\b" "$wf"; then
      echo "OK    $(basename "$project") :: $(basename "$wf") has needs: ci/check"
      continue
    fi

    echo "ISSUE $(basename "$project") :: $(basename "$wf") publish may not wait for CI"
  done
done
