import type { Metadata } from "next";

import { JsonLd } from "../../components/JsonLd";
import { ShopProductBrowser } from "../../components/ShopProductBrowser";
import { buildMetadata, siteConfig } from "../../lib/metadata";
import { buildBreadcrumb } from "../../lib/structured-data";
import type { ProductWithVariantsAndImages } from "../../lib/supabase/types";
import styles from "./page.module.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3007";

export const metadata: Metadata = buildMetadata({
  title: "Shop — Limited Edition Prints",
  description:
    "Limited edition archival photographic prints by John Bowskill. Calgardup Bay, Redgate Beach, Isaac Rock, and the wreck site of the SS Georgette.",
  path: "/shop",
  ogImage: siteConfig.ogImage.shop,
});

async function fetchProducts(): Promise<ProductWithVariantsAndImages[]> {
  try {
    const response = await fetch(`${siteUrl}/api/products`, { cache: "no-store" });
    if (!response.ok) return [];
    return (await response.json()) as ProductWithVariantsAndImages[];
  } catch {
    return [];
  }
}

export default async function ShopPage() {
  const products = await fetchProducts();

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
        <h1 className="heading-section">The photographs</h1>
        <p className={styles.subheading}>
          Each print is made to order on archival paper. Edition sizes are strictly limited. All prints are signed and
          numbered by John Bowskill.
        </p>
      </header>

      <ShopProductBrowser products={products} />

      <p className={styles.note}>
        Prints are produced on Hahnemühle Photo Rag or Canson Infinity Baryta Photographique, depending on the
        edition. Production and despatch takes 2–3 weeks from order. Free shipping within Australia. International
        shipping available — contact us for a quote before ordering.
      </p>
    </section>
  );
}
