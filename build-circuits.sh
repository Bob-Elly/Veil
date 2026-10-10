#!/usr/bin/env bash
set -e

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Add Circom & Foundry to PATH
export PATH="$HOME/.local/bin:$HOME/.foundry/bin:$PATH"

echo "==> Building Circuits..."
cd circuits
npm i
bash scripts/setup.sh

echo "==> Copying Verifier.sol..."
mkdir -p ../contracts/src
cp build/Verifier.sol ../contracts/src/Verifier.sol

echo "==> Circuits Build Complete!"
