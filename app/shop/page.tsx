import type { Metadata } from "next";

import { ShopProductBrowser } from "../../components/ShopProductBrowser";
import type { ProductWithVariantsAndImages } from "../../lib/supabase/types";
import styles from "./page.module.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3007";

export const metadata: Metadata = {
  title: "Shop · Limited Edition Prints",
  description:
    "Browse limited edition fine art prints and selected merchandise from the SS Georgette exhibition.",
  alternates: {
    canonical: "/shop",
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/shop`,
    title: "Shop · Limited Edition Prints | SS Georgette Exhibition",
    description:
      "Browse limited edition fine art prints and selected merchandise from the SS Georgette exhibition.",
    images: [{ url: "/images/placeholder-shop-og.jpg" }],
  },
};

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
      <header className={styles.intro}>
        <p className="eyebrow">Limited Edition Prints &amp; Merchandise</p>
        <h1 className="heading-section">Take the coast home.</h1>
      </header>

      <ShopProductBrowser products={products} />

      <p className={styles.note}>
        All prints are made to order on archival paper. Please allow 2–3 weeks for production and
        despatch. Edition sizes are strictly limited.
      </p>
    </section>
  );
}
