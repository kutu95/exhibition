"use client";

import { useEffect } from "react";

import { PlausibleEvents, trackEvent } from "@/lib/plausible";

export function InstallationPageTracker() {
  useEffect(() => {
    trackEvent(PlausibleEvents.INSTALLATION_INTEREST);
  }, []);

  return null;
}
