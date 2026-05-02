import { Resend } from "resend";

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

  const greeting = customer_name ? `Hi ${customer_name},` : "Hi,";
  const editionText = edition_number_assigned
    ? `Edition ${edition_number_assigned}`
    : "Your edition";

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <p style="margin-top: 0;">${greeting}</p>
      <p>Your print from The Georgette 150th has shipped.</p>

      <div style="margin: 20px 0; padding: 14px; border: 1px solid #d1d5db;">
        <p style="margin: 0 0 10px;"><strong>${order_number}</strong></p>
        <p style="margin: 0;"><strong>${photo_title}</strong></p>
        <p style="margin: 4px 0; color: #4b5563;">${variant_label}</p>
        <p style="margin: 4px 0; color: #6b7280;">${editionText}</p>
        <p style="margin: 12px 0 0;"><strong>Tracking number:</strong> ${tracking_number}</p>
      </div>

      <p>Your print is shipping from Sydney. Please allow 3-7 business days for delivery within WA.</p>
      <p>If you have any questions, reply to this email or contact us at <a href="mailto:hello@margies.app">hello@margies.app</a> with your order number.</p>
      <p style="margin-top: 24px; color: #4b5563;">The Georgette 150th · John Bowskill · exhibition.margies.app</p>
    </div>
  `;

  await resend.emails.send({
    from: fromEmail,
    to: customer_email,
    subject: `Your print has shipped — [${order_number}]`,
    html,
  });
};
