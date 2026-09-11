import { supabaseAdmin } from "./supabase/admin";

export const EXHIBITION_TIMEZONE = "Australia/Perth";

export const DISCOUNT_PERCENTS = [10, 15, 20, 25] as const;
export type DiscountPercent = (typeof DISCOUNT_PERCENTS)[number];

export const DISCOUNT_INVALID_MESSAGE =
  "That code isn’t valid today. Please check the board at the exhibition.";

export const DISCOUNT_CODE_STORAGE_KEY = "exhibition-discount-code";

export type DiscountCodeRow = {
  id: string;
  code: string;
  valid_on: string;
  percent_off: number;
  created_at?: string;
  updated_at?: string;
};

const CODE_PATTERN = /^[A-Z0-9](?:[A-Z0-9-]{0,22}[A-Z0-9])?$/;
const SUGGEST_ALPHABET = "ABCDEFGHJKMNPQRTUVWXYZ23456789";

export const isDiscountPercent = (value: number): value is DiscountPercent =>
  (DISCOUNT_PERCENTS as readonly number[]).includes(value);

export const normalizeDiscountCode = (raw: string | null | undefined): string =>
  (raw ?? "").trim().toUpperCase().replace(/\s+/g, "");

export const isDiscountCodeFormat = (code: string): boolean =>
  code.length >= 3 && code.length <= 24 && CODE_PATTERN.test(code) && !code.includes("--");

export const perthCalendarDate = (now = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: EXHIBITION_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

export const discountAmountCents = (subtotalCents: number, percent: number): number => {
  if (subtotalCents <= 0 || percent <= 0) return 0;
  return Math.round((subtotalCents * percent) / 100);
};

export const suggestDiscountCode = (random: () => number = Math.random): string => {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    const index = Math.min(SUGGEST_ALPHABET.length - 1, Math.floor(random() * SUGGEST_ALPHABET.length));
    code += SUGGEST_ALPHABET[index];
  }
  return code;
};

export const findValidDiscountCode = async (
  raw: string | null | undefined,
  now = new Date(),
): Promise<DiscountCodeRow | null> => {
  const code = normalizeDiscountCode(raw);
  if (!isDiscountCodeFormat(code)) return null;

  const today = perthCalendarDate(now);
  const { data, error } = await supabaseAdmin
    .from("discount_codes")
    .select("id, code, valid_on, percent_off, created_at, updated_at")
    .eq("code", code)
    .eq("valid_on", today)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as DiscountCodeRow | null;
  if (!row || !isDiscountPercent(row.percent_off)) return null;
  return row;
};
