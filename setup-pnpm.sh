#!/usr/bin/env bash
set -e

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "==> Installing pnpm..."
npm install -g pnpm

echo "==> Running pnpm install in workspace..."
pnpm install

echo "==> Dependencies installed successfully!"
