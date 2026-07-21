import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

type SendVaultAccessEmailInput = {
  to: string;
  name: string;
  accessUrl: string;
};

export const sendVaultAccessEmail = async ({
  to,
  name,
  accessUrl,
}: SendVaultAccessEmailInput): Promise<{ sent: boolean; error?: string }> => {
  if (!resend || !fromEmail) {
    console.error("Resend is not configured. Missing RESEND_API_KEY or RESEND_FROM_EMAIL.");
    return { sent: false, error: "Email is not configured." };
  }

  const firstName = name.trim().split(/\s+/)[0] || "there";

  try {
    await resend.emails.send({
      from: fromEmail,
      to,
      subject: "Access to further collections — The Georgette 150th",
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
          <p style="margin-top: 0;">Dear ${firstName},</p>
          <p>
            Thank you for your interest in John Bowskill’s work for The Georgette 150th.
            You now have access to further collections that are not shown in the public gallery.
          </p>
          <p>
            <a href="${accessUrl}" style="display: inline-block; padding: 12px 18px; background: #0a1628; color: #f5f0e8; text-decoration: none;">
              Open the private collections
            </a>
          </p>
          <p style="color: #4b5563; font-size: 14px;">
            This link is personal. It unlocks the private collections in your browser.
            If the button does not work, copy and paste this address:<br />
            <span style="word-break: break-all;">${accessUrl}</span>
          </p>
          <p style="margin-top: 24px; color: #4b5563;">The Georgette 150th · John Bowskill · exhibition.margies.app</p>
        </div>
      `,
    });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email.";
    console.error("Vault access email failed", error);
    return { sent: false, error: message };
  }
};
