#!/usr/bin/env node
/**
 * Writes an A4 PDF of cut-out photograph caption labels
 * (title, description, transcript) for public prints.
 *
 * Usage: npm run wall-caption-labels
 * Output: public/qr/wall-caption-labels.pdf
 */
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local");
  process.exit(1);
}

const { buildWallCaptionLabelsPdf } = await import(pathToFileURL(resolve(root, "lib/wall-caption-labels.ts")).href);

const response = await fetch(
  `${supabaseUrl}/rest/v1/products?select=title,slug,location_tag,description,audio_transcript,visibility,product_type,is_available&product_type=eq.print&visibility=eq.public`,
  {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Accept-Profile": "exhibition",
      "Content-Profile": "exhibition",
    },
  },
);

const body = await response.text();
if (!response.ok) {
  console.error(`Failed to load products: ${response.status} ${body.slice(0, 500)}`);
  process.exit(1);
}

const rows = JSON.parse(body);
const products = rows
  .filter((product) => product.is_available !== false)
  .map((product) => ({
    title: product.title?.trim() ?? "",
    slug: product.slug?.trim() ?? "",
    location_tag: product.location_tag,
    description: product.description,
    audio_transcript: product.audio_transcript,
    visibility: product.visibility ?? "public",
  }));

const pdf = buildWallCaptionLabelsPdf(products);
const outDir = resolve(root, "public/qr");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "wall-caption-labels.pdf");
writeFileSync(outPath, pdf);
console.log(`Wrote ${outPath} (${products.length} public photographs, ${pdf.length} bytes)`);
