declare global {
  interface Window {
    plausible?: (
      eventName: string,
      options?: { props?: Record<string, string | number | boolean> }
    ) => void;
  }
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
  SHOP_CHECKOUT_START: "Checkout Start",
  SHOP_CHECKOUT_COMPLETE: "Checkout Complete",
  SHOP_FILTER_USED: "Shop Filter",
  INSTALLATION_INTEREST: "Installation Interest",
  TALK_SIGNUP: "Talk Signup",
  SHARE_CLICK: "Share Click",
} as const;
