import { supabaseAdmin } from "./supabase/admin";
import { mmToInches, computeRetailFromLabCost } from "./print-size";

export const PRINT_FRAME_MARKUP_CONTENT_KEY = "print_frame_markup_factor";
export const PRINT_FRAME_BASE_CONTENT_KEY = "print_frame_base_aud";
export const PRINT_FRAME_RATES_CONTENT_KEY = "print_frame_rates";
export const PRINT_RTH_CANVAS_RATES_CONTENT_KEY = "print_rth_canvas_rates";

export const DEFAULT_PRINT_FRAME_MARKUP_FACTOR = 3;
export const DEFAULT_PRINT_FRAME_BASE_AUD = 0;

/** Standard frame + Perspex (shippable) from Pixel Perfect April 2025 pricelist. */
export type FrameRateBand = {
  uin: number;
  standardAud: number;
  perspexAud: number;
};

/** Ready-to-hang canvas package (print + stretch + wire) from Pixel Perfect. */
export type RthCanvasRateBand = {
  uin: number;
  packageAud: number;
};

export type FramePricingSettings = {
  markupFactor: number;
  basePriceAud: number;
};

/**
 * Seeded from Pixel Perfect Standard Frame + Perspex columns (united inches).
 * Larger sizes beyond listed bands should be quote-only (lookup returns null).
 */
export const SEED_FRAME_RATES: FrameRateBand[] = [
  { uin: 20, standardAud: 91.73, perspexAud: 11.47 },
  { uin: 24, standardAud: 106.06, perspexAud: 14.33 },
  { uin: 28, standardAud: 120.39, perspexAud: 17.2 },
  { uin: 31, standardAud: 136.64, perspexAud: 21.02 },
  { uin: 35, standardAud: 153.84, perspexAud: 24.84 },
  { uin: 39, standardAud: 171.99, perspexAud: 28.67 },
  { uin: 43, standardAud: 191.1, perspexAud: 33.44 },
  { uin: 47, standardAud: 212.12, perspexAud: 39.18 },
  { uin: 51, standardAud: 233.14, perspexAud: 44.91 },
  { uin: 55, standardAud: 256.07, perspexAud: 51.6 },
  { uin: 59, standardAud: 279.01, perspexAud: 58.29 },
  { uin: 63, standardAud: 303.85, perspexAud: 64.97 },
  { uin: 67, standardAud: 330.6, perspexAud: 72.62 },
  { uin: 71, standardAud: 357.36, perspexAud: 84.08 },
  { uin: 75, standardAud: 385.07, perspexAud: 89.82 },
  { uin: 79, standardAud: 414.69, perspexAud: 98.42 },
  { uin: 83, standardAud: 445.26, perspexAud: 107.97 },
  { uin: 87, standardAud: 476.79, perspexAud: 118.48 },
];

export const SEED_RTH_CANVAS_RATES: RthCanvasRateBand[] = [
  { uin: 20, packageAud: 73.28 },
  { uin: 24, packageAud: 89.42 },
  { uin: 28, packageAud: 109.3 },
  { uin: 31, packageAud: 124.2 },
  { uin: 35, packageAud: 139.1 },
  { uin: 39, packageAud: 161.46 },
  { uin: 43, packageAud: 183.82 },
  { uin: 47, packageAud: 208.66 },
  { uin: 51, packageAud: 234.74 },
  { uin: 55, packageAud: 262.06 },
  { uin: 59, packageAud: 290.63 },
  { uin: 63, packageAud: 321.68 },
  { uin: 67, packageAud: 387.5 },
  { uin: 71, packageAud: 401.17 },
  { uin: 75, packageAud: 419.8 },
  { uin: 79, packageAud: 457.06 },
  { uin: 83, packageAud: 506.74 },
  { uin: 87, packageAud: 531.58 },
  { uin: 91, packageAud: 558.9 },
  { uin: 94, packageAud: 623.48 },
  { uin: 98, packageAud: 654.53 },
  { uin: 102, packageAud: 686.83 },
];

