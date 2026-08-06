import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export type SendCampaignEmailInput = {
  to: string;
  subject: string;
  html: string;
  previewText?: string | null;
  unsubscribeUrl: string;
};

export type SendCampaignEmailResult =
  | { sent: true; resendId: string | null }
  | { sent: false; error: string };

export const isCampaignEmailConfigured = (): boolean => Boolean(resend && fromEmail);

export const sendCampaignEmail = async (
  input: SendCampaignEmailInput,
): Promise<SendCampaignEmailResult> => {
  if (!resend || !fromEmail) {
    console.error("Resend is not configured. Missing RESEND_API_KEY or RESEND_FROM_EMAIL.");
    return { sent: false, error: "Email is not configured." };
  }

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: input.to,
      subject: input.subject,
      html: input.html,
      headers: {
        "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      ...(input.previewText?.trim()
        ? { text: undefined } // html-only; preview is in hidden preheader
        : {}),
    });

    if (result.error) {
      return { sent: false, error: result.error.message };
    }

    return { sent: true, resendId: result.data?.id ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email.";
    console.error("Campaign email failed", error);
    return { sent: false, error: message };
  }
};
