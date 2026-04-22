"use client";

import { PlausibleEvents, trackEvent } from "@/lib/plausible";

import styles from "./ShopFilters.module.css";

export type ProductTypeFilter = "all" | "print" | "merchandise";
export type LocationFilter =
  | "all"
  | "calgarta-bay"
  | "red-gate-beach"
  | "isaac-rock"
  | "ss-georgette-wreck";

type ShopFiltersProps = {
  typeFilter: ProductTypeFilter;
  locationFilter: LocationFilter;
  onTypeChange: (next: ProductTypeFilter) => void;
  onLocationChange: (next: LocationFilter) => void;
};

const typeOptions: Array<{ value: ProductTypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "print", label: "Prints" },
  { value: "merchandise", label: "Merchandise" },
];

const locationOptions: Array<{ value: LocationFilter; label: string }> = [
  { value: "all", label: "All Locations" },
  { value: "calgarta-bay", label: "Calgardup Bay" },
  { value: "red-gate-beach", label: "Redgate Beach" },
  { value: "isaac-rock", label: "Isaac Rock" },
  { value: "ss-georgette-wreck", label: "SS Georgette" },
];

export function ShopFilters({
  typeFilter,
  locationFilter,
  onTypeChange,
  onLocationChange,
}: ShopFiltersProps) {
  const handleFilterClick = (filterType: "product_type" | "location", filterValue: string, onClick: () => void) => {
    trackEvent(PlausibleEvents.SHOP_FILTER_USED, {
      filter_type: filterType,
      filter_value: filterValue,
    });
    onClick();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.group}>
        {typeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.filterBtn} ${typeFilter === option.value ? styles.active : ""}`}
            onClick={() => handleFilterClick("product_type", option.value, () => onTypeChange(option.value))}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className={styles.group}>
        {locationOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.filterBtn} ${locationFilter === option.value ? styles.active : ""}`}
            onClick={() => handleFilterClick("location", option.value, () => onLocationChange(option.value))}
            disabled={typeFilter === "merchandise" && option.value !== "all"}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
