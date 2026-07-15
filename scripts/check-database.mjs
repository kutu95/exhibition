#!/usr/bin/env node
/**
 * Verifies Supabase REST can read exhibition.site_content (same check as /story).
 * Usage: node scripts/check-database.mjs
 * Loads .env.local from repo root when present.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");

const loadEnv = () => {
  if (!existsSync(envPath)) {
    console.error("Missing .env.local");
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return env;
};

const env = loadEnv();
const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!baseUrl || !anonKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required in .env.local");
  process.exit(1);
}

const timeoutMs = 15_000;
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

const url = `${baseUrl}/rest/v1/site_content?select=content_key&content_key=eq.story_hero_image&limit=1`;

try {
  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Accept-Profile": "exhibition",
      "Content-Profile": "exhibition",
    },
  });

  const body = await response.text();

  if (!response.ok) {
    console.error(`FAIL ${response.status} ${response.statusText}`);
    console.error(body);
    if (body.includes("PGRST002")) {
      console.error(
        "\nPostgREST cannot reach Postgres. On 192.168.0.146 run:\n  bash ~/apps/exhibition/scripts/repair-shared-supabase.sh",
      );
    }
    process.exit(1);
  }

  console.log("OK — exhibition.site_content is reachable via Supabase REST");
  console.log(body);
} catch (error) {
  if (error instanceof Error && error.name === "AbortError") {
    console.error(`FAIL — timed out after ${timeoutMs}ms connecting to ${baseUrl}`);
  } else {
    console.error("FAIL —", error);
  }
  process.exit(1);
} finally {
  clearTimeout(timeoutId);
}
