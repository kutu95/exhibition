import { ALIAS_HOSTS, CANONICAL_HOST } from "./metadata";

declare global {
  interface Window {
    plausible?: (
      eventName: string,
      options?: { props?: Record<string, string | number | boolean> }
    ) => void;
  }
}

/** Existing Plausible CE site id. Must stay first in `data-domain`. */
export const PLAUSIBLE_SITE_DOMAIN = "exhibition.margies.app";

/**
 * Tracker `data-domain` for every public host. Plausible CE v2 splits on commas
 * and records into each matching site; only `PLAUSIBLE_SITE_DOMAIN` exists, so
 * that name stays first and extra hosts are aliases, not a second property.
 */
export function plausibleDataDomain(): string {
  const hosts = new Set<string>([PLAUSIBLE_SITE_DOMAIN, CANONICAL_HOST, ...ALIAS_HOSTS]);
  const fromEnv = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim() ?? "";
  for (const part of fromEnv.split(",")) {
    const host = part.trim().toLowerCase().replace(/^www\./, "");
    if (host) hosts.add(host);
  }
  const rest = [...hosts].filter((host) => host !== PLAUSIBLE_SITE_DOMAIN).sort();
  return [PLAUSIBLE_SITE_DOMAIN, ...rest].join(",");
}

export function trackEvent(
  eventName: string,
  props?: Record<string, string | number | boolean>,
) {
  if (typeof window === "undefined") return;
  if (!window.plausible) return;
  window.plausible(eventName, props ? { props } : undefined);
}

export const PlausibleEvents = {
  EMAIL_SIGNUP: "Email Signup",
  SHOP_VIEW_PRODUCT: "View Product",
  SHOP_ADD_TO_CART: "Add to Cart",
  SHOP_CHECKOUT_START: "Checkout Start",
  SHOP_CHECKOUT_COMPLETE: "Checkout Complete",
  SHOP_FILTER_USED: "Shop Filter",
  SHOP_FAVOURITE_TOGGLE: "Favourite Toggle",
  INSTALLATION_INTEREST: "Installation Interest",
  TALK_SIGNUP: "Talk Signup",
  TALK_REGISTER: "Talk Register",
  SHARE_CLICK: "Share Click",
} as const;
