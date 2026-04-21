#!/bin/bash
set -e

echo "→ Installing dependencies"
npm ci

echo "→ Building Next.js"
npm run build

echo "→ Copying static assets to standalone"
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

echo "→ Restarting PM2"
pm2 reload ecosystem.config.js --update-env

echo "✓ Deployed to production"
