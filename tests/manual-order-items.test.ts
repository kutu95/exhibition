import { describe, expect, it } from "vitest";

import { resolveManualOrderLines } from "../lib/manual-order-items";

describe("resolveManualOrderLines", () => {
  it("keeps a single variant_id payload for studio and test orders", () => {
    expect(
      resolveManualOrderLines({
        variant_id: "11111111-1111-4111-8111-111111111111",
        quantity: 2,
      }),
    ).toEqual({
      ok: true,
      lines: [
        {
          variant_id: "11111111-1111-4111-8111-111111111111",
          quantity: 2,
          frame_colour: null,
        },
      ],
    });
  });

  it("prefers an items array for on-site multi-line carts", () => {
    expect(
      resolveManualOrderLines({
        variant_id: "ignored",
        quantity: 1,
        items: [
          {
            variant_id: "11111111-1111-4111-8111-111111111111",
            quantity: 1,
            frame_colour: "black",
          },
          {
            variant_id: "22222222-2222-4222-8222-222222222222",
            quantity: 3,
          },
        ],
      }),
    ).toEqual({
      ok: true,
      lines: [
        {
          variant_id: "11111111-1111-4111-8111-111111111111",
          quantity: 1,
          frame_colour: "black",
        },
        {
          variant_id: "22222222-2222-4222-8222-222222222222",
          quantity: 3,
          frame_colour: null,
        },
      ],
    });
  });

  it("rejects an empty payload and an oversized cart", () => {
    expect(resolveManualOrderLines({})).toEqual({
      ok: false,
      error: "items or variant_id is required.",
    });
    expect(
      resolveManualOrderLines({
        items: Array.from({ length: 21 }, (_, index) => ({
          variant_id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          quantity: 1,
        })),
      }),
    ).toEqual({ ok: false, error: "Orders can include at most 20 line items." });
  });
});
