import { Resend } from "resend";

import { campaignBlocksSchema } from "../campaigns/blocks";
import { prepareCampaignBlocksForEmail } from "../campaigns/email-image";
import { renderCampaignEmailHtml } from "../campaigns/render";
import { siteContact } from "../contact";
import { siteConfig } from "../metadata";
import { supabaseAdmin } from "../supabase/admin";
import type { EmailCampaign } from "../supabase/types";
import {
  TALK_CONFIRMATION_CAMPAIGN_NAME,
  TALK_TITLE,
  TALK_WHEN_LABEL,
} from "../talk-details";
import { firstNameFrom } from "./merge";
import { renderEmailTemplate } from "./templates";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export type SendTalkConfirmationInput = {
  email: string;
  name: string;
  partySize: number;
};

const partyLabel = (partySize: number): string =>
  partySize === 1 ? "1 seat" : `${partySize} seats`;

const talkMergeVars = (input: SendTalkConfirmationInput) => ({
  name: input.name.trim(),
  first_name: firstNameFrom(input.name),
  party_label: partyLabel(input.partySize),
  talk_title: TALK_TITLE,
  talk_when: TALK_WHEN_LABEL,
  talk_location: siteConfig.exhibition.location,
  contact_email: siteContact.email,
});

const parseBlocks = (value: unknown) => {
  const parsed = campaignBlocksSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
};

const loadTalkCampaign = async (): Promise<EmailCampaign | null> => {
  const { data, error } = await supabaseAdmin
    .from("email_campaigns")
    .select("*")
    .ilike("name", TALK_CONFIRMATION_CAMPAIGN_NAME)
    .neq("status", "cancelled")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Talk confirmation campaign lookup failed", error);
    return null;
  }

  return (data as EmailCampaign | null) ?? null;
};

const fallbackTalkHtml = (input: SendTalkConfirmationInput): string => {
  const firstName = firstNameFrom(input.name) || "there";
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #111827; line-height: 1.5;">
      <p style="margin-top:0;">Dear ${firstName},</p>
      <p>Your place is confirmed for ${TALK_TITLE}. I've reserved ${partyLabel(input.partySize)} for you.</p>
      <p>${TALK_WHEN_LABEL}<br />${siteConfig.exhibition.location}</p>
      <p>Please arrive a few minutes early so we can start on time. If you can no longer come, reply to this email so we can offer the seat to someone on the wait list.</p>
      <p>If you have any questions, contact us at <a href="mailto:${siteContact.email}">${siteContact.email}</a>.</p>
      <p>John Bowskill</p>
      <p style="margin-top:24px;color:#4b5563;">The Georgette 150th · exhibition.margies.app</p>
    </div>
  `;
};

export const sendTalkConfirmationEmail = async (input: SendTalkConfirmationInput): Promise<void> => {
  if (!resend || !fromEmail) {
    console.error("Resend is not configured. Missing RESEND_API_KEY or RESEND_FROM_EMAIL.");
    return;
  }

  const vars = talkMergeVars(input);
  let subject = "You're registered for the Georgette author talk";
  let html: string | null = null;

  try {
    const rendered = await renderEmailTemplate({
      slug: "talk_confirmation",
      mergeVars: vars,
      recipientFirstName: vars.first_name || null,
    });
    if (rendered) {
      subject = rendered.subject;
      html = rendered.html;
    }
  } catch (error) {
    console.warn("Talk confirmation template unavailable; trying named campaign.", error);
  }

  if (!html) {
    try {
      const campaign = await loadTalkCampaign();
      const blocks = campaign ? parseBlocks(campaign.blocks) : [];
      if (campaign && campaign.subject.trim() && blocks.length > 0) {
        const emailBlocks = await prepareCampaignBlocksForEmail(blocks);
        html = await renderCampaignEmailHtml({
          subject: campaign.subject,
          previewText: campaign.preview_text,
          blocks: emailBlocks,
          unsubscribeUrl: null,
          recipientFirstName: vars.first_name || null,
          skipImagePrepare: true,
          autoGreeting: false,
          mergeVars: vars,
        });
        subject = campaign.subject;
      }
    } catch (error) {
      console.error("Talk confirmation campaign render failed; using fallback.", error);
    }
  }

  if (!html) {
    html = fallbackTalkHtml(input);
  }

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: input.email,
      subject,
      html,
    });
    if (result.error) {
      console.error("Talk confirmation email failed", result.error);
    }
  } catch (error) {
    console.error("Talk confirmation email failed", error);
  }
};
