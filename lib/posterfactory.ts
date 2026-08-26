import { supabaseAdmin } from "./supabase/admin";

export const POSTERFACTORY_CONTENT_KEY = "posterfactory_offer";

export type PosterFactoryClassId = "photographic" | "framed";
export type PosterFactorySizeId = "small" | "medium" | "large";

export type PosterFactorySizePrice = {
  supplierCostAud: number;
  retailPriceAud: number | null;
  isActive: boolean;
};

export type PosterFactoryProduct = {
  classId: PosterFactoryClassId;
  label: string;
  paper: string;
  productCode: string;
  productUrl: string;
  sizes: Record<PosterFactorySizeId, PosterFactorySizePrice>;
};

export type PosterFactoryCatalogue = {
  photographic: PosterFactoryProduct;
  framed: PosterFactoryProduct;
};

/**
 * Smooth Pearl cost rate from PosterFactory A2 $32 ÷ A2 area (≈8.28¢/sq in).
 * Small/Large are ISO A3/A1 area × that rate; Medium is the published A2 price.
 */
export const POSTERFACTORY_SMOOTH_PEARL_RATE_PER_SQ_IN = 0.0828;

/** ISO sheet areas used for Smooth Pearl size bands (sq in). */
const SMOOTH_PEARL_SHEET_SQ_IN = {
  small: (297 / 25.4) * (420 / 25.4), // A3
  medium: (420 / 25.4) * (594 / 25.4), // A2
  large: (594 / 25.4) * (841 / 25.4), // A1
} as const;

const smoothPearlCostAud = (sizeId: PosterFactorySizeId): number => {
  if (sizeId === "medium") return 32;
  return Math.round(SMOOTH_PEARL_SHEET_SQ_IN[sizeId] * POSTERFACTORY_SMOOTH_PEARL_RATE_PER_SQ_IN * 100) / 100;
};

/**
 * Seed supplier costs (AUD incl. GST).
 * Photographic Smooth Pearl uses published A2 $32 and A3/A1 derived from 8.28¢/sq in.
 * Photo+Frame “from $99” is published; Medium/Large framed remain estimates until confirmed.
 */
export const SEED_POSTERFACTORY_CATALOGUE: PosterFactoryCatalogue = {
  photographic: {
    classId: "photographic",
    label: "Photographic Print",
    paper: "Ilford Smooth Pearl 310gsm",
    productCode: "ilford-smooth-pearl-310gsm",
    productUrl: "https://posterfactory.com.au/product/ilford-smooth-pearl-310gsm/",
    sizes: {
      small: { supplierCostAud: smoothPearlCostAud("small"), retailPriceAud: null, isActive: true },
      medium: { supplierCostAud: smoothPearlCostAud("medium"), retailPriceAud: null, isActive: true },
      large: { supplierCostAud: smoothPearlCostAud("large"), retailPriceAud: null, isActive: true },
    },
  },
  framed: {
    classId: "framed",
    label: "Framed Print",
    paper: "Ilford Smooth Pearl 310gsm",
    productCode: "photo-frame-opti-shield",
    productUrl: "https://posterfactory.com.au/product/photo-and-frame-with-3mm-opti-shield/",
    sizes: {
      small: { supplierCostAud: 99, retailPriceAud: null, isActive: true },
      medium: { supplierCostAud: 149, retailPriceAud: null, isActive: true },
      large: { supplierCostAud: 229, retailPriceAud: null, isActive: true },
    },
  },
};

const SIZE_IDS: PosterFactorySizeId[] = ["small", "medium", "large"];

const parseMoney = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100_000) return null;
  return Math.round(parsed * 100) / 100;
};

const parseSizePrice = (raw: unknown, fallback: PosterFactorySizePrice): PosterFactorySizePrice => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const record = raw as Record<string, unknown>;
  const supplierCostAud = parseMoney(record.supplierCostAud) ?? fallback.supplierCostAud;
  const retailPriceAud = parseMoney(record.retailPriceAud);
  return {
    supplierCostAud,
    retailPriceAud,
    isActive: record.isActive !== false,
  };
};

