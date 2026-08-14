import { siteContact } from "./contact";
import { siteConfig } from "./metadata";

/** Stable marker stored on `orders.notes` so studio copies can be filtered out of sales. */
export const STUDIO_ORDER_MARKER = "studio_order";

export const STUDIO_CUSTOMER = {
  name: siteConfig.artist,
  email: siteContact.email,
} as const;

export const STUDIO_FULFILMENT_NOTE = `Studio order — no payment, no edition. ${STUDIO_ORDER_MARKER}`;

const REVENUE_STATUSES = new Set(["paid", "processing", "shipped", "delivered"]);

export const buildStudioOrderNotes = (extra?: string): string => {
  const parts = ["Studio order (no payment, no edition).", STUDIO_ORDER_MARKER];
  const trimmed = extra?.trim();
  if (trimmed) parts.push(trimmed);
  return parts.join(" ");
};

export const isStudioOrderNotes = (notes: string | null | undefined): boolean =>
  Boolean(notes?.includes(STUDIO_ORDER_MARKER));

export const isRevenueOrder = (order: { status: string; notes?: string | null }): boolean =>
  REVENUE_STATUSES.has(order.status) && !isStudioOrderNotes(order.notes);

export const pixelPerfectStudioHeader = "STUDIO COPY — pay Pixel Perfect directly (not a customer sale)";

export const pixelPerfectEditionLine = (item: {
  edition_number_assigned: number | null;
  edition_size: number | null;
  is_studio_order?: boolean;
}): string => {
  if (item.is_studio_order) return "Edition: n/a (artist copy)";
  return `Edition: ${item.edition_number_assigned ?? ""} of ${item.edition_size ?? ""}`;
};
