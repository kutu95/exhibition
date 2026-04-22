"use client";

import { useEffect } from "react";

import { PlausibleEvents, trackEvent } from "@/lib/plausible";

export function OrderSuccessTracker() {
  useEffect(() => {
    trackEvent(PlausibleEvents.SHOP_CHECKOUT_COMPLETE);
  }, []);

  return null;
}