const parseProduct = (
  raw: unknown,
  fallback: PosterFactoryProduct,
): PosterFactoryProduct => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const record = raw as Record<string, unknown>;
  const sizesRaw =
    record.sizes && typeof record.sizes === "object" && !Array.isArray(record.sizes)
      ? (record.sizes as Record<string, unknown>)
      : {};
  return {
    classId: fallback.classId,
    label: typeof record.label === "string" && record.label.trim() ? record.label.trim() : fallback.label,
    paper: typeof record.paper === "string" && record.paper.trim() ? record.paper.trim() : fallback.paper,
    productCode:
      typeof record.productCode === "string" && record.productCode.trim()
        ? record.productCode.trim()
        : fallback.productCode,
    productUrl:
      typeof record.productUrl === "string" && record.productUrl.trim()
        ? record.productUrl.trim()
        : fallback.productUrl,
    sizes: {
      small: parseSizePrice(sizesRaw.small, fallback.sizes.small),
      medium: parseSizePrice(sizesRaw.medium, fallback.sizes.medium),
      large: parseSizePrice(sizesRaw.large, fallback.sizes.large),
    },
  };
};

export const parsePosterFactoryCatalogue = (raw: unknown): PosterFactoryCatalogue => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return SEED_POSTERFACTORY_CATALOGUE;
  }
  const record = raw as Record<string, unknown>;
  return {
    photographic: parseProduct(record.photographic, SEED_POSTERFACTORY_CATALOGUE.photographic),
    framed: parseProduct(record.framed, SEED_POSTERFACTORY_CATALOGUE.framed),
  };
};

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";

const upsertCatalogueContent = async (catalogue: PosterFactoryCatalogue): Promise<void> => {
  const value = JSON.stringify(catalogue);
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("site_content")
    .select("id")
    .eq("content_key", POSTERFACTORY_CONTENT_KEY)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabaseAdmin
      .from("site_content")
      .update({ content_value: value, updated_at: new Date().toISOString() })
      .eq("content_key", POSTERFACTORY_CONTENT_KEY);
    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin.from("site_content").insert({
    content_key: POSTERFACTORY_CONTENT_KEY,
    content_value: value,
    content_type: "text",
  });
  if (error && !isUniqueViolation(error)) throw error;
};

export const getPosterFactoryCatalogue = async (): Promise<PosterFactoryCatalogue> => {
  const { data, error } = await supabaseAdmin
    .from("site_content")
    .select("content_value")
    .eq("content_key", POSTERFACTORY_CONTENT_KEY)
    .maybeSingle();

  if (error) {
    console.error("PosterFactory catalogue lookup failed", error);
    return SEED_POSTERFACTORY_CATALOGUE;
  }

  if (!data?.content_value) {
    await upsertCatalogueContent(SEED_POSTERFACTORY_CATALOGUE);
    return SEED_POSTERFACTORY_CATALOGUE;
  }

  try {
    return parsePosterFactoryCatalogue(JSON.parse(data.content_value) as unknown);
  } catch {
    return SEED_POSTERFACTORY_CATALOGUE;
  }
};

export const setPosterFactoryCatalogue = async (
  input: PosterFactoryCatalogue,
): Promise<PosterFactoryCatalogue> => {
  const catalogue = parsePosterFactoryCatalogue(input);
  for (const classId of ["photographic", "framed"] as const) {
    for (const sizeId of SIZE_IDS) {
      const row = catalogue[classId].sizes[sizeId];
      if (!Number.isFinite(row.supplierCostAud) || row.supplierCostAud < 0) {
        throw new Error("PosterFactory supplier costs must be 0 or more.");
      }
    }
  }
  await upsertCatalogueContent(catalogue);
  return catalogue;
};

export const posterFactorySizePrice = (
  catalogue: PosterFactoryCatalogue,
  classId: PosterFactoryClassId,
  sizeId: PosterFactorySizeId,
): PosterFactorySizePrice | null => {
  const row = catalogue[classId]?.sizes[sizeId];
  if (!row || row.isActive === false) return null;
  return row;
};
