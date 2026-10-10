#!/usr/bin/env bash
set -e

export PATH="$HOME/.foundry/bin:$PATH"

cd contracts
echo "==> Installing Forge Dependencies..."
forge install --no-git foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.1.0

echo "==> Building Contracts..."
forge build

echo "==> Running Contract Tests..."
forge test
