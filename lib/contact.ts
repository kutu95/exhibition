import { siteConfig } from "./metadata";

/** Public contact details for the exhibition and print enquiries. */
export const siteContact = {
  name: siteConfig.artist,
  email: "john@margies.app",
  phoneDisplay: "0422 139 337",
  phoneTel: "+61422139337",
  location: siteConfig.exhibition.location,
} as const;

/**
 * Seller identity for customer invoices.
 * ABN: set `INVOICE_ABN` (11 digits, spaces optional) or `abn` below.
 * Not GST-registered — invoices must not be titled "Tax Invoice".
 */
export const invoiceSeller = {
  legalName: siteConfig.artist,
  tradingName: siteConfig.name,
  addressLines: ["20 Morris Rd", "Forest Grove WA 6286", "Australia"] as const,
  email: siteContact.email,
  phone: siteContact.phoneDisplay,
  /** Fallback if `INVOICE_ABN` is unset. Digits only or spaced ABN. */
  abn: "",
  gstRegistered: false,
} as const;
