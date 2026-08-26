import type { FulfilmentProvider } from "./fulfilment";

/**
 * Stripe Checkout shipping options.
 * Rates are currently shared; branch on `provider` when PosterFactory and Pixel Perfect diverge.
 */
export const checkoutShippingOptions = (_provider: FulfilmentProvider | null) => [
  {
    shipping_rate_data: {
      type: "fixed_amount" as const,
      fixed_amount: { amount: 0, currency: "aud" },
      display_name: "Exhibition pickup",
      delivery_estimate: {
        maximum: { unit: "business_day" as const, value: 1 },
      },
    },
  },
  {
    shipping_rate_data: {
      type: "fixed_amount" as const,
      fixed_amount: { amount: 0, currency: "aud" },
      display_name: "Ship to address (Australia free / international arranged)",
      delivery_estimate: {
        minimum: { unit: "business_day" as const, value: 3 },
        maximum: { unit: "business_day" as const, value: 14 },
      },
    },
  },
];
