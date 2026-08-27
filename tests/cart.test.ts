import { afterEach, describe, expect, it } from "vitest";

import {
  CART_STORAGE_KEY,
  clearCart,
  readCart,
  replaceCartWithItem,
  tryAddToCart,
} from "../lib/cart";

const memory = new Map<string, string>();

const installStorage = () => {
  const localStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage,
      dispatchEvent: () => true,
    },
  });
};

afterEach(() => {
  memory.clear();
  clearCart();
});

describe("mixed-provider cart", () => {
  it("allows multiple PosterFactory items including framed", () => {
    installStorage();
    const first = tryAddToCart({
      variant_id: "photo-1",
      product_title: "Jetty",
      variant_label: "A2 · Tier 1",
      price_aud: 9600,
      slug: "jetty",
      image_url: "/images/jetty.jpg",
      fulfilment_provider: "posterfactory",
    });
    expect(first.ok).toBe(true);
    const second = tryAddToCart({
      variant_id: "framed-1",
      product_title: "Jetty",
      variant_label: "A2 · Framed Print",
      price_aud: 29700,
      slug: "jetty",
      image_url: "/images/jetty.jpg",
      fulfilment_provider: "posterfactory",
    });
    expect(second.ok).toBe(true);
    expect(readCart()).toHaveLength(2);
  });

  it("allows multiple Pixel Perfect Fine Art items", () => {
    installStorage();
    expect(
      tryAddToCart({
        variant_id: "fa-1",
        product_title: "Jetty",
        variant_label: "A4 · Tier 2",
        price_aud: 18000,
        slug: "jetty",
        image_url: "/images/jetty.jpg",
        fulfilment_provider: "pixelperfect",
      }).ok,
    ).toBe(true);
    expect(
      tryAddToCart({
        variant_id: "fa-2",
        product_title: "Harbour",
        variant_label: "A0 · Tier 2",
        price_aud: 42000,
        slug: "harbour",
        image_url: "/images/harbour.jpg",
        fulfilment_provider: "pixelperfect",
      }).ok,
    ).toBe(true);
  });

  it("blocks PosterFactory followed by Pixel Perfect without adding", () => {
    installStorage();
    tryAddToCart({
      variant_id: "photo-1",
      product_title: "Jetty",
      variant_label: "A2 · Tier 1",
      price_aud: 9600,
      slug: "jetty",
      image_url: "/images/jetty.jpg",
      fulfilment_provider: "posterfactory",
    });
    const blocked = tryAddToCart({
      variant_id: "fa-1",
      product_title: "Jetty",
      variant_label: "A2 · Tier 2",
      price_aud: 22000,
      slug: "jetty",
      image_url: "/images/jetty.jpg",
      fulfilment_provider: "pixelperfect",
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.code).toBe("mixed_provider");
      expect(blocked.message).toContain("ordered separately");
    }
    expect(readCart()).toHaveLength(1);
    expect(readCart()[0]?.variant_id).toBe("photo-1");
  });

  it("blocks Pixel Perfect followed by PosterFactory", () => {
    installStorage();
    tryAddToCart({
      variant_id: "fa-1",
      product_title: "Jetty",
      variant_label: "A2 · Tier 2",
      price_aud: 22000,
      slug: "jetty",
      image_url: "/images/jetty.jpg",
      fulfilment_provider: "pixelperfect",
    });
    const blocked = tryAddToCart({
      variant_id: "photo-1",
      product_title: "Jetty",
      variant_label: "A2 · Tier 1",
      price_aud: 9600,
      slug: "jetty",
      image_url: "/images/jetty.jpg",
      fulfilment_provider: "posterfactory",
    });
    expect(blocked.ok).toBe(false);
  });

  it("starts a separate order by replacing the cart", () => {
    installStorage();
    tryAddToCart({
      variant_id: "photo-1",
      product_title: "Jetty",
      variant_label: "A2 · Tier 1",
      price_aud: 9600,
      slug: "jetty",
      image_url: "/images/jetty.jpg",
      fulfilment_provider: "posterfactory",
    });
    replaceCartWithItem({
      variant_id: "fa-1",
      product_title: "Jetty",
      variant_label: "A2 · Tier 2",
      price_aud: 22000,
      slug: "jetty",
      image_url: "/images/jetty.jpg",
      fulfilment_provider: "pixelperfect",
    });
    expect(readCart().map((item) => item.variant_id)).toEqual(["fa-1"]);
    expect(memory.get(CART_STORAGE_KEY)).toContain("pixelperfect");
  });
});
