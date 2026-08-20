#!/bin/bash
# clone-repos.sh: Clone one or more repos into /tmp/routine/<name>
# Usage: ./clone-repos.sh <url1> [url2] [url3] ...

set -e
OUTDIR="${ROUTINE_DIR:-/tmp/routine}"
mkdir -p "$OUTDIR"

if [ $# -eq 0 ]; then
  echo "Usage: clone-repos.sh <github-url> [more-urls...]"
  exit 1
fi

for URL in "$@"; do
  NAME=$(basename "$URL" .git)
  DEST="$OUTDIR/$NAME"
  if [ -d "$DEST/.git" ]; then
    echo "↻ $NAME: already exists, pulling latest"
    git -C "$DEST" pull --quiet
  else
    echo "↓ Cloning $NAME..."
    git clone --quiet "$URL" "$DEST"
    echo "✓ $NAME cloned to $DEST"
  fi
done

echo ""
echo "All repos ready in $OUTDIR"
ls "$OUTDIR"
