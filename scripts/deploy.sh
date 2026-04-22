#!/bin/bash
set -e

APP_ROOT="$HOME/apps/exhibition"

echo "→ Pulling latest code"
git pull

echo "→ Backing up uploaded media"
mkdir -p "$APP_ROOT/uploads-backup/images" "$APP_ROOT/uploads-backup/video"
if [ -d ".next/standalone/public/images" ]; then
  cp -r .next/standalone/public/images/. "$APP_ROOT/uploads-backup/images/"
fi
if [ -d ".next/standalone/public/video" ]; then
  cp -r .next/standalone/public/video/. "$APP_ROOT/uploads-backup/video/"
fi

echo "→ Installing dependencies"
npm ci

echo "→ Building Next.js"
npm run build

echo "→ Copying static assets to standalone"
# Copy base public assets (repo files)
cp -r public .next/standalone/public

# Preserve uploaded media — copy server uploads back into standalone
# (these exist on the server but not in the repo)
if [ -d "$APP_ROOT/uploads-backup/images" ]; then
  cp -r "$APP_ROOT/uploads-backup/images/." .next/standalone/public/images/
fi
if [ -d "$APP_ROOT/uploads-backup/video" ]; then
  cp -r "$APP_ROOT/uploads-backup/video/." .next/standalone/public/video/
fi

cp -r .next/static .next/standalone/.next/static

echo "→ Restarting PM2"
pm2 reload ecosystem.config.js --update-env

echo "✓ Deployed to production"
