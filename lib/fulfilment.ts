export const FULFILMENT_PROVIDERS = ["posterfactory", "pixelperfect"] as const;
export type FulfilmentProvider = (typeof FULFILMENT_PROVIDERS)[number];

export const FULFILMENT_CLASSES = ["standard", "fine_art", "framed", "canvas"] as const;
export type FulfilmentClass = (typeof FULFILMENT_CLASSES)[number];

export const FULFILMENT_PROVIDER_LABEL: Record<FulfilmentProvider, string> = {
  posterfactory: "PosterFactory",
  pixelperfect: "Pixel Perfect",
};

export const MIXED_PROVIDER_MESSAGE =
  "Fine Art prints are produced and shipped separately from our photographic and framed prints. To keep shipping and tracking simple, they need to be ordered separately.";

export const isFulfilmentProvider = (value: unknown): value is FulfilmentProvider =>
  value === "posterfactory" || value === "pixelperfect";

export const isFulfilmentClass = (value: unknown): value is FulfilmentClass =>
  value === "standard" || value === "fine_art" || value === "framed" || value === "canvas";

export const parseFulfilmentProvider = (value: unknown): FulfilmentProvider | null =>
  isFulfilmentProvider(value) ? value : null;

export const providerFromVariant = (variant: {
  fulfilment_provider?: string | null;
}): FulfilmentProvider | null => parseFulfilmentProvider(variant.fulfilment_provider);

export const uniqueFulfilmentProviders = (
  variants: Array<{ fulfilment_provider?: string | null }>,
): FulfilmentProvider[] => {
  const providers = new Set<FulfilmentProvider>();
  for (const variant of variants) {
    const provider = providerFromVariant(variant);
    if (provider) providers.add(provider);
  }
  return [...providers];
};

export const singleFulfilmentProvider = (
  variants: Array<{ fulfilment_provider?: string | null }>,
): { ok: true; provider: FulfilmentProvider | null } | { ok: false } => {
  const providers = uniqueFulfilmentProviders(variants);
  if (providers.length > 1) return { ok: false };
  return { ok: true, provider: providers[0] ?? null };
};

export const grossMarginCents = (retailCents: number, supplierCostCents: number | null): number | null => {
  if (supplierCostCents === null || !Number.isFinite(supplierCostCents)) return null;
  return retailCents - supplierCostCents;
};
