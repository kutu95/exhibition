import { supabaseAdmin } from "./supabase/admin";

export const PRINT_PRICE_MARKUP_CONTENT_KEY = "print_price_markup_factor";
export const DEFAULT_PRINT_PRICE_MARKUP_FACTOR = 3;

const parseMarkupFactor = (raw: string | null | undefined): number | null => {
  if (!raw) return null;
  const parsed = Number.parseFloat(raw.trim());
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 20) return null;
  return Math.round(parsed * 100) / 100;
};

/** Retail = lab cost × this factor. Stored in site_content (editable in admin). */
export const getPrintPriceMarkupFactor = async (): Promise<number> => {
  const { data, error } = await supabaseAdmin
    .from("site_content")
    .select("content_value")
    .eq("content_key", PRINT_PRICE_MARKUP_CONTENT_KEY)
    .maybeSingle();

  if (error) {
    console.error("Print markup lookup failed", error);
  } else {
    const fromDb = parseMarkupFactor(data?.content_value);
    if (fromDb !== null) return fromDb;
  }

  return parseMarkupFactor(process.env.PRINT_PRICE_MARKUP_FACTOR) ?? DEFAULT_PRINT_PRICE_MARKUP_FACTOR;
};

export const setPrintPriceMarkupFactor = async (factor: number): Promise<number> => {
  const next = parseMarkupFactor(String(factor));
  if (next === null) {
    throw new Error("Markup factor must be a number between 1 and 20.");
  }

  const value = String(next);
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("site_content")
    .select("id")
    .eq("content_key", PRINT_PRICE_MARKUP_CONTENT_KEY)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabaseAdmin
      .from("site_content")
      .update({ content_value: value, updated_at: new Date().toISOString() })
      .eq("content_key", PRINT_PRICE_MARKUP_CONTENT_KEY);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin.from("site_content").insert({
      content_key: PRINT_PRICE_MARKUP_CONTENT_KEY,
      content_value: value,
      content_type: "text",
    });
    if (error) throw error;
  }

  return next;
};
