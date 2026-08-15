import { Resend } from "resend";

import type { Order } from "../supabase/types";
import { formatAUD } from "../utils/currency";
import {
  editionLine,
  firstNameFrom,
  type OrderEmailLine,
} from "./merge";
import { renderEmailTemplate } from "./templates";

type SendOrderConfirmationInput = {
  order: Order;
  items: OrderEmailLine[];
};

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL;
const CONTACT_EMAIL = "hello@margies.app";

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const sendOrderConfirmationEmail = async ({
  order,
  items,
}: SendOrderConfirmationInput): Promise<void> => {
  if (!resend || !fromEmail) {
    console.error("Resend is not configured. Missing RESEND_API_KEY or RESEND_FROM_EMAIL.");
    return;
  }

  const firstName = firstNameFrom(order.customer_name);
  let subject = `Your order from The Georgette 150th — [${order.order_number}]`;
  let html: string | null = null;

  try {
    const rendered = await renderEmailTemplate({
      slug: "order_confirmation",
      mergeVars: {
        customer_name: order.customer_name?.trim() || "",
        first_name: firstName,
        order_number: order.order_number,
        total: formatAUD(order.total_aud),
        contact_email: CONTACT_EMAIL,
      },
      items,
      totalAud: order.total_aud,
      recipientFirstName: firstName || null,
    });
    if (rendered) {
      subject = rendered.subject;
      html = rendered.html;
    }
  } catch (error) {
    console.error("Order confirmation template render failed; using fallback.", error);
  }

  if (!html) {
    html = fallbackOrderHtml(order, items);
  }

  await resend.emails.send({
    from: fromEmail,
    to: order.customer_email,
    subject,
    html,
  });
};

const fallbackOrderHtml = (order: Order, items: OrderEmailLine[]): string => {
  const itemsHtml = items
    .map((item) => {
      const editionText = editionLine(item.edition_number_assigned, item.edition_size);
      return `
        <li style="margin: 0 0 12px;">
          <div style="font-weight: 600;">${item.title}</div>
          <div style="color: #4b5563; font-size: 14px;">${item.variant_label}</div>
          <div style="color: #6b7280; font-size: 13px;">${editionText}</div>
          <div style="font-size: 14px;">${formatAUD(item.unit_price_aud)} × ${item.quantity}</div>
        </li>
      `;
    })
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <p style="margin-top: 0;">Thank you for your order from The Georgette 150th.</p>
      <div style="margin: 20px 0; padding: 14px; border: 1px solid #d1d5db;">
        <p style="margin: 0 0 10px;"><strong>${order.order_number}</strong></p>
        <ul style="margin: 0; padding-left: 18px;">${itemsHtml}</ul>
        <p style="font-size: 16px; margin: 14px 0 0;"><strong>Total:</strong> ${formatAUD(order.total_aud)}</p>
      </div>
      <p>All prints are made to order on archival paper and signed and numbered by John Bowskill. Please allow 3-4 business days for production and despatch. You will receive a second email when your order has been shipped.</p>
      <p>If you have any questions, reply to this email or contact us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> with your order number.</p>
      <p>The Georgette 150th is showing at Margaret River Region Open Studios from 12 to 27 September 2026. If you are visiting in person, prints purchased online can be collected at the exhibition — contact us to arrange this.</p>
      <p style="margin-top: 24px; color: #4b5563;">The Georgette 150th · John Bowskill · exhibition.margies.app</p>
    </div>
  `;
};
