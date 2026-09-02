import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "../../components/JsonLd";
import { ShopProductBrowser } from "../../components/ShopProductBrowser";
import { VaultCollectionsBanner } from "../../components/VaultCollectionsBanner";
import { applyCatalogVisibilityFilter, isProductVisibleInCatalog, mapProductRow, toShopCatalogProduct } from "../../lib/catalog-products";
import { awaitPageMetadata, buildPageMetadata } from "../../lib/seo-content";
import { buildBreadcrumb, buildPrintsItemList } from "../../lib/structured-data";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import type {
  Product,
  ProductImage,
  ProductTheme,
  ProductVariant,
} from "../../lib/supabase/types";
import { allowedGalleryIdSet, getCatalogAccess } from "../../lib/vault-access";
import styles from "./page.module.css";

type ProductRow = Product & {
  product_variants: ProductVariant[] | null;
  product_images: ProductImage[] | null;
  product_themes: ProductTheme[] | null;
};

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("shop");
}

async function getProducts(allowedGalleryIds: ReadonlySet<string>) {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("products")
    .select(
      "id, slug, title, product_type, location_tag, visibility, gallery_id, is_available, is_featured, created_at, product_variants(id, variant_label, price_aud, is_active, fulfilment_provider, fulfilment_class, finish, print_type, is_framed, tier_label), product_images(image_url, alt_text, is_primary, sort_order), product_themes(theme:themes(slug, name, is_active))",
    )
    .eq("is_available", true);

  query = applyCatalogVisibilityFilter(query, allowedGalleryIds);

  const { data, error } = await query
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Shop products query failed", error);
    return [];
  }

  return (data as unknown as ProductRow[])
    .map((row) => mapProductRow(row, { primaryImagesOnly: true }))
    .filter((product) => isProductVisibleInCatalog(product, allowedGalleryIds))
    .map(toShopCatalogProduct);
}

export default async function ShopPage() {
  const access = await getCatalogAccess();
  const allowedGalleryIds = allowedGalleryIdSet(access);
  const [, products] = await Promise.all([
    awaitPageMetadata("shop"),
    getProducts(allowedGalleryIds),
  ]);

  // Vault products are excluded from structured data even when a vault session is open.
  const listedPrints = products
    .filter((product) => product.visibility === "public")
    .map((product) => ({ slug: product.slug, title: product.title }));

  return (
    <section className="section container">
      <JsonLd
        data={buildBreadcrumb([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
        ])}
      />
      <JsonLd data={buildPrintsItemList(listedPrints)} />
      <header className={styles.intro}>
        <p className="eyebrow">Limited Edition · Archival Prints</p>
        <h1 className="heading-section">Limited Edition Prints by John Bowskill</h1>
        <p className={styles.subheading}>
          Archival photographs of Calgardup Bay, Redgate Beach, and Isaac Rock — the coast where the SS Georgette sank
          in 1876. Each print is made to order. Edition sizes are strictly limited. All prints are signed and numbered
          by John Bowskill.
        </p>
      </header>

      {access.isAdmin || access.galleries.length > 0 ? (
        <VaultCollectionsBanner galleries={access.galleries} isAdmin={access.isAdmin} />
      ) : null}

      <ShopProductBrowser products={products} isAdmin={access.isAdmin} galleries={access.galleries} />

      <div className={styles.collectionNotes}>
        <h2>About this collection</h2>
        <p>
          These photographs were made over eight years on a single stretch of the Western Australian coast: Calgardup
          Bay, Redgate Beach, Isaac Rock, and the neighbouring reefs at Contos. It is the coast where the steamship{" "}
          <Link className="text-link" href="/story">
            SS Georgette came ashore on 1 December 1876
          </Link>
          , and her wreck still lies a few metres down, just off the beach that most of these frames look across.
        </p>
        <p>
          The collection is not a record of the wreck itself — the ship is visible in almost none of it. It is a survey
          of the place that holds her: the same swell, the same granite, the same weather that put her on the sand.
          Isaac Rock, which the 1876 records call Black Rock, recurs through the series because it is one of the few
          features on this coast that carries the name of Sam Isaacs, the Aboriginal stockman whose part in the rescue
          was recognised with a lesser medal than the one awarded to Grace Bussell.
        </p>
        <p>
          The research behind the work is described in{" "}
          <Link className="text-link" href="/book">
            the author&apos;s preface
          </Link>
          , and the photographs are shown alongside three immersive{" "}
          <Link className="text-link" href="/installations">
            installations
          </Link>{" "}
          at the exhibition in September 2026.
        </p>

        <h2>About the prints</h2>
        <p>
          Prints are produced on Hahnemühle Photo Rag or Canson Infinity Baryta Photographique, depending on the
          edition. Production and despatch takes 2–3 weeks from order. Free shipping within Australia. International
          shipping available —{" "}
          <Link className="text-link" href="/contact">
            contact us
          </Link>{" "}
          for a quote before ordering.
        </p>
      </div>
    </section>
  );
}
