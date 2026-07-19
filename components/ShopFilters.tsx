"use client";

import { PlausibleEvents, trackEvent } from "@/lib/plausible";

import styles from "./ShopFilters.module.css";

export type ProductTypeFilter = "all" | "print" | "merchandise";
export type LocationFilter = "all" | string;
export type ThemeFilter = "all" | string;

type FilterOption = { value: string; label: string };

type ShopFiltersProps = {
  typeFilter: ProductTypeFilter;
  locationFilter: LocationFilter;
  themeFilter: ThemeFilter;
  locationOptions: FilterOption[];
  themeOptions: FilterOption[];
  onTypeChange: (next: ProductTypeFilter) => void;
  onLocationChange: (next: LocationFilter) => void;
  onThemeChange: (next: ThemeFilter) => void;
};

const typeOptions: Array<{ value: ProductTypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "print", label: "Prints" },
  { value: "merchandise", label: "Merchandise" },
];

export function ShopFilters({
  typeFilter,
  locationFilter,
  themeFilter,
  locationOptions,
  themeOptions,
  onTypeChange,
  onLocationChange,
  onThemeChange,
}: ShopFiltersProps) {
  const handleFilterClick = (
    filterType: "product_type" | "location" | "theme",
    filterValue: string,
    onClick: () => void,
  ) => {
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

      {locationOptions.length > 0 ? (
        <div>
          <p className={styles.groupLabel}>Location</p>
          <div className={styles.group}>
            <button
              type="button"
              className={`${styles.filterBtn} ${locationFilter === "all" ? styles.active : ""}`}
              onClick={() => handleFilterClick("location", "all", () => onLocationChange("all"))}
            >
              All Locations
            </button>
            {locationOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.filterBtn} ${locationFilter === option.value ? styles.active : ""}`}
                onClick={() => handleFilterClick("location", option.value, () => onLocationChange(option.value))}
                disabled={typeFilter === "merchandise"}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {themeOptions.length > 0 ? (
        <div>
          <p className={styles.groupLabel}>Theme</p>
          <div className={styles.group}>
            <button
              type="button"
              className={`${styles.filterBtn} ${themeFilter === "all" ? styles.active : ""}`}
              onClick={() => handleFilterClick("theme", "all", () => onThemeChange("all"))}
            >
              All Themes
            </button>
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.filterBtn} ${themeFilter === option.value ? styles.active : ""}`}
                onClick={() => handleFilterClick("theme", option.value, () => onThemeChange(option.value))}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
