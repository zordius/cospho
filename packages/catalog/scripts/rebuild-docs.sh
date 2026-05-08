#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../../.." && pwd)"
cd "$ROOT"

for f in docs/albums/*.html; do
  [ -e "$f" ] || continue
  id="$(basename "$f" .html)"
  echo "→ generate-html $id"
  pnpm --filter @cospho/catalog generate-html "$id"
done

echo "→ build-index"
pnpm --filter @cospho/catalog build-index

echo "Done."
