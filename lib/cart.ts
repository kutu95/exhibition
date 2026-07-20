export type CartItem = {
  variant_id: string;
  quantity: number;
  product_title: string;
  variant_label: string;
  price_aud: number;
  slug: string;
  image_url: string;
};

export const CART_STORAGE_KEY = "exhibition-cart";
export const CART_CHANGED_EVENT = "exhibition-cart-changed";

const canUseStorage = (): boolean => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const readCart = (): CartItem[] => {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CartItem => {
      if (!item || typeof item !== "object") return false;
      const row = item as Partial<CartItem>;
      return (
        typeof row.variant_id === "string" &&
        typeof row.quantity === "number" &&
        row.quantity > 0 &&
        typeof row.product_title === "string" &&
        typeof row.variant_label === "string" &&
        typeof row.price_aud === "number" &&
        typeof row.slug === "string" &&
        typeof row.image_url === "string"
      );
    });
  } catch {
    return [];
  }
};

const writeCart = (items: CartItem[]): CartItem[] => {
  if (!canUseStorage()) return items;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_CHANGED_EVENT));
  return items;
};

export const cartItemCount = (items: CartItem[]): number =>
  items.reduce((sum, item) => sum + item.quantity, 0);

export const cartSubtotalAud = (items: CartItem[]): number =>
  items.reduce((sum, item) => sum + item.price_aud * item.quantity, 0);

export const addToCart = (item: Omit<CartItem, "quantity"> & { quantity?: number }): CartItem[] => {
  const quantity = Math.max(1, item.quantity ?? 1);
  const current = readCart();
  const existing = current.find((row) => row.variant_id === item.variant_id);
  if (existing) {
    return writeCart(
      current.map((row) =>
        row.variant_id === item.variant_id ? { ...row, quantity: row.quantity + quantity } : row,
      ),
    );
  }
  return writeCart([...current, { ...item, quantity }]);
};

export const updateCartQuantity = (variantId: string, quantity: number): CartItem[] => {
  const nextQuantity = Math.max(0, Math.floor(quantity));
  const current = readCart();
  if (nextQuantity <= 0) {
    return writeCart(current.filter((row) => row.variant_id !== variantId));
  }
  return writeCart(
    current.map((row) => (row.variant_id === variantId ? { ...row, quantity: nextQuantity } : row)),
  );
};

export const removeFromCart = (variantId: string): CartItem[] =>
  writeCart(readCart().filter((row) => row.variant_id !== variantId));

export const clearCart = (): CartItem[] => writeCart([]);
