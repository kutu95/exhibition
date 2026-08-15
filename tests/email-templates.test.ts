import { describe, expect, it } from "vitest";

import { interpolateMergeTokens, renderOrderSummaryHtml } from "../lib/emails/merge";
import { EMAIL_TEMPLATE_DEFINITIONS } from "../lib/emails/template-defs";

describe("email template merge tokens", () => {
  it("replaces tokens in subject copy", () => {
    const subject = interpolateMergeTokens("Your order — [{{order_number}}]", {
      order_number: "GEO-0042",
    });
    expect(subject).toBe("Your order — [GEO-0042]");
  });

  it("leaves unknown tokens empty", () => {
    expect(interpolateMergeTokens("Hi {{first_name}}", {})).toBe("Hi ");
  });

  it("renders order lines without prices as raw HTML injection points", () => {
    const html = renderOrderSummaryHtml(
      [
        {
          title: "Isaac Rock No. 3",
          variant_label: "A3",
          quantity: 1,
          unit_price_aud: 45000,
          edition_number_assigned: 2,
          edition_size: 25,
        },
      ],
      45000,
    );
    expect(html).toContain("Isaac Rock No. 3");
    expect(html).toContain("Edition 2 of 25");
    expect(html).toContain("Total:");
  });

  it("seeds an order confirmation design with an order details slot", () => {
    const blocks = EMAIL_TEMPLATE_DEFINITIONS.order_confirmation.defaultBlocks();
    expect(blocks.some((block) => block.type === "merge" && block.slot === "order_summary")).toBe(true);
  });
});
