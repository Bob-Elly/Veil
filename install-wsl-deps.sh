#!/usr/bin/env bash
set -e

echo "==> Installing NVM and Node.js 22..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22

echo "==> Installing Foundry..."
curl -L https://foundry.paradigm.xyz | bash
~/.foundry/bin/foundryup

echo "==> Installing Circom..."
mkdir -p ~/.local/bin
curl -L -o ~/.local/bin/circom https://github.com/iden3/circom/releases/latest/download/circom-linux-amd64
chmod +x ~/.local/bin/circom

# Ensure .local/bin is in PATH for this session and future sessions
export PATH="$HOME/.local/bin:$PATH"
if ! grep -q 'export PATH="$HOME/.local/bin:$PATH"' ~/.bashrc; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
fi

echo "==> Setup complete! Please restart your WSL terminal or run 'source ~/.bashrc' before proceeding."
