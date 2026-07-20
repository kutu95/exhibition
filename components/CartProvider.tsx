"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import {
  addToCart as addCartItem,
  CART_CHANGED_EVENT,
  cartItemCount,
  cartSubtotalAud,
  clearCart as clearCartStorage,
  readCart,
  removeFromCart as removeCartItem,
  type CartItem,
  updateCartQuantity as setCartQuantity,
} from "../lib/cart";

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotalAud: number;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => setItems(readCart());
    sync();
    setHydrated(true);
    window.addEventListener(CART_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const value: CartContextValue = {
    items: hydrated ? items : [],
    itemCount: hydrated ? cartItemCount(items) : 0,
    subtotalAud: hydrated ? cartSubtotalAud(items) : 0,
    addItem: (item) => setItems(addCartItem(item)),
    updateQuantity: (variantId, quantity) => setItems(setCartQuantity(variantId, quantity)),
    removeItem: (variantId) => setItems(removeCartItem(variantId)),
    clear: () => setItems(clearCartStorage()),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