export const unitedInchesFromMm = (widthMm: number, heightMm: number): number => {
  const widthIn = mmToInches(widthMm);
  const heightIn = mmToInches(heightMm);
  return Math.round((widthIn + heightIn) * 100) / 100;
};

/** Round up to the next listed band (PP rule: 65 uin → 67). */
export const lookupBandByUnitedInches = <T extends { uin: number }>(
  unitedInches: number,
  bands: T[],
): T | null => {
  if (!Number.isFinite(unitedInches) || unitedInches <= 0 || bands.length === 0) return null;
  const sorted = [...bands].sort((a, b) => a.uin - b.uin);
  const match = sorted.find((band) => band.uin >= unitedInches - 1e-9);
  return match ?? null;
};

export const frameLabCostAud = (band: FrameRateBand): number =>
  Math.round((band.standardAud + band.perspexAud) * 100) / 100;

const parseMarkupFactor = (raw: string | null | undefined): number | null => {
  if (!raw) return null;
  const parsed = Number.parseFloat(raw.trim());
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 20) return null;
  return Math.round(parsed * 100) / 100;
};

const parseBasePriceAud = (raw: string | null | undefined): number | null => {
  if (raw === null || raw === undefined || !String(raw).trim()) return null;
  const parsed = Number.parseFloat(String(raw).trim());
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100_000) return null;
  return Math.round(parsed * 100) / 100;
};

const upsertSiteContent = async (contentKey: string, value: string, contentType = "text"): Promise<void> => {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("site_content")
    .select("id")
    .eq("content_key", contentKey)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabaseAdmin
      .from("site_content")
      .update({ content_value: value, updated_at: new Date().toISOString() })
      .eq("content_key", contentKey);
    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin.from("site_content").insert({
    content_key: contentKey,
    content_value: value,
    content_type: contentType,
  });
  if (error) throw error;
};

const readSiteContent = async (contentKey: string): Promise<string | null> => {
  const { data, error } = await supabaseAdmin
    .from("site_content")
    .select("content_value")
    .eq("content_key", contentKey)
    .maybeSingle();

  if (error) {
    console.error(`Site content lookup failed for ${contentKey}`, error);
    return null;
  }
  return data?.content_value ?? null;
};

const parseFrameRates = (raw: string | null): FrameRateBand[] | null => {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const bands: FrameRateBand[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const uin = Number(record.uin);
      const standardAud = Number(record.standardAud);
      const perspexAud = Number(record.perspexAud);
      if (![uin, standardAud, perspexAud].every((n) => Number.isFinite(n) && n >= 0)) return null;
      bands.push({
        uin: Math.round(uin),
        standardAud: Math.round(standardAud * 100) / 100,
        perspexAud: Math.round(perspexAud * 100) / 100,
      });
    }
    return bands.sort((a, b) => a.uin - b.uin);
  } catch {
    return null;
  }
};

const parseRthRates = (raw: string | null): RthCanvasRateBand[] | null => {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const bands: RthCanvasRateBand[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const uin = Number(record.uin);
      const packageAud = Number(record.packageAud);
      if (![uin, packageAud].every((n) => Number.isFinite(n) && n >= 0)) return null;
      bands.push({
        uin: Math.round(uin),
        packageAud: Math.round(packageAud * 100) / 100,
      });
    }
    return bands.sort((a, b) => a.uin - b.uin);
  } catch {
    return null;
  }
};

export const getFramePricingSettings = async (): Promise<FramePricingSettings> => {
  const [markupRaw, baseRaw] = await Promise.all([
    readSiteContent(PRINT_FRAME_MARKUP_CONTENT_KEY),
    readSiteContent(PRINT_FRAME_BASE_CONTENT_KEY),
  ]);

  return {
    markupFactor: parseMarkupFactor(markupRaw) ?? DEFAULT_PRINT_FRAME_MARKUP_FACTOR,
    basePriceAud: parseBasePriceAud(baseRaw) ?? DEFAULT_PRINT_FRAME_BASE_AUD,
  };
};

