#!/usr/bin/env bash
set -e
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "==> Running pnpm install with ignore-scripts..."
pnpm install --ignore-scripts

echo "==> Done!"
