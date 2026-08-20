"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { ProductWithVariantsAndImages } from "../lib/supabase/types";
import { useCart } from "./CartProvider";
import { useFavourites } from "./FavouritesProvider";
import { ProductGrid } from "./ProductGrid";
import { LocationFilter, ProductTypeFilter, ShopFilters, ThemeFilter, type GalleryFilter } from "./ShopFilters";
import styles from "./ShopProductBrowser.module.css";

type ShopProductBrowserProps = {
  products: ProductWithVariantsAndImages[];
  isAdmin?: boolean;
  galleries?: Array<{ id: string; name: string }>;
};

const pickDefaultVariant = (product: ProductWithVariantsAndImages) => {
  const active = product.product_variants.filter((variant) => variant.is_active);
  const pool = active.length > 0 ? active : product.product_variants;
  if (pool.length === 0) return null;
  return pool.reduce((best, variant) => (variant.price_aud < best.price_aud ? variant : best));
};

export function ShopProductBrowser({ products, isAdmin = false, galleries = [] }: ShopProductBrowserProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const { favouriteIds, favouriteCount, isFavourite } = useFavourites();
  const [typeFilter, setTypeFilter] = useState<ProductTypeFilter>("all");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [themeFilter, setThemeFilter] = useState<ThemeFilter>("all");
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>("all");
  const [favouritesOnly, setFavouritesOnly] = useState(false);

  const galleryOptions = useMemo(
    () => galleries.map((gallery) => ({ value: gallery.id, label: gallery.name })),
    [galleries],
  );
  const showGalleryFilter = isAdmin && galleries.length > 0;

  const galleryScopedProducts = useMemo(() => {
    if (!showGalleryFilter || galleryFilter === "all") return products;
    if (galleryFilter === "public") return products.filter((product) => !product.gallery_id);
    return products.filter((product) => product.gallery_id === galleryFilter);
  }, [galleryFilter, products, showGalleryFilter]);

  const locationOptions = useMemo(
    () =>
      Array.from(
        new Set(
          galleryScopedProducts
            .filter((product) => product.product_type === "print")
            .flatMap((product) => (product.location_tag ? [product.location_tag] : [])),
        ),
      )
        .sort((a, b) => a.localeCompare(b))
        .map((location) => ({ value: location, label: location })),
    [galleryScopedProducts],
  );

  const themeOptions = useMemo(() => {
    const themes = new Map<string, string>();
    galleryScopedProducts
      .filter(
        (product) =>
          product.product_type === "print" &&
          (locationFilter === "all" || product.location_tag === locationFilter),
      )
      .forEach((product) => {
        product.product_themes.forEach(({ theme }) => {
          if (theme.is_active) themes.set(theme.slug, theme.name);
        });
      });
    return Array.from(themes, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [galleryScopedProducts, locationFilter]);

  useEffect(() => {
    if (themeFilter === "all") return;
    if (!themeOptions.some((option) => option.value === themeFilter)) {
      setThemeFilter("all");
    }
  }, [themeFilter, themeOptions]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const typeMatch = typeFilter === "all" ? true : product.product_type === typeFilter;
      const locationMatch =
        typeFilter === "merchandise" ||
        locationFilter === "all" ||
        product.location_tag === locationFilter;
      const themeMatch =
        typeFilter === "merchandise" ||
        themeFilter === "all" ||
        product.product_themes.some((assignment) => assignment.theme.slug === themeFilter);
      const favouriteMatch = !favouritesOnly || isFavourite(product.id);
      const galleryMatch =
        !showGalleryFilter ||
        galleryFilter === "all" ||
        (galleryFilter === "public" ? !product.gallery_id : product.gallery_id === galleryFilter);

      return typeMatch && locationMatch && themeMatch && favouriteMatch && galleryMatch;
    });
  }, [favouritesOnly, galleryFilter, isFavourite, locationFilter, products, showGalleryFilter, themeFilter, typeFilter]);

  const handleTypeChange = (next: ProductTypeFilter) => {
    setTypeFilter(next);
    if (next === "merchandise") {
      setLocationFilter("all");
      setThemeFilter("all");
    }
  };

  const handleLocationChange = (next: LocationFilter) => {
    setLocationFilter(next);
    setThemeFilter("all");
  };

  const handleGalleryChange = (next: GalleryFilter) => {
    setGalleryFilter(next);
    setLocationFilter("all");
    setThemeFilter("all");
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
        galleryFilter={galleryFilter}
        galleryOptions={galleryOptions}
        showGalleryFilter={showGalleryFilter}
        favouritesOnly={favouritesOnly}
        favouriteCount={favouriteCount}
        locationOptions={locationOptions}
        themeOptions={themeOptions}
        onTypeChange={handleTypeChange}
        onLocationChange={handleLocationChange}
        onThemeChange={setThemeFilter}
        onGalleryChange={handleGalleryChange}
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
