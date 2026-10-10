#!/usr/bin/env bash
set -e

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "==> Approving builds and running pnpm install..."
pnpm approve-builds
pnpm install

echo "==> Dependencies installed successfully!"
