"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { MixedProviderDialog } from "./MixedProviderDialog";
import {
  CART_CHANGED_EVENT,
  cartItemCount,
  cartSubtotalAud,
  clearCart as clearCartStorage,
  readCart,
  removeFromCart as removeCartItem,
  replaceCartWithItem,
  tryAddToCart,
  type CartItem,
  type TryAddToCartResult,
  updateCartQuantity as setCartQuantity,
} from "../lib/cart";

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotalAud: number;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => TryAddToCartResult;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pendingItem, setPendingItem] = useState<(Omit<CartItem, "quantity"> & { quantity?: number }) | null>(null);

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

  const addItem = (item: Omit<CartItem, "quantity"> & { quantity?: number }): TryAddToCartResult => {
    const result = tryAddToCart(item);
    if (result.ok) {
      setItems(result.items);
      return result;
    }
    setPendingItem(item);
    return result;
  };

  const value: CartContextValue = {
    items: hydrated ? items : [],
    itemCount: hydrated ? cartItemCount(items) : 0,
    subtotalAud: hydrated ? cartSubtotalAud(items) : 0,
    addItem,
    updateQuantity: (variantId, quantity) => setItems(setCartQuantity(variantId, quantity)),
    removeItem: (variantId) => setItems(removeCartItem(variantId)),
    clear: () => setItems(clearCartStorage()),
  };

  return (
    <CartContext.Provider value={value}>
      {children}
      <MixedProviderDialog
        open={Boolean(pendingItem)}
        cartItemCount={cartItemCount(items)}
        onContinue={() => setPendingItem(null)}
        onStartSeparate={() => {
          if (!pendingItem) return;
          setItems(replaceCartWithItem(pendingItem));
          setPendingItem(null);
          router.push("/cart");
        }}
      />
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
