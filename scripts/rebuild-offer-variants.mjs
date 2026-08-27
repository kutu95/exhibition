#!/usr/bin/env node
/**
 * Soft-rebuild every print product to the shop offer matrix
 * (Tier 1/2 print & mount, Tier 1 framed, Canvas sheet & wrap × A4/A3/A2/A0).
 *
 * Usage: node --import tsx scripts/rebuild-offer-variants.mjs
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

const { rebuildAllPrintOfferVariants } = await import(
  pathToFileURL(resolve(root, "lib/print-rebuild.ts")).href
);

const result = await rebuildAllPrintOfferVariants();
console.log(JSON.stringify(result, null, 2));
