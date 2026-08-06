import { campaignBlocksSchema, type CampaignBlock } from "./blocks";
import { renderCampaignEmailHtml } from "./render";
import { buildUnsubscribeUrl } from "./unsubscribe";
import { sendCampaignEmail, isCampaignEmailConfigured } from "../emails/campaign";
import { supabaseAdmin } from "../supabase/admin";
import type { EmailCampaign, EmailSubscriber } from "../supabase/types";

const SEND_PAUSE_MS = 80;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const parseCampaignBlocks = (value: unknown): CampaignBlock[] => {
  const parsed = campaignBlocksSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
};

export const listActiveSubscribers = async (): Promise<EmailSubscriber[]> => {
  const { data, error } = await supabaseAdmin
    .from("email_subscribers")
    .select("*")
    .is("unsubscribed_at", null)
    .order("subscribed_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as EmailSubscriber[];
};

export const loadCampaign = async (id: string): Promise<EmailCampaign | null> => {
  const { data, error } = await supabaseAdmin
    .from("email_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as EmailCampaign | null) ?? null;
};

export type DispatchCampaignOptions = {
  campaignId: string;
  /** When set, send only to this address (test). Does not mark campaign sent. */
  testTo?: string;
  testFirstName?: string | null;
};

export type DispatchCampaignResult = {
  ok: boolean;
  sent: number;
  failed: number;
  audience: number;
  error?: string;
};

export const dispatchCampaign = async (
  options: DispatchCampaignOptions,
): Promise<DispatchCampaignResult> => {
  if (!isCampaignEmailConfigured()) {
    return { ok: false, sent: 0, failed: 0, audience: 0, error: "Email is not configured." };
  }

  const campaign = await loadCampaign(options.campaignId);
  if (!campaign) {
    return { ok: false, sent: 0, failed: 0, audience: 0, error: "Campaign not found." };
  }

  const subject = campaign.subject.trim();
  if (!subject) {
    return { ok: false, sent: 0, failed: 0, audience: 0, error: "Campaign subject is required." };
  }

  const blocks = parseCampaignBlocks(campaign.blocks);
  if (blocks.length === 0) {
    return { ok: false, sent: 0, failed: 0, audience: 0, error: "Add at least one content block." };
  }

  if (options.testTo) {
    const unsubscribeUrl = await buildUnsubscribeUrl({
      subscriberId: "00000000-0000-4000-8000-000000000000",
      email: options.testTo,
    });
    const html = renderCampaignEmailHtml({
      subject,
      previewText: campaign.preview_text,
      blocks,
      unsubscribeUrl,
      recipientFirstName: options.testFirstName ?? "there",
    });
    const result = await sendCampaignEmail({
      to: options.testTo,
      subject: `[Test] ${subject}`,
      html,
      previewText: campaign.preview_text,
      unsubscribeUrl,
    });
    if (!result.sent) {
      return { ok: false, sent: 0, failed: 1, audience: 1, error: result.error };
    }
    return { ok: true, sent: 1, failed: 0, audience: 1 };
  }

  if (campaign.status === "sending") {
    return { ok: false, sent: 0, failed: 0, audience: 0, error: "Campaign is already sending." };
  }
  if (campaign.status === "sent") {
    return { ok: false, sent: 0, failed: 0, audience: 0, error: "Campaign was already sent." };
  }

  const subscribers = await listActiveSubscribers();
  const now = new Date().toISOString();

  const { error: lockError } = await supabaseAdmin
    .from("email_campaigns")
    .update({
      status: "sending",
      audience_count: subscribers.length,
      last_error: null,
      updated_at: now,
    })
    .eq("id", campaign.id)
    .in("status", ["draft", "scheduled", "failed"]);

  if (lockError) {
    return { ok: false, sent: 0, failed: 0, audience: subscribers.length, error: lockError.message };
  }

  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;

  for (const subscriber of subscribers) {
    const unsubscribeUrl = await buildUnsubscribeUrl({
      subscriberId: subscriber.id,
      email: subscriber.email,
    });
    const html = renderCampaignEmailHtml({
      subject,
      previewText: campaign.preview_text,
      blocks,
      unsubscribeUrl,
      recipientFirstName: subscriber.first_name,
    });

    const result = await sendCampaignEmail({
      to: subscriber.email,
      subject,
      html,
      previewText: campaign.preview_text,
      unsubscribeUrl,
    });

    if (result.sent) {
      sent += 1;
      await supabaseAdmin.from("email_campaign_sends").upsert(
        {
          campaign_id: campaign.id,
          subscriber_id: subscriber.id,
          email: subscriber.email,
          resend_id: result.resendId,
          status: "sent",
          error: null,
          sent_at: new Date().toISOString(),
        },
        { onConflict: "campaign_id,email" },
      );
    } else {
      failed += 1;
      lastError = result.error;
      await supabaseAdmin.from("email_campaign_sends").upsert(
        {
          campaign_id: campaign.id,
          subscriber_id: subscriber.id,
          email: subscriber.email,
          resend_id: null,
          status: "failed",
          error: result.error,
          sent_at: null,
        },
        { onConflict: "campaign_id,email" },
      );
    }

    await sleep(SEND_PAUSE_MS);
  }

  const finalStatus = sent > 0 ? "sent" : "failed";
  await supabaseAdmin
    .from("email_campaigns")
    .update({
      status: finalStatus,
      sent_count: sent,
      failed_count: failed,
      audience_count: subscribers.length,
      sent_at: sent > 0 ? new Date().toISOString() : null,
      last_error: lastError,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaign.id);

  return {
    ok: sent > 0,
    sent,
    failed,
    audience: subscribers.length,
    error: sent > 0 ? undefined : lastError || "No emails were sent.",
  };
};

export const processDueScheduledCampaigns = async (): Promise<{
  processed: number;
  results: Array<{ id: string; ok: boolean; error?: string }>;
}> => {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("email_campaigns")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(5);

  if (error) {
    throw new Error(error.message);
  }

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const row of data ?? []) {
    const outcome = await dispatchCampaign({ campaignId: row.id });
    results.push({ id: row.id, ok: outcome.ok, error: outcome.error });
  }

  return { processed: results.length, results };
};
