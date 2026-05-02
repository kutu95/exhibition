import { Resend } from "resend";

import type { Order } from "../supabase/types";
import { formatAUD } from "../utils/currency";

type OrderEmailItem = {
  title: string;
  variant_label: string;
  quantity: number;
  unit_price_aud: number;
  edition_number_assigned: number | null;
  edition_size: number | null;
};

type SendOrderConfirmationInput = {
  order: Order;
  items: OrderEmailItem[];
};

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL;

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const sendOrderConfirmationEmail = async ({
  order,
  items,
}: SendOrderConfirmationInput): Promise<void> => {
  if (!resend || !fromEmail) {
    console.error("Resend is not configured. Missing RESEND_API_KEY or RESEND_FROM_EMAIL.");
    return;
  }

  const itemsHtml = items
    .map((item) => {
      const editionText =
        item.edition_size && item.edition_number_assigned
          ? `Edition ${item.edition_number_assigned} of ${item.edition_size}`
          : item.edition_size
            ? `Limited edition of ${item.edition_size}`
            : "Open edition";

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

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <p style="margin-top: 0;">Thank you for your order from The Georgette 150th.</p>

      <div style="margin: 20px 0; padding: 14px; border: 1px solid #d1d5db;">
        <p style="margin: 0 0 10px;"><strong>${order.order_number}</strong></p>
        <ul style="margin: 0; padding-left: 18px;">
          ${itemsHtml}
        </ul>
        <p style="font-size: 16px; margin: 14px 0 0;"><strong>Total:</strong> ${formatAUD(order.total_aud)}</p>
      </div>

      <p>All prints are made to order on archival paper and signed and numbered by John Bowskill. Please allow 3-4 business days for production and despatch. You will receive a second email when your order has been shipped.</p>
      <p>If you have any questions, reply to this email or contact us at <a href="mailto:hello@margies.app">hello@margies.app</a> with your order number.</p>
      <p>The Georgette 150th is showing at Margaret River Region Open Studios from 12 to 27 September 2026. If you are visiting in person, prints purchased online can be collected at the exhibition — contact us to arrange this.</p>
      <p style="margin-top: 24px; color: #4b5563;">The Georgette 150th · John Bowskill · exhibition.margies.app</p>
    </div>
  `;

  await resend.emails.send({
    from: fromEmail,
    to: order.customer_email,
    subject: `Your order from The Georgette 150th — [${order.order_number}]`,
    html,
  });
};
