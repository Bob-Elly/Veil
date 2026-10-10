#!/usr/bin/env bash
set -e

# Load NVM and Paths
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export PATH="$HOME/.foundry/bin:$HOME/.local/bin:$PATH"

echo "==> Starting Anvil in the background..."
anvil --gas-limit 300000000 > anvil.log 2>&1 &
ANVIL_PID=$!

sleep 2

echo "==> Running E2E tests..."
cd e2e
npm i
node e2e.mjs
node circuit-negative.mjs

echo "==> E2E Tests Completed Successfully!"
kill $ANVIL_PID
