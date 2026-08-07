import { Resend } from "resend";

import { siteConfig } from "../metadata";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL;
const alertEmail =
  process.env.REGISTRATION_ALERT_EMAIL?.trim() || "john@streamtime.com.au";

const resend = resendApiKey ? new Resend(resendApiKey) : null;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const row = (label: string, value: string): string =>
  `<p style="margin:0 0 8px;"><strong>${escapeHtml(label)}:</strong> ${value}</p>`;

export type SubscriberAlertInput = {
  email: string;
  firstName?: string | null;
  source?: string | null;
  reactivated?: boolean;
};

export type TalkRegistrationAlertInput = {
  email: string;
  name: string;
  partySize: number;
  list: "confirmed" | "waitlist";
  source?: string | null;
};

const sendAlert = async (subject: string, bodyHtml: string): Promise<void> => {
  if (!resend || !fromEmail) {
    console.error("Resend is not configured. Missing RESEND_API_KEY or RESEND_FROM_EMAIL.");
    return;
  }

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: alertEmail,
      subject,
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; color: #111827; line-height: 1.5;">
          ${bodyHtml}
          <p style="margin:24px 0 0;color:#4b5563;">The Georgette 150th · exhibition.margies.app</p>
        </div>
      `,
    });
    if (result.error) {
      console.error("Registration alert email failed", result.error);
    }
  } catch (error) {
    console.error("Registration alert email failed", error);
  }
};

export const sendSubscriberAlertEmail = async (input: SubscriberAlertInput): Promise<void> => {
  const adminUrl = `${siteConfig.url.replace(/\/$/, "")}/admin/subscribers`;
  const kind = input.reactivated ? "re-subscribed" : "new subscriber";
  await sendAlert(
    `[Georgette] ${kind}: ${input.email}`,
    `
      <p style="margin-top:0;">Someone ${input.reactivated ? "re-subscribed to" : "subscribed to"} exhibition updates.</p>
      <div style="margin:16px 0;padding:14px;border:1px solid #d1d5db;">
        ${row("Email", escapeHtml(input.email))}
        ${row("Name", escapeHtml(input.firstName?.trim() || "—"))}
        ${row("Source", escapeHtml(input.source?.trim() || "—"))}
      </div>
      <p style="margin:0;"><a href="${escapeHtml(adminUrl)}">View subscribers</a></p>
    `,
  );
};

export const sendTalkRegistrationAlertEmail = async (
  input: TalkRegistrationAlertInput,
): Promise<void> => {
  const adminUrl = `${siteConfig.url.replace(/\/$/, "")}/admin/talk-registrations`;
  const listLabel = input.list === "waitlist" ? "wait list" : "confirmed";
  await sendAlert(
    `[Georgette] talk ${listLabel}: ${input.name}`,
    `
      <p style="margin-top:0;">Someone registered for the author talk (${listLabel}).</p>
      <div style="margin:16px 0;padding:14px;border:1px solid #d1d5db;">
        ${row("Name", escapeHtml(input.name))}
        ${row("Email", escapeHtml(input.email))}
        ${row("Party size", String(input.partySize))}
        ${row("List", escapeHtml(listLabel))}
        ${row("Source", escapeHtml(input.source?.trim() || "—"))}
      </div>
      <p style="margin:0;"><a href="${escapeHtml(adminUrl)}">View talk registrations</a></p>
    `,
  );
};
