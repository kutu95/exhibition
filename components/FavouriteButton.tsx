"use client";

import { PlausibleEvents, trackEvent } from "../lib/plausible";
import { useFavourites } from "./FavouritesProvider";
import styles from "./FavouriteButton.module.css";

type FavouriteButtonProps = {
  productId: string;
  productTitle: string;
  className?: string;
  size?: "card" | "detail" | "compact";
};

const SIZE_CLASS = {
  card: "card",
  detail: "detail",
  compact: "compact",
} as const;

export function FavouriteButton({
  productId,
  productTitle,
  className,
  size = "card",
}: FavouriteButtonProps) {
  const { isFavourite, toggleFavourite } = useFavourites();
  const favourited = isFavourite(productId);

  return (
    <button
      type="button"
      className={`${styles.button} ${styles[SIZE_CLASS[size]]} ${favourited ? styles.active : ""} ${className ?? ""}`}
      aria-pressed={favourited}
      aria-label={favourited ? `Remove ${productTitle} from favourites` : `Add ${productTitle} to favourites`}
      title={favourited ? "Remove from favourites" : "Add to favourites"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleFavourite(productId);
        trackEvent(PlausibleEvents.SHOP_FAVOURITE_TOGGLE, {
          product: productTitle,
          action: favourited ? "remove" : "add",
        });
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
        <path
          d="M12 20.25s-6.75-4.2-9.2-8.1C1.1 9.75 2.1 6.6 5.05 5.55c1.85-.65 3.85-.05 5.05 1.35 1.2-1.4 3.2-2 5.05-1.35 2.95 1.05 3.95 4.2 2.25 6.6C18.75 16.05 12 20.25 12 20.25z"
          fill={favourited ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      {size === "detail" ? (
        <span>{favourited ? "Favourited" : "Favourite"}</span>
      ) : null}
    </button>
  );
}
