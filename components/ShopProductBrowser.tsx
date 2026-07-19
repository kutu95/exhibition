"use client";

import { useMemo, useState } from "react";

import type { ProductWithVariantsAndImages } from "../lib/supabase/types";
import { ProductGrid } from "./ProductGrid";
import { LocationFilter, ProductTypeFilter, ShopFilters, ThemeFilter } from "./ShopFilters";

type ShopProductBrowserProps = {
  products: ProductWithVariantsAndImages[];
};

export function ShopProductBrowser({ products }: ShopProductBrowserProps) {
  const [typeFilter, setTypeFilter] = useState<ProductTypeFilter>("all");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [themeFilter, setThemeFilter] = useState<ThemeFilter>("all");

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
    return Array.from(themes, ([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const typeMatch = typeFilter === "all" ? true : product.product_type === typeFilter;
      const locationMatch = locationFilter === "all" || product.location_tag === locationFilter;
      const themeMatch =
        themeFilter === "all" ||
        product.product_themes.some((assignment) => assignment.theme.slug === themeFilter);

      return typeMatch && locationMatch && themeMatch;
    });
  }, [locationFilter, products, themeFilter, typeFilter]);

  const handleTypeChange = (next: ProductTypeFilter) => {
    setTypeFilter(next);
    if (next === "merchandise") {
      setLocationFilter("all");
      setThemeFilter("all");
    }
  };

  return (
    <>
      <ShopFilters
        typeFilter={typeFilter}
        locationFilter={locationFilter}
        themeFilter={themeFilter}
        locationOptions={locationOptions}
        themeOptions={themeOptions}
        onTypeChange={handleTypeChange}
        onLocationChange={setLocationFilter}
        onThemeChange={setThemeFilter}
      />
      {filteredProducts.length > 0 ? (
        <ProductGrid products={filteredProducts} />
      ) : (
        <p>No prints available in this category yet.</p>
      )}
    </>
  );
}
