#!/usr/bin/env bash
set -e
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd packages/sdk
echo "==> Building SDK..."
pnpm build
echo "==> Done!"
