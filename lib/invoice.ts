import { invoiceSeller } from "./contact";
import { editionLine } from "./emails/merge";
import { describeVariantForBuyer } from "./print-offer";
import { isStudioOrderNotes } from "./studio-orders";
import type { OrderStatus } from "./supabase/types";
import { formatAUD } from "./utils/currency";

const PAID_STATUSES = new Set<OrderStatus | string>([
  "paid",
  "processing",
  "shipped",
  "delivered",
]);

const CLOSED_UNPAID_STATUSES = new Set<OrderStatus | string>(["cancelled", "refunded"]);

export type InvoiceLineInput = {
  title: string;
  variant_label: string;
  quantity: number;
  unit_price_aud: number;
  edition_number_assigned?: number | null;
  edition_size?: number | null;
  frame_colour?: string | null;
};

export type InvoiceOrderInput = {
  order_number: string;
  status: string;
  customer_name: string | null;
  customer_email: string;
  shipping_address?: Record<string, unknown> | null;
  subtotal_aud: number;
  shipping_aud: number;
  total_aud: number;
  discount_code?: string | null;
  discount_percent?: number | null;
  discount_amount_aud?: number | null;
  notes?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_checkout_session_id?: string | null;
  square_payment_id?: string | null;
  created_at: string;
};

export type InvoiceTotals = {
  subtotalAud: number;
  discountAud: number;
  shippingAud: number;
  gstAud: number;
  totalAud: number;
  amountPaidAud: number;
  amountOwingAud: number;
};

