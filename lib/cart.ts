import {
  MIXED_PROVIDER_MESSAGE,
  parseFulfilmentProvider,
  type FulfilmentProvider,
} from "./fulfilment";

export type CartItem = {
  variant_id: string;
  quantity: number;
  product_title: string;
  variant_label: string;
  price_aud: number;
  slug: string;
  image_url: string;
  fulfilment_provider?: FulfilmentProvider | null;
  frame_colour?: string | null;
};

export const CART_STORAGE_KEY = "exhibition-cart";
export const CART_CHANGED_EVENT = "exhibition-cart-changed";

export type TryAddToCartResult =
  | { ok: true; items: CartItem[] }
  | {
      ok: false;
      code: "mixed_provider";
      message: string;
      cartProvider: FulfilmentProvider;
      itemProvider: FulfilmentProvider;
    };

const canUseStorage = (): boolean => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const itemProvider = (item: Pick<CartItem, "fulfilment_provider">): FulfilmentProvider | null =>
  parseFulfilmentProvider(item.fulfilment_provider);

export const cartFulfilmentProviders = (items: CartItem[]): FulfilmentProvider[] => {
  const providers = new Set<FulfilmentProvider>();
  for (const item of items) {
    const provider = itemProvider(item);
    if (provider) providers.add(provider);
  }
  return [...providers];
};

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

const normalizeIncoming = (item: Omit<CartItem, "quantity"> & { quantity?: number }): CartItem => ({
  ...item,
  quantity: Math.max(1, item.quantity ?? 1),
  fulfilment_provider: parseFulfilmentProvider(item.fulfilment_provider),
  frame_colour: item.frame_colour ?? null,
});

export const tryAddToCart = (item: Omit<CartItem, "quantity"> & { quantity?: number }): TryAddToCartResult => {
  const incoming = normalizeIncoming(item);
  const current = readCart();
  const existing = current.find((row) => row.variant_id === incoming.variant_id);
  if (existing) {
    return {
      ok: true,
      items: writeCart(
        current.map((row) =>
          row.variant_id === incoming.variant_id
            ? {
                ...row,
                quantity: row.quantity + incoming.quantity,
                fulfilment_provider: incoming.fulfilment_provider ?? row.fulfilment_provider,
                frame_colour: incoming.frame_colour ?? row.frame_colour,
              }
            : row,
        ),
      ),
    };
  }

  const cartProviders = cartFulfilmentProviders(current);
  const nextProvider = incoming.fulfilment_provider;
  if (cartProviders.length > 0 && nextProvider && !cartProviders.includes(nextProvider)) {
    return {
      ok: false,
      code: "mixed_provider",
      message: MIXED_PROVIDER_MESSAGE,
      cartProvider: cartProviders[0]!,
      itemProvider: nextProvider,
    };
  }

  return { ok: true, items: writeCart([...current, incoming]) };
};

export const addToCart = (item: Omit<CartItem, "quantity"> & { quantity?: number }): CartItem[] => {
  const result = tryAddToCart(item);
  if (result.ok) return result.items;
  return readCart();
};

export const replaceCartWithItem = (item: Omit<CartItem, "quantity"> & { quantity?: number }): CartItem[] =>
  writeCart([normalizeIncoming(item)]);

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
