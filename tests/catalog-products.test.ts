import { describe, expect, it } from "vitest";

import {
  isProductVisibleInCatalog,
  isVaultProductViewOnly,
  toViewOnlyProductDetail,
} from "../lib/catalog-products";
import type { ProductWithVariantsAndImages } from "../lib/supabase/types";

const galleryId = "11111111-1111-1111-1111-111111111111";

describe("catalog visibility", () => {
  it("keeps public products in the shop for everyone", () => {
    const product = { visibility: "public" as const, gallery_id: null };
    expect(isProductVisibleInCatalog(product, new Set())).toBe(true);
    expect(isVaultProductViewOnly(product, new Set())).toBe(false);
  });

  it("hides vault products from the shop until a gallery is unlocked", () => {
    const product = { visibility: "vault" as const, gallery_id: galleryId };
    expect(isProductVisibleInCatalog(product, new Set())).toBe(false);
    expect(isVaultProductViewOnly(product, new Set())).toBe(true);
  });

  it("unlocks size and ordering when the visitor has that gallery", () => {
    const product = { visibility: "vault" as const, gallery_id: galleryId };
    const allowed = new Set([galleryId]);
    expect(isProductVisibleInCatalog(product, allowed)).toBe(true);
    expect(isVaultProductViewOnly(product, allowed)).toBe(false);
  });

  it("strips variants from the view-only product payload", () => {
    const product = {
      id: "p1",
      slug: "private-print",
      title: "Private print",
      description: "A story.",
      visibility: "vault",
      gallery_id: galleryId,
      product_variants: [{ id: "v1", price_aud: 12000, is_active: true }],
      product_images: [],
      product_themes: [],
    } as unknown as ProductWithVariantsAndImages;

    expect(toViewOnlyProductDetail(product).product_variants).toEqual([]);
    expect(product.product_variants).toHaveLength(1);
  });
});