export type BuiltInvoice = {
  invoiceNumber: string;
  issueDate: string;
  orderDate: string;
  sellerName: string;
  sellerTradingName: string;
  sellerAddressLines: string[];
  sellerEmail: string;
  sellerPhone: string;
  sellerAbnFormatted: string;
  gstRegistered: boolean;
  billToName: string;
  billToEmail: string;
  billToAddressLines: string[];
  lines: Array<{
    description: string;
    detail: string;
    quantity: number;
    unitPriceAud: number;
    amountAud: number;
  }>;
  totals: InvoiceTotals;
  paymentMethod: string;
  statusLabel: string;
  paidInFull: boolean;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const abnDigits = (value: string): string => value.replace(/\D/g, "");

export const formatAbn = (digits: string): string => {
  const clean = abnDigits(digits);
  if (clean.length !== 11) return digits.trim();
  return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 11)}`;
};

export const getInvoiceAbnDigits = (): string | null => {
  const raw = process.env.INVOICE_ABN?.trim() || invoiceSeller.abn.trim();
  const digits = abnDigits(raw);
  return digits.length === 11 ? digits : null;
};

export const isPlaceholderCustomerEmail = (email: string | null | undefined): boolean =>
  Boolean(email?.trim().toLowerCase().endsWith("@exhibition.local"));

export const isOrderPaidForInvoice = (status: string): boolean => PAID_STATUSES.has(status);

export const invoiceTotalsForOrder = (order: {
  status: string;
  subtotal_aud: number;
  shipping_aud: number;
  total_aud: number;
  discount_amount_aud?: number | null;
}): InvoiceTotals => {
  const subtotalAud = Math.max(0, order.subtotal_aud);
  const discountAud = Math.max(0, order.discount_amount_aud ?? 0);
  const shippingAud = Math.max(0, order.shipping_aud);
  const totalAud = Math.max(0, order.total_aud);
  const amountPaidAud = isOrderPaidForInvoice(order.status) ? totalAud : 0;
  const amountOwingAud = CLOSED_UNPAID_STATUSES.has(order.status)
    ? 0
    : Math.max(0, totalAud - amountPaidAud);
  return {
    subtotalAud,
    discountAud,
    shippingAud,
    gstAud: 0,
    totalAud,
    amountPaidAud,
    amountOwingAud,
  };
};

export const formatInvoiceDate = (iso: string, now = new Date()): string => {
  const date = iso ? new Date(iso) : now;
  const valid = Number.isNaN(date.getTime()) ? now : date;
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Perth",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(valid);
};

const addressField = (record: Record<string, unknown> | null | undefined, keys: string[]): string => {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

export const shippingAddressLines = (
  shippingAddress: Record<string, unknown> | null | undefined,
): string[] => {
  if (!shippingAddress) return [];
  const nested =
    shippingAddress.address && typeof shippingAddress.address === "object"
      ? (shippingAddress.address as Record<string, unknown>)
      : null;
  const street = addressField(shippingAddress, ["street", "line1"]) || addressField(nested, ["line1"]);
  const suburb =
    addressField(shippingAddress, ["suburb", "city"]) || addressField(nested, ["city"]);
  const state = addressField(shippingAddress, ["state"]) || addressField(nested, ["state"]);
  const postcode =
    addressField(shippingAddress, ["postcode", "postal_code"]) ||
    addressField(nested, ["postal_code"]);
  const region = [suburb, state, postcode].filter(Boolean).join(" ");
  return [street, region].filter(Boolean);
};

export const paymentMethodLabel = (order: InvoiceOrderInput): string => {
  if (order.square_payment_id) return "Square";
  if (order.stripe_payment_intent_id || order.stripe_checkout_session_id) return "Card (Stripe)";
  const notes = order.notes ?? "";
  const match = notes.match(/payment=([a-z_]+)/i);
  if (match?.[1] === "cash") return "Cash";
  if (match?.[1] === "square") return "Square";
  if (match?.[1] === "manual") return "Recorded as paid";
  if (isOrderPaidForInvoice(order.status)) return "Paid";
  return "Unpaid";
};

const lineDescription = (item: InvoiceLineInput): { description: string; detail: string } => {
  const buyerLabel =
    describeVariantForBuyer(
      { variant_label: item.variant_label },
      item.frame_colour,
    ) ?? item.variant_label;
  const edition = editionLine(item.edition_number_assigned, item.edition_size);
  return {
    description: item.title,
    detail: [buyerLabel, edition].filter(Boolean).join(" · "),
  };
};

export const buildInvoice = (
  order: InvoiceOrderInput,
  items: InvoiceLineInput[],
  options?: { issueDate?: Date; abnDigits?: string | null },
): BuiltInvoice => {
  const abn = options?.abnDigits ?? getInvoiceAbnDigits();
  const issueNow = options?.issueDate ?? new Date();
  const totals = invoiceTotalsForOrder(order);
  return {
    invoiceNumber: order.order_number,
    issueDate: formatInvoiceDate(issueNow.toISOString(), issueNow),
    orderDate: formatInvoiceDate(order.created_at, issueNow),
    sellerName: invoiceSeller.legalName,
    sellerTradingName: invoiceSeller.tradingName,
    sellerAddressLines: [...invoiceSeller.addressLines],
    sellerEmail: invoiceSeller.email,
    sellerPhone: invoiceSeller.phone,
    sellerAbnFormatted: abn ? formatAbn(abn) : "",
    gstRegistered: invoiceSeller.gstRegistered,
    billToName: order.customer_name?.trim() || "Customer",
    billToEmail: order.customer_email.trim(),
    billToAddressLines: shippingAddressLines(order.shipping_address),
    lines: items.map((item) => {
      const { description, detail } = lineDescription(item);
      return {
        description,
        detail,
        quantity: item.quantity,
        unitPriceAud: item.unit_price_aud,
        amountAud: item.unit_price_aud * item.quantity,
      };
    }),
    totals,
    paymentMethod: paymentMethodLabel(order),
    statusLabel: order.status,
    paidInFull: totals.amountOwingAud === 0 && isOrderPaidForInvoice(order.status),
  };
};

const moneyRow = (label: string, amount: number, strong = false): string => {
  const labelHtml = strong ? `<strong>${escapeHtml(label)}</strong>` : escapeHtml(label);
  const amountHtml = strong
    ? `<strong>${escapeHtml(formatAUD(amount))}</strong>`
    : escapeHtml(formatAUD(amount));
  return `<tr>
    <td colspan="3" style="padding:6px 8px;text-align:right;border-top:1px solid #e5e7eb;">${labelHtml}</td>
    <td style="padding:6px 8px;text-align:right;border-top:1px solid #e5e7eb;white-space:nowrap;">${amountHtml}</td>
  </tr>`;
};

/** Australian invoice HTML: identity, ABN, date, number, supplies, GST $0, amount owing. */
export const renderInvoiceDocumentHtml = (invoice: BuiltInvoice): string => {
  const sellerAddress = invoice.sellerAddressLines.map((line) => escapeHtml(line)).join("<br />");
  const billToAddress = invoice.billToAddressLines.map((line) => escapeHtml(line)).join("<br />");
  const lineRows = invoice.lines
    .map((line) => {
      return `<tr>
        <td style="padding:8px;border-top:1px solid #e5e7eb;vertical-align:top;">
          <div style="font-weight:600;">${escapeHtml(line.description)}</div>
          <div style="color:#4b5563;font-size:13px;">${escapeHtml(line.detail)}</div>
        </td>
        <td style="padding:8px;border-top:1px solid #e5e7eb;text-align:right;vertical-align:top;">${line.quantity}</td>
        <td style="padding:8px;border-top:1px solid #e5e7eb;text-align:right;vertical-align:top;white-space:nowrap;">${escapeHtml(formatAUD(line.unitPriceAud))}</td>
        <td style="padding:8px;border-top:1px solid #e5e7eb;text-align:right;vertical-align:top;white-space:nowrap;">${escapeHtml(formatAUD(line.amountAud))}</td>
      </tr>`;
    })
    .join("");

  const owingStyle = invoice.paidInFull
    ? "background:#ecfdf3;border:1px solid #bbf7d0;color:#166534;"
    : "background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;";
  const owingNote = invoice.paidInFull
    ? "Paid in full"
    : invoice.totals.amountOwingAud > 0
      ? "Amount due"
      : invoice.statusLabel === "refunded"
        ? "Refunded — nothing owing"
        : "Nothing owing";

  return `
    <div style="margin:0 0 20px;padding:16px;border:1px solid #d1d5db;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:14px;line-height:1.45;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
        <tr>
          <td style="vertical-align:top;">
            <div style="font-size:22px;letter-spacing:0.04em;font-weight:700;">INVOICE</div>
            <div style="margin-top:4px;color:#4b5563;font-size:13px;">Not registered for GST — no GST has been charged.</div>
          </td>
          <td style="vertical-align:top;text-align:right;">
            <div><strong>Invoice no.</strong> ${escapeHtml(invoice.invoiceNumber)}</div>
            <div><strong>Invoice date</strong> ${escapeHtml(invoice.issueDate)}</div>
            <div><strong>Order date</strong> ${escapeHtml(invoice.orderDate)}</div>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
        <tr>
          <td style="vertical-align:top;width:50%;padding-right:12px;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;margin-bottom:4px;">From</div>
            <div style="font-weight:600;">${escapeHtml(invoice.sellerName)}</div>
            <div>${escapeHtml(invoice.sellerTradingName)}</div>
            <div>${sellerAddress}</div>
            <div>ABN ${escapeHtml(invoice.sellerAbnFormatted || "not set")}</div>
            <div>${escapeHtml(invoice.sellerEmail)}</div>
            <div>${escapeHtml(invoice.sellerPhone)}</div>
          </td>
          <td style="vertical-align:top;width:50%;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;margin-bottom:4px;">Bill to</div>
            <div style="font-weight:600;">${escapeHtml(invoice.billToName)}</div>
            <div>${escapeHtml(invoice.billToEmail)}</div>
            ${billToAddress ? `<div>${billToAddress}</div>` : ""}
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 12px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;background:#f3f4f6;border-bottom:1px solid #d1d5db;">Description</th>
            <th style="text-align:right;padding:8px;background:#f3f4f6;border-bottom:1px solid #d1d5db;">Qty</th>
            <th style="text-align:right;padding:8px;background:#f3f4f6;border-bottom:1px solid #d1d5db;">Unit price</th>
            <th style="text-align:right;padding:8px;background:#f3f4f6;border-bottom:1px solid #d1d5db;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineRows}
          ${moneyRow("Subtotal", invoice.totals.subtotalAud)}
          ${invoice.totals.discountAud > 0 ? moneyRow("Discount", -invoice.totals.discountAud) : ""}
          ${moneyRow("Shipping", invoice.totals.shippingAud)}
          ${moneyRow("GST", invoice.totals.gstAud)}
          ${moneyRow("Total", invoice.totals.totalAud, true)}
          ${moneyRow("Amount paid", invoice.totals.amountPaidAud)}
          ${moneyRow("Amount owing", invoice.totals.amountOwingAud, true)}
        </tbody>
      </table>
      <div style="padding:10px 12px;${owingStyle}">
        <strong>${escapeHtml(owingNote)}:</strong> ${escapeHtml(formatAUD(invoice.totals.amountOwingAud))}
        <span style="margin-left:8px;">Payment: ${escapeHtml(invoice.paymentMethod)}</span>
      </div>
      <p style="margin:12px 0 0;font-size:12px;color:#6b7280;">
        All amounts are Australian dollars. The supplier is not registered for GST, so GST is $0.00 and this document is an invoice (not a tax invoice).
      </p>
    </div>
  `;
};

export const sampleInvoiceDocumentHtml = (): string => {
  const invoice = buildInvoice(
    {
      order_number: "GEO-0042",
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
      square_payment_id: "sqtxn_sample",
      created_at: "2026-09-12T00:00:00.000Z",
    },
    [
      {
        title: "Isaac Rock No. 3",
        variant_label: "A3 · Tier 1",
        quantity: 1,
        unit_price_aud: 45000,
        edition_number_assigned: 2,
        edition_size: 25,
      },
    ],
    { issueDate: new Date("2026-09-12T00:00:00.000Z"), abnDigits: getInvoiceAbnDigits() ?? "00000000000" },
  );
  return renderInvoiceDocumentHtml(invoice);
};

export const invoiceEmailAllowed = (order: {
  customer_email: string;
  notes?: string | null;
}): { ok: true } | { ok: false; error: string } => {
  if (isStudioOrderNotes(order.notes)) {
    return { ok: false, error: "Studio orders do not receive customer invoices." };
  }
  if (!order.customer_email?.trim()) {
    return { ok: false, error: "This order has no customer email." };
  }
  if (isPlaceholderCustomerEmail(order.customer_email)) {
    return { ok: false, error: "Placeholder customers have no email to send an invoice to." };
  }
  if (!getInvoiceAbnDigits()) {
    return { ok: false, error: "Set INVOICE_ABN (11 digits) before sending invoices." };
  }
  return { ok: true };
};
