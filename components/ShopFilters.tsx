"use client";

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
  { value: "red-gate-beach", label: "Red Gate Beach" },
  { value: "isaac-rock", label: "Isaac Rock" },
  { value: "ss-georgette-wreck", label: "SS Georgette" },
];

export function ShopFilters({
  typeFilter,
  locationFilter,
  onTypeChange,
  onLocationChange,
}: ShopFiltersProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.group}>
        {typeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.filterBtn} ${typeFilter === option.value ? styles.active : ""}`}
            onClick={() => onTypeChange(option.value)}
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
            onClick={() => onLocationChange(option.value)}
            disabled={typeFilter === "merchandise" && option.value !== "all"}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
