"use client";

import { useMemo, useState } from "react";

import type { ProductWithVariantsAndImages } from "../lib/supabase/types";
import { ProductGrid } from "./ProductGrid";
import { LocationFilter, ProductTypeFilter, ShopFilters } from "./ShopFilters";

type ShopProductBrowserProps = {
  products: ProductWithVariantsAndImages[];
};

const locationMap: Record<LocationFilter, string | null> = {
  all: null,
  "calgarta-bay": "Calgardup Bay",
  "red-gate-beach": "Red Gate Beach",
  "isaac-rock": "Isaac Rock",
  "ss-georgette-wreck": "SS Georgette Wreck",
};

export function ShopProductBrowser({ products }: ShopProductBrowserProps) {
  const [typeFilter, setTypeFilter] = useState<ProductTypeFilter>("all");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const typeMatch = typeFilter === "all" ? true : product.product_type === typeFilter;
      const locationTarget = locationMap[locationFilter];
      const locationMatch = locationTarget ? product.location_tag === locationTarget : true;

      return typeMatch && locationMatch;
    });
  }, [locationFilter, products, typeFilter]);

  const handleTypeChange = (next: ProductTypeFilter) => {
    setTypeFilter(next);
    if (next === "merchandise") {
      setLocationFilter("all");
    }
  };

  return (
    <>
      <ShopFilters
        typeFilter={typeFilter}
        locationFilter={locationFilter}
        onTypeChange={handleTypeChange}
        onLocationChange={setLocationFilter}
      />
      {filteredProducts.length > 0 ? (
        <ProductGrid products={filteredProducts} />
      ) : (
        <p>No prints available in this category yet.</p>
      )}
    </>
  );
}
