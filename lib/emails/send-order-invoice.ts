import { Resend } from "resend";

import { invoiceSeller } from "../contact";
import {
  buildInvoice,
  invoiceEmailAllowed,
  renderInvoiceDocumentHtml,
  type InvoiceLineInput,
} from "../invoice";
import { firstNameFrom } from "./merge";
import { formatAUD } from "../utils/currency";
import { supabaseAdmin } from "../supabase/admin";
import { renderEmailTemplate } from "./templates";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export type SendOrderInvoiceResult =
  | { sent: true; to: string; invoiceNumber: string }
  | { sent: false; error: string };

type ProductJoin =
  | { title: string | null }
  | Array<{ title: string | null }>
  | null;

type VariantJoin = {
  variant_label: string | null;
  edition_size: number | null;
  products: ProductJoin;
};

type ItemRow = {
  quantity: number;
  unit_price_aud: number;
  edition_number_assigned: number | null;
  frame_colour: string | null;
  product_variants: VariantJoin | VariantJoin[] | null;
};

const productTitle = (products: ProductJoin): string => {
  if (!products) return "Print";
  const row = Array.isArray(products) ? products[0] : products;
  return row?.title?.trim() || "Print";
};

const variantFromJoin = (join: ItemRow["product_variants"]): VariantJoin | null => {
  if (!join) return null;
  return Array.isArray(join) ? join[0] ?? null : join;
};

export const isInvoiceEmailConfigured = (): boolean => Boolean(resend && fromEmail);

export const sendOrderInvoiceEmail = async (orderId: string): Promise<SendOrderInvoiceResult> => {
  if (!resend || !fromEmail) {
    return { sent: false, error: "Email is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL)." };
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select(
      "id, order_number, status, customer_name, customer_email, shipping_address, subtotal_aud, shipping_aud, total_aud, discount_code, discount_percent, discount_amount_aud, notes, stripe_payment_intent_id, stripe_checkout_session_id, square_payment_id, created_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    return { sent: false, error: orderError.message };
  }
  if (!order) {
    return { sent: false, error: "Order not found." };
  }

  const allowed = invoiceEmailAllowed(order);
  if (!allowed.ok) {
    return { sent: false, error: allowed.error };
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from("order_items")
    .select(
      "quantity, unit_price_aud, edition_number_assigned, frame_colour, product_variants(variant_label, edition_size, products(title))",
    )
    .eq("order_id", orderId)
    .order("id", { ascending: true });

  if (itemsError) {
    return { sent: false, error: itemsError.message };
  }

  const lines: InvoiceLineInput[] = ((items ?? []) as ItemRow[]).map((item) => {
    const variant = variantFromJoin(item.product_variants);
    return {
      title: productTitle(variant?.products ?? null),
      variant_label: variant?.variant_label ?? "Print",
      quantity: item.quantity,
      unit_price_aud: item.unit_price_aud,
      edition_number_assigned: item.edition_number_assigned,
      edition_size: variant?.edition_size ?? null,
      frame_colour: item.frame_colour,
    };
  });

  if (lines.length === 0) {
    return { sent: false, error: "This order has no line items to invoice." };
  }

  const invoice = buildInvoice(order, lines);
  const totals = invoice.totals;
  const firstName = firstNameFrom(order.customer_name);
  const invoiceHtml = renderInvoiceDocumentHtml(invoice);

  let subject = `Invoice ${order.order_number} from The Georgette 150th`;
  let html: string | null = null;

  try {
    const rendered = await renderEmailTemplate({
      slug: "order_invoice",
      mergeVars: {
        customer_name: order.customer_name?.trim() || "",
        first_name: firstName,
        order_number: order.order_number,
        total: formatAUD(totals.totalAud),
        amount_paid: formatAUD(totals.amountPaidAud),
        amount_owing: formatAUD(totals.amountOwingAud),
        invoice_date: invoice.issueDate,
        contact_email: invoiceSeller.email,
      },
      invoiceHtml,
      recipientFirstName: firstName || null,
    });
    if (rendered) {
      subject = rendered.subject;
      html = rendered.html;
    }
  } catch (error) {
    console.error("Invoice template render failed; using invoice document only.", error);
  }

  if (!html) {
    html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <p>Hi ${firstName || "there"},</p>
      <p>Here is your invoice for order ${order.order_number}. Amount owing is ${formatAUD(totals.amountOwingAud)}.</p>
      ${invoiceHtml}
    </div>`;
  }

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: order.customer_email,
      subject,
      html,
    });
    if (result.error) {
      return { sent: false, error: result.error.message };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send invoice email.";
    return { sent: false, error: message };
  }

  const { error: stampError } = await supabaseAdmin
    .from("orders")
    .update({ invoice_sent_at: new Date().toISOString() })
    .eq("id", orderId);

  if (stampError) {
    console.warn("Invoice sent but invoice_sent_at could not be saved", stampError);
  }

  return { sent: true, to: order.customer_email, invoiceNumber: order.order_number };
};

export const sendOrderInvoiceEmailQuietly = async (orderId: string): Promise<void> => {
  try {
    const result = await sendOrderInvoiceEmail(orderId);
    if (!result.sent) {
      console.error("Order invoice email not sent", { orderId, error: result.error });
    }
  } catch (error) {
    console.error("Order invoice email failed", { orderId, error });
  }
};
