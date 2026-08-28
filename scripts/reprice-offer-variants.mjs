#!/usr/bin/env node
/**
 * Reprice every active offer-matrix print variant from current markup settings.
 *
 * Usage: node --import tsx scripts/reprice-offer-variants.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");

if (!existsSync(envPath)) {
  console.error("Missing .env.local");
  process.exit(1);
}

for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx);
  const value = trimmed.slice(idx + 1);
  if (!(key in process.env)) process.env[key] = value;
}

const { repriceAllPrintVariants } = await import(
  pathToFileURL(resolve(root, "lib/print-rebuild.ts")).href
);

const result = await repriceAllPrintVariants();
console.log(JSON.stringify(result, null, 2));
