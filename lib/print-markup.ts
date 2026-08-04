import { supabaseAdmin } from "./supabase/admin";

export const PRINT_PRICE_MARKUP_CONTENT_KEY = "print_price_markup_factor";
export const PRINT_PRICE_BASE_CONTENT_KEY = "print_price_base_aud";
export const DEFAULT_PRINT_PRICE_MARKUP_FACTOR = 3;
export const DEFAULT_PRINT_PRICE_BASE_AUD = 0;

export type PrintPricingSettings = {
  markupFactor: number;
  /** Flat AUD amount added after markup × lab cost. */
  basePriceAud: number;
};

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

const upsertSiteContent = async (contentKey: string, value: string): Promise<void> => {
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
    content_type: "text",
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

/** Retail = base + (lab cost × markup). Stored in site_content (editable in admin). */
export const getPrintPricingSettings = async (): Promise<PrintPricingSettings> => {
  const [markupRaw, baseRaw] = await Promise.all([
    readSiteContent(PRINT_PRICE_MARKUP_CONTENT_KEY),
    readSiteContent(PRINT_PRICE_BASE_CONTENT_KEY),
  ]);

  return {
    markupFactor:
      parseMarkupFactor(markupRaw) ??
      parseMarkupFactor(process.env.PRINT_PRICE_MARKUP_FACTOR) ??
      DEFAULT_PRINT_PRICE_MARKUP_FACTOR,
    basePriceAud:
      parseBasePriceAud(baseRaw) ??
      parseBasePriceAud(process.env.PRINT_PRICE_BASE_AUD) ??
      DEFAULT_PRINT_PRICE_BASE_AUD,
  };
};

/** @deprecated Prefer getPrintPricingSettings(). */
export const getPrintPriceMarkupFactor = async (): Promise<number> => {
  const settings = await getPrintPricingSettings();
  return settings.markupFactor;
};

export const setPrintPricingSettings = async (input: {
  markupFactor: number;
  basePriceAud: number;
}): Promise<PrintPricingSettings> => {
  const markupFactor = parseMarkupFactor(String(input.markupFactor));
  if (markupFactor === null) {
    throw new Error("Markup factor must be a number between 1 and 20.");
  }

  const basePriceAud = parseBasePriceAud(String(input.basePriceAud));
  if (basePriceAud === null) {
    throw new Error("Base price must be a number of 0 or more.");
  }

  await Promise.all([
    upsertSiteContent(PRINT_PRICE_MARKUP_CONTENT_KEY, String(markupFactor)),
    upsertSiteContent(PRINT_PRICE_BASE_CONTENT_KEY, String(basePriceAud)),
  ]);

  return { markupFactor, basePriceAud };
};

/** @deprecated Prefer setPrintPricingSettings(). */
export const setPrintPriceMarkupFactor = async (factor: number): Promise<number> => {
  const current = await getPrintPricingSettings();
  const next = await setPrintPricingSettings({
    markupFactor: factor,
    basePriceAud: current.basePriceAud,
  });
  return next.markupFactor;
};
