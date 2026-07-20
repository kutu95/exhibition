"use client";

import { useEffect } from "react";

import { clearCart } from "@/lib/cart";
import { PlausibleEvents, trackEvent } from "@/lib/plausible";

export function OrderSuccessTracker() {
  useEffect(() => {
    clearCart();
    trackEvent(PlausibleEvents.SHOP_CHECKOUT_COMPLETE);
  }, []);

  return null;
}
