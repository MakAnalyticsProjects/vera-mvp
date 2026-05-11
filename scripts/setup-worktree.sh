#!/usr/bin/env bash
#
# scripts/setup-worktree.sh
# Bootstrap a fresh git worktree with the gitignored-but-required files
# it needs to actually run: env vars, the raw data export, and the
# preprocessed data artifact. Then install deps and regen Prisma.
#
# Why this exists: a fresh `git worktree add` only checks out tracked
# files. The MVP needs `apps/web/.env.local` (gitignored), the 187 MB
# `data/jobs_dedup.jsonl` (gitignored), and `data/generated.json`
# (gitignored) — without these, `pnpm dev` fails immediately and so do
# any preprocess / typecheck commands that touch those paths. Doing it
# by hand is error-prone and we've already lost time to it twice.
#
# Usage:
#   scripts/setup-worktree.sh <worktree-path>
#
# Idempotent — re-running against an already-populated worktree just
# prints "skip" for the existing files and re-runs install/generate.

set -euo pipefail

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  echo "usage: $(basename "$0") <worktree-path>" >&2
  echo "" >&2
  echo "Bootstraps a git worktree by copying gitignored files (.env.local," >&2
  echo "data/*) from the canonical main repo, then runs pnpm install +" >&2
  echo "prisma generate." >&2
  exit 1
fi

if [ ! -d "$TARGET" ]; then
  echo "error: target does not exist: $TARGET" >&2
  echo "create the worktree first: git worktree add $TARGET <branch>" >&2
  exit 1
fi

TARGET=$(cd "$TARGET" && pwd)

# Resolve the canonical main repo from `git worktree list` — its first
# entry is always the main worktree. Works regardless of where this
# script is invoked from.
MAIN_REPO=$(git -C "$TARGET" worktree list | head -1 | awk '{print $1}')

if [ "$TARGET" = "$MAIN_REPO" ]; then
  echo "error: target IS the main repo." >&2
  echo "this script is for bootstrapping worktrees, not the main checkout." >&2
  exit 1
fi

copy_if_missing() {
  local src="$1" dst="$2"
  local rel_dst="${dst/#$TARGET\//}"
  if [ ! -f "$src" ]; then
    local rel_src="${src/#$MAIN_REPO\//}"
    echo "  warn: source missing, skipping $rel_dst (no $rel_src in main repo)"
    return
  fi
  if [ -f "$dst" ]; then
    echo "  skip (exists): $rel_dst"
    return
  fi
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  echo "  copied: $rel_dst"
}

echo "Bootstrapping worktree:"
echo "  main:   $MAIN_REPO"
echo "  target: $TARGET"
echo ""
echo "→ Copying gitignored files"
copy_if_missing "$MAIN_REPO/apps/web/.env.local"   "$TARGET/apps/web/.env.local"
copy_if_missing "$MAIN_REPO/data/jobs_dedup.jsonl" "$TARGET/data/jobs_dedup.jsonl"
copy_if_missing "$MAIN_REPO/data/generated.json"   "$TARGET/data/generated.json"

echo ""
echo "→ Installing dependencies (pnpm install)"
(cd "$TARGET" && pnpm install 2>&1) | tail -3

echo ""
echo "→ Generating Prisma client"
(cd "$TARGET" && pnpm --filter @vera/web exec prisma generate 2>&1) | tail -3

echo ""
echo "Done — worktree ready at $TARGET"
echo "Next: cd $TARGET && pnpm --filter @vera/web dev --port <unused-port>"
