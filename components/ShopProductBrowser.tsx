"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { ProductWithVariantsAndImages } from "../lib/supabase/types";
import { useCart } from "./CartProvider";
import { useFavourites } from "./FavouritesProvider";
import { ProductGrid } from "./ProductGrid";
import { LocationFilter, ProductTypeFilter, ShopFilters, ThemeFilter } from "./ShopFilters";
import styles from "./ShopProductBrowser.module.css";

type ShopProductBrowserProps = {
  products: ProductWithVariantsAndImages[];
};

const pickDefaultVariant = (product: ProductWithVariantsAndImages) => {
  const active = product.product_variants.filter((variant) => variant.is_active);
  const pool = active.length > 0 ? active : product.product_variants;
  if (pool.length === 0) return null;
  return pool.reduce((best, variant) => (variant.price_aud < best.price_aud ? variant : best));
};

export function ShopProductBrowser({ products }: ShopProductBrowserProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const { favouriteIds, favouriteCount, isFavourite } = useFavourites();
  const [typeFilter, setTypeFilter] = useState<ProductTypeFilter>("all");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [themeFilter, setThemeFilter] = useState<ThemeFilter>("all");
  const [favouritesOnly, setFavouritesOnly] = useState(false);

  const locationOptions = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .filter((product) => product.product_type === "print")
            .flatMap((product) => (product.location_tag ? [product.location_tag] : [])),
        ),
      )
        .sort((a, b) => a.localeCompare(b))
        .map((location) => ({ value: location, label: location })),
    [products],
  );

  const themeOptions = useMemo(() => {
    const themes = new Map<string, string>();
    products
      .filter((product) => product.product_type === "print")
      .forEach((product) => {
        product.product_themes.forEach(({ theme }) => {
          if (theme.is_active) themes.set(theme.slug, theme.name);
        });
      });
    return Array.from(themes, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const typeMatch = typeFilter === "all" ? true : product.product_type === typeFilter;
      const locationMatch = locationFilter === "all" || product.location_tag === locationFilter;
      const themeMatch =
        themeFilter === "all" ||
        product.product_themes.some((assignment) => assignment.theme.slug === themeFilter);
      const favouriteMatch = !favouritesOnly || isFavourite(product.id);

      return typeMatch && locationMatch && themeMatch && favouriteMatch;
    });
  }, [favouritesOnly, isFavourite, locationFilter, products, themeFilter, typeFilter]);

  const handleTypeChange = (next: ProductTypeFilter) => {
    setTypeFilter(next);
    if (next === "merchandise") {
      setLocationFilter("all");
      setThemeFilter("all");
    }
  };

  const handleAddFavouritesToCart = () => {
    const favouritedProducts = products.filter((product) => favouriteIds.includes(product.id));
    let added = 0;
    favouritedProducts.forEach((product) => {
      const variant = pickDefaultVariant(product);
      const imageUrl = product.product_images[0]?.image_url;
      if (!variant || !imageUrl) return;
      addItem({
        variant_id: variant.id,
        product_title: product.title,
        variant_label: variant.variant_label,
        price_aud: variant.price_aud,
        slug: product.slug,
        image_url: imageUrl,
        quantity: 1,
      });
      added += 1;
    });
    if (added > 0) {
      router.push("/cart");
    }
  };

  return (
    <>
      <ShopFilters
        typeFilter={typeFilter}
        locationFilter={locationFilter}
        themeFilter={themeFilter}
        favouritesOnly={favouritesOnly}
        favouriteCount={favouriteCount}
        locationOptions={locationOptions}
        themeOptions={themeOptions}
        onTypeChange={handleTypeChange}
        onLocationChange={setLocationFilter}
        onThemeChange={setThemeFilter}
        onFavouritesOnlyChange={setFavouritesOnly}
      />

      {favouritesOnly && favouriteCount > 0 ? (
        <div className={styles.favouritesActions}>
          <p className={styles.favouritesHint}>
            Showing {filteredProducts.length} favourite{filteredProducts.length === 1 ? "" : "s"}. Default sizes
            will be used when adding to cart — you can change them in the cart or on each product page.
          </p>
          <button type="button" className="button-solid" onClick={handleAddFavouritesToCart}>
            Add favourites to cart
          </button>
        </div>
      ) : null}

      {filteredProducts.length > 0 ? (
        <ProductGrid products={filteredProducts} />
      ) : (
        <p>
          {favouritesOnly
            ? "No favourites yet. Tap the heart on a photograph to save it here."
            : "No prints available in this category yet."}
        </p>
      )}
    </>
  );
}
