"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import {
  FAVOURITES_CHANGED_EVENT,
  getOrCreateVisitorId,
  readFavourites,
  toggleFavourite as toggleFavouriteStorage,
} from "../lib/favourites";

type FavouritesContextValue = {
  favouriteIds: string[];
  favouriteCount: number;
  isFavourite: (productId: string) => boolean;
  toggleFavourite: (productId: string) => void;
};

const FavouritesContext = createContext<FavouritesContextValue | null>(null);

async function syncFavouriteTally(productId: string, action: "add" | "remove"): Promise<void> {
  const visitorId = getOrCreateVisitorId();
  if (!visitorId) return;

  try {
    await fetch("/api/favourites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, action, visitor_id: visitorId }),
    });
  } catch (error) {
    console.error("Favourite tally sync failed", error);
  }
}

export function FavouritesProvider({ children }: { children: ReactNode }) {
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => setFavouriteIds(readFavourites());
    sync();
    getOrCreateVisitorId();
    setHydrated(true);
    window.addEventListener(FAVOURITES_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(FAVOURITES_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const value: FavouritesContextValue = {
    favouriteIds: hydrated ? favouriteIds : [],
    favouriteCount: hydrated ? favouriteIds.length : 0,
    isFavourite: (productId) => (hydrated ? favouriteIds.includes(productId) : false),
    toggleFavourite: (productId) => {
      const { ids, added } = toggleFavouriteStorage(productId);
      setFavouriteIds(ids);
      void syncFavouriteTally(productId, added ? "add" : "remove");
    },
  };

  return <FavouritesContext.Provider value={value}>{children}</FavouritesContext.Provider>;
}

export function useFavourites(): FavouritesContextValue {
  const context = useContext(FavouritesContext);
  if (!context) {
    throw new Error("useFavourites must be used within FavouritesProvider");
  }
  return context;
}
