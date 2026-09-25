#!/usr/bin/env bash
# Blog autopilot runner. Syncs the branch, runs the skill headless, safety-net pushes.
# Site-agnostic: derives the repo root from its own location and reads
# autopilot.config.json for the branch. Run it by hand or from any scheduler.
# Usage:
#   scripts/blog-autopilot/run.sh [--dry-run]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${BLOG_REPO:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
cd "$REPO"
if [ -f .env ]; then set -a && . ./.env && set +a; fi

BRANCH="$(node -e "console.log(JSON.parse(require('fs').readFileSync('autopilot.config.json','utf8')).git?.branch||'main')" 2>/dev/null || echo main)"

# Claude Code refuses --dangerously-skip-permissions as root unless this is set.
# Only run this on a dedicated single-tenant machine or inside CI.
export IS_SANDBOX=1

DRY=""
[ "${1:-}" = "--dry-run" ] && DRY="--dry-run"

# Git identity: prefer existing repo config, else env, else fail loudly later on commit.
if [ -n "${GIT_USER_NAME:-}" ]; then git config user.name "$GIT_USER_NAME"; fi
if [ -n "${GIT_USER_EMAIL:-}" ]; then git config user.email "$GIT_USER_EMAIL"; fi

# Sync with the remote before writing.
git fetch origin
git rev-parse --verify "$BRANCH" >/dev/null 2>&1 || {
  echo "ERROR: branch '$BRANCH' (autopilot.config.json git.branch) does not exist in this repo." >&2
  echo "Current branch: $(git rev-parse --abbrev-ref HEAD). Fix the config or rename the branch." >&2
  exit 1
}
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH" || git reset --hard "origin/$BRANCH"

# Run the agent (picks topic, writes, gates, commits, pushes, verifies, notifies).
claude -p "/blog-autopilot ${DRY}" --dangerously-skip-permissions

if [ -n "$DRY" ]; then
  echo "dry-run complete; not pushing"
  exit 0
fi

# Safety-net push; the skill already pushed. One rebase-retry if the remote moved.
if ! git push origin "$BRANCH"; then
  git pull --rebase origin "$BRANCH"
  git push origin "$BRANCH"
fi
