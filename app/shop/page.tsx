import type { Metadata } from "next";

import { JsonLd } from "../../components/JsonLd";
import { ShopProductBrowser } from "../../components/ShopProductBrowser";
import { VaultCollectionsBanner } from "../../components/VaultCollectionsBanner";
import { isProductVisibleInCatalog, mapProductRow } from "../../lib/catalog-products";
import { buildMetadata, siteConfig } from "../../lib/metadata";
import { buildBreadcrumb } from "../../lib/structured-data";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import type {
  Product,
  ProductImage,
  ProductTheme,
  ProductVariant,
  ProductWithVariantsAndImages,
} from "../../lib/supabase/types";
import { hasActiveVaultSession } from "../../lib/vault-access";
import styles from "./page.module.css";

type ProductRow = Product & {
  product_variants: ProductVariant[] | null;
  product_images: ProductImage[] | null;
  product_themes: ProductTheme[] | null;
};

export const metadata: Metadata = buildMetadata({
  title: "Shop — Limited Edition Prints",
  description:
    "Limited edition archival photographic prints by John Bowskill. Calgardup Bay, Redgate Beach, Isaac Rock, and the wreck site of the SS Georgette.",
  path: "/shop",
  ogImage: siteConfig.ogImage.shop,
});

async function getProducts(): Promise<ProductWithVariantsAndImages[]> {
  const [supabase, includeVault] = await Promise.all([
    createSupabaseServerClient(),
    hasActiveVaultSession(),
  ]);

  let query = supabase
    .from("products")
    .select("*, product_variants(*), product_images(*), product_themes(*, theme:themes(*))")
    .eq("is_available", true);

  if (!includeVault) {
    query = query.eq("visibility", "public");
  }

  const { data, error } = await query
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Shop products query failed", error);
    return [];
  }

  return (data as ProductRow[])
    .map((row) => mapProductRow(row, { primaryImagesOnly: true }))
    .filter((product) => isProductVisibleInCatalog(product, includeVault));
}

export default async function ShopPage() {
  const [products, vaultOpen] = await Promise.all([getProducts(), hasActiveVaultSession()]);

  return (
    <section className="section container">
      <JsonLd
        data={buildBreadcrumb([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
        ])}
      />
      <header className={styles.intro}>
        <p className="eyebrow">Limited Edition · Archival Prints</p>
        <h1 className="heading-section">Limited Edition Prints</h1>
        <p className={styles.subheading}>
          Each print is made to order on archival paper. Edition sizes are strictly limited. All prints are signed and
          numbered by John Bowskill.
        </p>
      </header>

      {vaultOpen ? <VaultCollectionsBanner /> : null}

      <ShopProductBrowser products={products} />

      <p className={styles.note}>
        Prints are produced on Hahnemühle Photo Rag or Canson Infinity Baryta Photographique, depending on the
        edition. Production and despatch takes 2–3 weeks from order. Free shipping within Australia. International
        shipping available — contact us for a quote before ordering.
      </p>
    </section>
  );
}
