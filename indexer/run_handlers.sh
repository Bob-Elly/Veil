#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npx esbuild src/EventHandlers.ts --bundle --platform=node --outfile=dist/handlers.cjs
node dist/handlers.cjs
