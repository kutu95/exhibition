import { Resend } from "resend";

import { firstNameFrom } from "./merge";
import { renderEmailTemplate } from "./templates";

type SendFulfilmentNotificationInput = {
  customer_email: string;
  customer_name: string | null;
  order_number: string;
  photo_title: string;
  variant_label: string;
  edition_number_assigned: number | null;
  tracking_number: string;
};

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL;
const CONTACT_EMAIL = "hello@margies.app";

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const sendFulfilmentNotificationEmail = async ({
  customer_email,
  customer_name,
  order_number,
  photo_title,
  variant_label,
  edition_number_assigned,
  tracking_number,
}: SendFulfilmentNotificationInput): Promise<void> => {
  if (!resend || !fromEmail) {
    console.error("Resend is not configured. Missing RESEND_API_KEY or RESEND_FROM_EMAIL.");
    return;
  }

  const firstName = firstNameFrom(customer_name);
  const edition = edition_number_assigned ? `Edition ${edition_number_assigned}` : "Your edition";
  let subject = `Your print has shipped — [${order_number}]`;
  let html: string | null = null;

  try {
    const rendered = await renderEmailTemplate({
      slug: "order_shipped",
      mergeVars: {
        customer_name: customer_name?.trim() || "",
        first_name: firstName || "there",
        order_number,
        photo_title,
        variant_label,
        edition_line: edition,
        tracking_number,
        contact_email: CONTACT_EMAIL,
      },
      shipment: {
        order_number,
        photo_title,
        variant_label,
        edition_line: edition,
        tracking_number,
      },
      recipientFirstName: firstName || null,
    });
    if (rendered) {
      subject = rendered.subject;
      html = rendered.html;
    }
  } catch (error) {
    console.error("Shipped email template render failed; using fallback.", error);
  }

  if (!html) {
    const greeting = customer_name ? `Hi ${customer_name},` : "Hi,";
    html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <p style="margin-top: 0;">${greeting}</p>
      <p>Your print from The Georgette 150th has shipped.</p>
      <div style="margin: 20px 0; padding: 14px; border: 1px solid #d1d5db;">
        <p style="margin: 0 0 10px;"><strong>${order_number}</strong></p>
        <p style="margin: 0;"><strong>${photo_title}</strong></p>
        <p style="margin: 4px 0; color: #4b5563;">${variant_label}</p>
        <p style="margin: 4px 0; color: #6b7280;">${edition}</p>
        <p style="margin: 12px 0 0;"><strong>Tracking number:</strong> ${tracking_number}</p>
      </div>
      <p>Your print is shipping from Sydney. Please allow 3-7 business days for delivery within WA.</p>
      <p>If you have any questions, reply to this email or contact us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> with your order number.</p>
      <p style="margin-top: 24px; color: #4b5563;">The Georgette 150th · John Bowskill · exhibition.margies.app</p>
    </div>
  `;
  }

  await resend.emails.send({
    from: fromEmail,
    to: customer_email,
    subject,
    html,
  });
};
