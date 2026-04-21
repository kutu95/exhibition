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
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            <div style="font-weight: 600;">${item.title}</div>
            <div style="color: #4b5563; font-size: 14px;">${item.variant_label}</div>
            <div style="color: #6b7280; font-size: 13px;">${editionText}</div>
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">x${item.quantity}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatAUD(item.unit_price_aud)}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h2 style="margin-bottom: 8px;">Order confirmation: ${order.order_number}</h2>
      <p style="margin-top: 0;">Thank you for your purchase from ${process.env.NEXT_PUBLIC_EXHIBITION_NAME ?? "SS Georgette Exhibition"}.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr>
            <th style="text-align: left; border-bottom: 2px solid #d1d5db; padding: 8px 0;">Item</th>
            <th style="text-align: right; border-bottom: 2px solid #d1d5db; padding: 8px 0;">Qty</th>
            <th style="text-align: right; border-bottom: 2px solid #d1d5db; padding: 8px 0;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <p style="font-size: 16px; margin: 12px 0;"><strong>Total paid:</strong> ${formatAUD(order.total_aud)}</p>

      <p>Fine art prints are made to order. Please allow time for printing, finishing, and despatch.</p>
      <p>For enquiries, reply to this email or contact <a href="mailto:${fromEmail}">${fromEmail}</a>.</p>
      <p style="margin-top: 24px; color: #4b5563;">
        Exhibition details:<br />
        12-27 September 2026<br />
        Margaret River Region Open Studios, Western Australia
      </p>
    </div>
  `;

  await resend.emails.send({
    from: fromEmail,
    to: order.customer_email,
    subject: `Your order ${order.order_number} is confirmed`,
    html,
  });
};
