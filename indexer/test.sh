#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
mkdir -p /tmp/test-envio
cd /tmp/test-envio
npx envio init template --name testproj --language typescript --package-manager npm --directory . --api-token dummy
