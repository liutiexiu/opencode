#!/usr/bin/env bash
set -e

HASH=$(git rev-parse --short HEAD)
BINARY=packages/opencode/dist/opencode-linux-x64/bin/opencode
VERSIONS_DIR="$HOME/.local/bin/opencode-versions"
TARGET_DIR="$VERSIONS_DIR/$HASH"
LINK="$HOME/.local/bin/opencode"

if [ ! -f "$BINARY" ]; then
  echo "Error: binary not found at $BINARY"
  echo "Run the build first: OPENCODE_VERSION=1.4.11 ./packages/opencode/script/build.ts --single --skip-install"
  exit 1
fi

mkdir -p "$TARGET_DIR"
cp "$BINARY" "$TARGET_DIR/opencode"
chmod +x "$TARGET_DIR/opencode"

ln -sf "$TARGET_DIR/opencode" "$LINK"
echo "Installed: $LINK -> $TARGET_DIR/opencode"
echo "Version: $("$LINK" --version 2>/dev/null || echo 'unknown')"
echo ""
echo "To rollback, run:"
echo "  ls ~/.local/bin/opencode-versions/"
echo "  ln -sf ~/.local/bin/opencode-versions/<hash>/opencode $LINK"
