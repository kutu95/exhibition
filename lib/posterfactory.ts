import { BLUE_WREN_SMOOTH_PEARL_RATE_PER_SQ_IN } from "./bluewren";
import { supabaseAdmin } from "./supabase/admin";

export const POSTERFACTORY_CONTENT_KEY = "posterfactory_offer";

export type PosterFactoryClassId = "photographic" | "framed";
/** Aligned with shop offer sizes (long-edge bands). */
export type PosterFactorySizeId = "a4" | "a3" | "a2" | "a0";

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

/** ISO A-series sheet areas (sq in) for seeded photographic costs. */
const ISO_SHEET_SQ_IN: Record<PosterFactorySizeId, number> = {
  a4: (210 / 25.4) * (297 / 25.4),
  a3: (297 / 25.4) * (420 / 25.4),
  a2: (420 / 25.4) * (594 / 25.4),
  a0: (841 / 25.4) * (1189 / 25.4),
};

const smoothPearlCostAud = (sizeId: PosterFactorySizeId): number =>
  Math.round(ISO_SHEET_SQ_IN[sizeId] * BLUE_WREN_SMOOTH_PEARL_RATE_PER_SQ_IN * 100) / 100;

/**
 * Seed reference costs (AUD incl. GST).
 * Shop Tier 1 / Tier 2 price from Blue Wren $/m² area rates on actual print size.
 * Framed shop SKUs use Tier 1 media + the existing Pixel Perfect frame calculator
 * (not these package rows) until Blue Wren mouldings are quoted.
 * Photographic size rows below are ISO-sheet reference only.
 */
export const SEED_POSTERFACTORY_CATALOGUE: PosterFactoryCatalogue = {
  photographic: {
    classId: "photographic",
    label: "Tier 1",
    paper: "Ilford Galerie Smooth Pearl",
    productCode: "ilford-galerie-smooth-pearl",
    productUrl: "https://posterfactory.com.au/product/ilford-smooth-pearl-310gsm/",
    sizes: {
      a4: { supplierCostAud: smoothPearlCostAud("a4"), retailPriceAud: null, isActive: true },
      a3: { supplierCostAud: smoothPearlCostAud("a3"), retailPriceAud: null, isActive: true },
      a2: { supplierCostAud: smoothPearlCostAud("a2"), retailPriceAud: null, isActive: true },
      a0: { supplierCostAud: smoothPearlCostAud("a0"), retailPriceAud: null, isActive: true },
    },
  },
  framed: {
    classId: "framed",
    label: "Framed Print",
    paper: "Ilford Galerie Smooth Pearl",
    productCode: "photo-frame-opti-shield",
    productUrl: "https://posterfactory.com.au/product/photo-and-frame-with-3mm-opti-shield/",
    sizes: {
      a4: { supplierCostAud: 79, retailPriceAud: null, isActive: true },
      a3: { supplierCostAud: 99, retailPriceAud: null, isActive: true },
      a2: { supplierCostAud: 149, retailPriceAud: null, isActive: true },
      a0: { supplierCostAud: 349, retailPriceAud: null, isActive: true },
    },
  },
};

const SIZE_IDS: PosterFactorySizeId[] = ["a4", "a3", "a2", "a0"];

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
      a4: parseSizePrice(sizesRaw.a4, fallback.sizes.a4),
      a3: parseSizePrice(sizesRaw.a3, fallback.sizes.a3),
      a2: parseSizePrice(sizesRaw.a2, fallback.sizes.a2),
      a0: parseSizePrice(sizesRaw.a0, fallback.sizes.a0),
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
    const raw = JSON.parse(data.content_value) as unknown;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const photographic = (raw as Record<string, unknown>).photographic;
      const sizes =
        photographic && typeof photographic === "object" && !Array.isArray(photographic)
          ? (photographic as Record<string, unknown>).sizes
          : null;
      if (sizes && typeof sizes === "object" && !Array.isArray(sizes)) {
        const keys = sizes as Record<string, unknown>;
        if (("small" in keys || "medium" in keys || "large" in keys) && !("a4" in keys)) {
          await upsertCatalogueContent(SEED_POSTERFACTORY_CATALOGUE);
          return SEED_POSTERFACTORY_CATALOGUE;
        }
      }
    }
    return parsePosterFactoryCatalogue(raw);
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
