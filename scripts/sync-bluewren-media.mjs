#!/usr/bin/env node
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
  if (!(key in process.env)) process.env[key] = trimmed.slice(idx + 1);
}

const { seedManagedPapers } = await import(pathToFileURL(resolve(root, "lib/print-catalogue.ts")).href);
const { setPrintPapers } = await import(pathToFileURL(resolve(root, "lib/print-papers.ts")).href);
const { getPosterFactoryCatalogue, setPosterFactoryCatalogue } = await import(
  pathToFileURL(resolve(root, "lib/posterfactory.ts")).href
);
const { rebuildAllPrintOfferVariants } = await import(
  pathToFileURL(resolve(root, "lib/print-rebuild.ts")).href
);

const papers = await setPrintPapers(seedManagedPapers());
console.log(
  "papers",
  papers.map((p) => ({ id: p.id, label: p.label, rate: p.ratePerSqInAud })),
);

const pf = await getPosterFactoryCatalogue();
pf.photographic.paper = "Ilford Galerie Smooth Pearl";
pf.photographic.productCode = "ilford-galerie-smooth-pearl";
pf.framed.paper = "Ilford Galerie Smooth Pearl";
await setPosterFactoryCatalogue(pf);
console.log("posterfactory papers updated");

const result = await rebuildAllPrintOfferVariants();
console.log(JSON.stringify(result, null, 2));