export const setFramePricingSettings = async (input: {
  markupFactor: number;
  basePriceAud: number;
}): Promise<FramePricingSettings> => {
  const markupFactor = parseMarkupFactor(String(input.markupFactor));
  if (markupFactor === null) {
    throw new Error("Frame markup factor must be a number between 1 and 20.");
  }
  const basePriceAud = parseBasePriceAud(String(input.basePriceAud));
  if (basePriceAud === null) {
    throw new Error("Frame base price must be a number of 0 or more.");
  }

  await Promise.all([
    upsertSiteContent(PRINT_FRAME_MARKUP_CONTENT_KEY, String(markupFactor)),
    upsertSiteContent(PRINT_FRAME_BASE_CONTENT_KEY, String(basePriceAud)),
  ]);

  return { markupFactor, basePriceAud };
};

export const getFrameRates = async (): Promise<FrameRateBand[]> => {
  const raw = await readSiteContent(PRINT_FRAME_RATES_CONTENT_KEY);
  const fromDb = parseFrameRates(raw);
  if (fromDb) return fromDb;

  try {
    await upsertSiteContent(PRINT_FRAME_RATES_CONTENT_KEY, JSON.stringify(SEED_FRAME_RATES), "json");
  } catch (error) {
    console.error("Failed to seed frame rates", error);
  }
  return SEED_FRAME_RATES;
};

export const setFrameRates = async (input: FrameRateBand[]): Promise<FrameRateBand[]> => {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("At least one frame rate band is required.");
  }
  const bands = parseFrameRates(JSON.stringify(input));
  if (!bands) throw new Error("Invalid frame rate bands.");
  await upsertSiteContent(PRINT_FRAME_RATES_CONTENT_KEY, JSON.stringify(bands), "json");
  return bands;
};

export const getRthCanvasRates = async (): Promise<RthCanvasRateBand[]> => {
  const raw = await readSiteContent(PRINT_RTH_CANVAS_RATES_CONTENT_KEY);
  const fromDb = parseRthRates(raw);
  if (fromDb) return fromDb;

  try {
    await upsertSiteContent(PRINT_RTH_CANVAS_RATES_CONTENT_KEY, JSON.stringify(SEED_RTH_CANVAS_RATES), "json");
  } catch (error) {
    console.error("Failed to seed RTH canvas rates", error);
  }
  return SEED_RTH_CANVAS_RATES;
};

export const setRthCanvasRates = async (input: RthCanvasRateBand[]): Promise<RthCanvasRateBand[]> => {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("At least one RTH canvas rate band is required.");
  }
  const bands = parseRthRates(JSON.stringify(input));
  if (!bands) throw new Error("Invalid RTH canvas rate bands.");
  await upsertSiteContent(PRINT_RTH_CANVAS_RATES_CONTENT_KEY, JSON.stringify(bands), "json");
  return bands;
};

export const computeFrameRetailAud = (args: {
  widthMm: number;
  heightMm: number;
  frameRates: FrameRateBand[];
  markupFactor: number;
  basePriceAud?: number;
}): { labCostAud: number; retailAud: number; uin: number; band: FrameRateBand } | null => {
  const uin = unitedInchesFromMm(args.widthMm, args.heightMm);
  const band = lookupBandByUnitedInches(uin, args.frameRates);
  if (!band) return null;
  const labCostAud = frameLabCostAud(band);
  const retailAud = computeRetailFromLabCost(labCostAud, args.markupFactor, args.basePriceAud ?? 0);
  return { labCostAud, retailAud, uin, band };
};

export const computeRthCanvasRetailAud = (args: {
  widthMm: number;
  heightMm: number;
  rthRates: RthCanvasRateBand[];
  markupFactor: number;
  basePriceAud?: number;
}): { labCostAud: number; retailAud: number; uin: number; band: RthCanvasRateBand } | null => {
  const uin = unitedInchesFromMm(args.widthMm, args.heightMm);
  const band = lookupBandByUnitedInches(uin, args.rthRates);
  if (!band) return null;
  const labCostAud = band.packageAud;
  const retailAud = computeRetailFromLabCost(labCostAud, args.markupFactor, args.basePriceAud ?? 0);
  return { labCostAud, retailAud, uin, band };
};
