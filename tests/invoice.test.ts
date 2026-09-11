import { describe, expect, it } from "vitest";

import {
  abnDigits,
  buildInvoice,
  formatAbn,
  invoiceEmailAllowed,
  invoiceTotalsForOrder,
  isPlaceholderCustomerEmail,
  paymentMethodLabel,
  renderInvoiceDocumentHtml,
  shippingAddressLines,
} from "../lib/invoice";

const baseOrder = {
  order_number: "GEO-0007",
  status: "paid",
  customer_name: "Alex Taylor",
  customer_email: "alex@example.com",
  shipping_address: {
    street: "12 Redgate Rd",
    suburb: "Margaret River",
    state: "WA",
    postcode: "6285",
  },
  subtotal_aud: 45000,
  shipping_aud: 0,
  total_aud: 45000,
  square_payment_id: "sqtxn_123",
  created_at: "2026-09-12T02:00:00.000Z",
};

const line = {
  title: "Isaac Rock No. 3",
  variant_label: "A3 · Tier 1",
  quantity: 1,
  unit_price_aud: 45000,
  edition_number_assigned: 2,
  edition_size: 25,
};

describe("invoice totals", () => {
  it("sets amount owing to zero when the order is paid", () => {
    const totals = invoiceTotalsForOrder(baseOrder);
    expect(totals.gstAud).toBe(0);
    expect(totals.amountPaidAud).toBe(45000);
    expect(totals.amountOwingAud).toBe(0);
  });

  it("sets amount owing to the total when the order is pending", () => {
    const totals = invoiceTotalsForOrder({ ...baseOrder, status: "pending" });
    expect(totals.amountPaidAud).toBe(0);
    expect(totals.amountOwingAud).toBe(45000);
    expect(totals.gstAud).toBe(0);
  });

  it("sets owing to zero for cancelled and refunded orders", () => {
    expect(invoiceTotalsForOrder({ ...baseOrder, status: "cancelled" }).amountOwingAud).toBe(0);
    expect(invoiceTotalsForOrder({ ...baseOrder, status: "refunded" }).amountPaidAud).toBe(0);
    expect(invoiceTotalsForOrder({ ...baseOrder, status: "refunded" }).amountOwingAud).toBe(0);
  });
});

describe("invoice document", () => {
  it("formats an 11-digit ABN", () => {
    expect(abnDigits("12 345 678 901")).toBe("12345678901");
    expect(formatAbn("12345678901")).toBe("12 345 678 901");
  });

  it("includes seller identity, GST $0.00, and amount owing, and is not titled Tax Invoice", () => {
    const invoice = buildInvoice(baseOrder, [line], {
      issueDate: new Date("2026-09-12T00:00:00.000Z"),
      abnDigits: "12345678901",
    });
    const html = renderInvoiceDocumentHtml(invoice);
    expect(html).toContain("INVOICE");
    expect(html).not.toContain("Tax Invoice");
    expect(html).toContain("John Bowskill");
    expect(html).toContain("20 Morris Rd");
    expect(html).toContain("ABN 12 345 678 901");
    expect(html).toContain("Not registered for GST");
    expect(html).toContain("GST");
    expect(html).toContain("$0.00");
    expect(html).toContain("Amount owing");
    expect(html).toContain("Paid in full");
    expect(html).toContain("Isaac Rock No. 3");
    expect(html).toContain("Alex Taylor");
  });

  it("labels Square payments", () => {
    expect(paymentMethodLabel(baseOrder)).toBe("Square");
    expect(
      paymentMethodLabel({
        ...baseOrder,
        square_payment_id: null,
        stripe_checkout_session_id: "cs_test",
      }),
    ).toBe("Card (Stripe)");
    expect(
      paymentMethodLabel({
        ...baseOrder,
        square_payment_id: null,
        notes: "On-site sale. payment=cash",
      }),
    ).toBe("Cash");
  });

  it("reads nested Stripe-style shipping addresses", () => {
    expect(
      shippingAddressLines({
        address: { line1: "1 Ocean St", city: "Margaret River", state: "WA", postal_code: "6285" },
      }),
    ).toEqual(["1 Ocean St", "Margaret River WA 6285"]);
  });

  it("blocks studio and placeholder customers", () => {
    expect(isPlaceholderCustomerEmail("admin-test-order@exhibition.local")).toBe(true);
    expect(
      invoiceEmailAllowed({
        customer_email: "alex@example.com",
        notes: "studio_order",
      }).ok,
    ).toBe(false);
    expect(
      invoiceEmailAllowed({
        customer_email: "admin-test-order@exhibition.local",
      }).ok,
    ).toBe(false);
  });
});
