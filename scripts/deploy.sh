#!/bin/bash
set -e

APP_ROOT="$HOME/apps/exhibition"

echo "→ Pulling latest code"
git pull

echo "→ Backing up uploaded media"
mkdir -p "$APP_ROOT/uploads-backup/images" "$APP_ROOT/uploads-backup/video"
if [ -d "public/images" ]; then
  cp -r public/images/. "$APP_ROOT/uploads-backup/images/"
fi
if [ -d "public/video" ]; then
  cp -r public/video/. "$APP_ROOT/uploads-backup/video/"
fi

echo "→ Installing dependencies"
npm ci

echo "→ Building Next.js"
npm run build

echo "→ Copying static assets to standalone"
# Copy base public assets (repo files)
rm -rf .next/standalone/public
cp -r public .next/standalone/public

# Preserve uploaded media in the canonical location
mkdir -p public/images public/video
if [ -d "$APP_ROOT/uploads-backup/images" ]; then
  cp -r "$APP_ROOT/uploads-backup/images/." public/images/
fi
if [ -d "$APP_ROOT/uploads-backup/video" ]; then
  cp -r "$APP_ROOT/uploads-backup/video/." public/video/
fi

# Keep standalone copy in sync with canonical public media
cp -r public/images/. .next/standalone/public/images/
cp -r public/video/. .next/standalone/public/video/

cp -r .next/static .next/standalone/.next/static

echo "→ Restarting PM2"
pm2 reload ecosystem.config.js --update-env

echo "✓ Deployed to production"
