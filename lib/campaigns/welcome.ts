import { renderEmailTemplate } from "../emails/templates";
import {
  isCampaignEmailConfigured,
  sendCampaignEmail,
} from "../emails/campaign";
import { supabaseAdmin } from "../supabase/admin";
import type { EmailCampaign } from "../supabase/types";
import { prepareCampaignBlocksForEmail } from "./email-image";
import { renderCampaignEmailHtml } from "./render";
import { parseCampaignBlocks } from "./send";
import { buildUnsubscribeUrl } from "./unsubscribe";
import { WELCOME_CAMPAIGN_NAME } from "./welcome-shared";

export { WELCOME_CAMPAIGN_NAME } from "./welcome-shared";

export type SendWelcomeEmailInput = {
  subscriberId: string;
  email: string;
  firstName?: string | null;
};

const loadWelcomeCampaign = async (): Promise<EmailCampaign | null> => {
  const { data, error } = await supabaseAdmin
    .from("email_campaigns")
    .select("*")
    .ilike("name", WELCOME_CAMPAIGN_NAME)
    .neq("status", "cancelled")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Welcome campaign lookup failed", error);
    return null;
  }

  return (data as EmailCampaign | null) ?? null;
};

/**
 * Sends the "New Subscriber" campaign to one person.
 * Does not change campaign status (evergreen template).
 * Skips if already sent to this email for that campaign.
 */
export const sendWelcomeEmailIfConfigured = async (
  input: SendWelcomeEmailInput,
): Promise<void> => {
  if (!isCampaignEmailConfigured()) {
    return;
  }

  try {
    const unsubscribeUrl = await buildUnsubscribeUrl({
      subscriberId: input.subscriberId,
      email: input.email.trim(),
    });
    const fromTemplate = await renderEmailTemplate({
      slug: "new_subscriber",
      mergeVars: {
        first_name: input.firstName?.trim().split(/\s+/)[0] || "",
        customer_name: input.firstName?.trim() || "",
      },
      unsubscribeUrl,
      recipientFirstName: input.firstName?.trim() || null,
    });
    if (fromTemplate) {
      const campaign = await loadWelcomeCampaign();
      const email = input.email.trim().toLowerCase();
      if (campaign) {
        const { data: existingSend } = await supabaseAdmin
          .from("email_campaign_sends")
          .select("id, status")
          .eq("campaign_id", campaign.id)
          .eq("email", email)
          .maybeSingle();
        if (existingSend?.status === "sent") {
          return;
        }
      }

      const result = await sendCampaignEmail({
        to: input.email.trim(),
        subject: fromTemplate.subject,
        html: fromTemplate.html,
        previewText: fromTemplate.previewText,
        unsubscribeUrl,
      });
      if (result.sent && campaign) {
        await supabaseAdmin.from("email_campaign_sends").upsert(
          {
            campaign_id: campaign.id,
            subscriber_id: input.subscriberId,
            email,
            resend_id: result.resendId,
            status: "sent",
            error: null,
            sent_at: new Date().toISOString(),
          },
          { onConflict: "campaign_id,email" },
        );
      } else if (!result.sent) {
        console.error("Welcome email (template) failed", result.error);
      }
      return;
    }
  } catch (error) {
    console.warn("Welcome template unavailable; falling back to named campaign.", error);
  }

  const campaign = await loadWelcomeCampaign();
  if (!campaign) {
    console.warn(
      `Welcome email skipped: no campaign named "${WELCOME_CAMPAIGN_NAME}" found.`,
    );
    return;
  }

  const subject = campaign.subject.trim();
  const blocks = parseCampaignBlocks(campaign.blocks);
  if (!subject || blocks.length === 0) {
    console.warn(
      `Welcome email skipped: campaign "${WELCOME_CAMPAIGN_NAME}" needs a subject and content blocks.`,
    );
    return;
  }

  const email = input.email.trim().toLowerCase();
  const { data: existingSend, error: existingError } = await supabaseAdmin
    .from("email_campaign_sends")
    .select("id, status")
    .eq("campaign_id", campaign.id)
    .eq("email", email)
    .maybeSingle();

  if (existingError) {
    console.error("Welcome send lookup failed", existingError);
    return;
  }

  if (existingSend?.status === "sent") {
    return;
  }

  try {
    const unsubscribeUrl = await buildUnsubscribeUrl({
      subscriberId: input.subscriberId,
      email: input.email.trim(),
    });
    const emailBlocks = await prepareCampaignBlocksForEmail(blocks);
    const html = await renderCampaignEmailHtml({
      subject,
      previewText: campaign.preview_text,
      blocks: emailBlocks,
      unsubscribeUrl,
      recipientFirstName: input.firstName?.trim() || null,
      skipImagePrepare: true,
    });

    const result = await sendCampaignEmail({
      to: input.email.trim(),
      subject,
      html,
      previewText: campaign.preview_text,
      unsubscribeUrl,
    });

    if (result.sent) {
      await supabaseAdmin.from("email_campaign_sends").upsert(
        {
          campaign_id: campaign.id,
          subscriber_id: input.subscriberId,
          email,
          resend_id: result.resendId,
          status: "sent",
          error: null,
          sent_at: new Date().toISOString(),
        },
        { onConflict: "campaign_id,email" },
      );
      return;
    }

    await supabaseAdmin.from("email_campaign_sends").upsert(
      {
        campaign_id: campaign.id,
        subscriber_id: input.subscriberId,
        email,
        resend_id: null,
        status: "failed",
        error: result.error,
        sent_at: null,
      },
      { onConflict: "campaign_id,email" },
    );
    console.error("Welcome email failed", result.error);
  } catch (error) {
    console.error("Welcome email failed", error);
  }
};
