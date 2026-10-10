#!/usr/bin/env bash
set -e
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

export $(grep -v '^#' .env | xargs)

cd scripts
echo "==> Running deploy.mjs..."
node deploy.mjs
echo "==> Deploy script finished."
