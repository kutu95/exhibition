import { campaignBlocksSchema, type CampaignBlock } from "./blocks";
import { prepareCampaignBlocksForEmail } from "./email-image";
import { renderCampaignEmailHtml } from "./render";
import { buildUnsubscribeUrl } from "./unsubscribe";
import { sendCampaignEmail, isCampaignEmailConfigured } from "../emails/campaign";
import { supabaseAdmin } from "../supabase/admin";
import type { EmailCampaign, EmailCampaignAudience, EmailSubscriber } from "../supabase/types";

const SEND_PAUSE_MS = 80;
const UNSUBSCRIBE_PLACEHOLDER_ID = "00000000-0000-4000-8000-000000000000";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const CAMPAIGN_AUDIENCES = ["subscribers", "talk_registrations"] as const;

export const isCampaignAudience = (value: unknown): value is EmailCampaignAudience =>
  value === "subscribers" || value === "talk_registrations";

export type CampaignRecipient = {
  email: string;
  firstName: string | null;
  /** Present when the address exists in email_subscribers (for send log + unsubscribe). */
  subscriberId: string | null;
};

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

export const listTalkRegistrationRecipients = async (): Promise<CampaignRecipient[]> => {
  const [{ data, error }, { data: subscribers, error: subscribersError }] = await Promise.all([
    supabaseAdmin
      .from("talk_registrations")
      .select("id, email, name")
      .is("cancelled_at", null)
      .order("created_at", { ascending: true }),
    supabaseAdmin.from("email_subscribers").select("id, email, unsubscribed_at"),
  ]);

  if (error) {
    throw new Error(error.message);
  }
  if (subscribersError) {
    throw new Error(subscribersError.message);
  }

  const unsubscribed = new Set<string>();
  const subscriberIdByEmail = new Map<string, string>();
  for (const row of subscribers ?? []) {
    const key = String(row.email ?? "")
      .trim()
      .toLowerCase();
    if (!key) continue;
    if (row.unsubscribed_at) {
      unsubscribed.add(key);
    } else {
      subscriberIdByEmail.set(key, row.id as string);
    }
  }

  const byEmail = new Map<string, CampaignRecipient>();
  for (const row of data ?? []) {
    const email = String(row.email ?? "").trim();
    const key = email.toLowerCase();
    if (!email || !key || unsubscribed.has(key) || byEmail.has(key)) continue;
    const firstName =
      String(row.name ?? "")
        .trim()
        .split(/\s+/)[0] || null;
    byEmail.set(key, {
      email,
      firstName,
      subscriberId: subscriberIdByEmail.get(key) ?? null,
    });
  }

  return [...byEmail.values()];
};

export const listCampaignRecipients = async (
  audience: EmailCampaignAudience,
): Promise<CampaignRecipient[]> => {
  if (audience === "talk_registrations") {
    return listTalkRegistrationRecipients();
  }

  const subscribers = await listActiveSubscribers();
  return subscribers.map((subscriber) => ({
    email: subscriber.email,
    firstName: subscriber.first_name,
    subscriberId: subscriber.id,
  }));
};

export const countCampaignAudiences = async (): Promise<{
  subscribers: number;
  talk_registrations: number;
}> => {
  const [subscribers, talk] = await Promise.all([
    listActiveSubscribers(),
    listTalkRegistrationRecipients(),
  ]);
  return {
    subscribers: subscribers.length,
    talk_registrations: talk.length,
  };
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
  audience?: EmailCampaignAudience;
  /** When set, send only to this address (test). Does not mark campaign sent. */
  testTo?: string;
  testFirstName?: string | null;
};

export type DispatchCampaignResult = {
  ok: boolean;
  sent: number;
  failed: number;
  audience: number;
  audience_type?: EmailCampaignAudience;
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

  const audienceType: EmailCampaignAudience = options.audience
    ? options.audience
    : isCampaignAudience(campaign.audience)
      ? campaign.audience
      : "subscribers";

  if (options.testTo) {
    const unsubscribeUrl = await buildUnsubscribeUrl({
      subscriberId: UNSUBSCRIBE_PLACEHOLDER_ID,
      email: options.testTo,
    });
    const emailBlocks = await prepareCampaignBlocksForEmail(blocks);
    const html = await renderCampaignEmailHtml({
      subject,
      previewText: campaign.preview_text,
      blocks: emailBlocks,
      unsubscribeUrl,
      recipientFirstName: options.testFirstName?.trim() || null,
      skipImagePrepare: true,
    });
    const result = await sendCampaignEmail({
      to: options.testTo,
      subject: `[Test] ${subject}`,
      html,
      previewText: campaign.preview_text,
      unsubscribeUrl,
    });
    if (!result.sent) {
      return {
        ok: false,
        sent: 0,
        failed: 1,
        audience: 1,
        audience_type: audienceType,
        error: result.error,
      };
    }
    return { ok: true, sent: 1, failed: 0, audience: 1, audience_type: audienceType };
  }

  if (campaign.status === "sending") {
    return { ok: false, sent: 0, failed: 0, audience: 0, error: "Campaign is already sending." };
  }
  if (campaign.status === "sent") {
    return { ok: false, sent: 0, failed: 0, audience: 0, error: "Campaign was already sent." };
  }

  const recipients = await listCampaignRecipients(audienceType);
  const now = new Date().toISOString();

  const { error: lockError } = await supabaseAdmin
    .from("email_campaigns")
    .update({
      status: "sending",
      audience: audienceType,
      audience_count: recipients.length,
      last_error: null,
      updated_at: now,
    })
    .eq("id", campaign.id)
    .in("status", ["draft", "scheduled", "failed"]);

  if (lockError) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      audience: recipients.length,
      audience_type: audienceType,
      error: lockError.message,
    };
  }

  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;
  const emailBlocks = await prepareCampaignBlocksForEmail(blocks);

  for (const recipient of recipients) {
    const unsubscribeUrl = await buildUnsubscribeUrl({
      subscriberId: recipient.subscriberId ?? UNSUBSCRIBE_PLACEHOLDER_ID,
      email: recipient.email,
    });
    const html = await renderCampaignEmailHtml({
      subject,
      previewText: campaign.preview_text,
      blocks: emailBlocks,
      unsubscribeUrl,
      recipientFirstName: recipient.firstName,
      skipImagePrepare: true,
    });

    const result = await sendCampaignEmail({
      to: recipient.email,
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
          subscriber_id: recipient.subscriberId,
          email: recipient.email,
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
          subscriber_id: recipient.subscriberId,
          email: recipient.email,
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
      audience: audienceType,
      sent_count: sent,
      failed_count: failed,
      audience_count: recipients.length,
      sent_at: sent > 0 ? new Date().toISOString() : null,
      last_error: lastError,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaign.id);

  return {
    ok: sent > 0,
    sent,
    failed,
    audience: recipients.length,
    audience_type: audienceType,
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
    .select("id, audience")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(5);

  if (error) {
    throw new Error(error.message);
  }

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const row of data ?? []) {
    const audience = isCampaignAudience(row.audience) ? row.audience : "subscribers";
    const outcome = await dispatchCampaign({ campaignId: row.id, audience });
    results.push({ id: row.id, ok: outcome.ok, error: outcome.error });
  }

  return { processed: results.length, results };
};
