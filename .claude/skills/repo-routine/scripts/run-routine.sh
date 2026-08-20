#!/bin/bash
# run-routine.sh: Entry point for the repo routine
# Usage: ./run-routine.sh <repo-url1> [repo-url2] ...

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROUTINE_DIR="${ROUTINE_DIR:-/tmp/routine}"

echo "🚀 Repo Routine Starting"
echo "Repos: $*"
echo ""

# Step 1: Clone all repos
"$SCRIPT_DIR/clone-repos.sh" "$@"

echo ""
echo "─────────────────────────────"
echo "Running automated audits..."
echo "─────────────────────────────"

# Step 2: Audit each repo
for URL in "$@"; do
  NAME=$(basename "$URL" .git)
  DEST="$ROUTINE_DIR/$NAME"
  echo ""
  "$SCRIPT_DIR/audit-repo.sh" "$DEST"
done

echo ""
echo "✅ Automated phase complete."
echo "Now load the SKILL.md in Claude and run Phases 1–5 for:"
for URL in "$@"; do
  echo "  → $(basename "$URL" .git): $ROUTINE_DIR/$(basename "$URL" .git)"
done
