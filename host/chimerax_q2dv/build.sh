#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cp "$ROOT/index.html" "$HERE/src/html/index.html"
cp "$ROOT/mcp/mavedb_provider.py" "$HERE/src/mavedb_provider.py"
echo "Synced index.html and mavedb_provider.py into $HERE/src"
