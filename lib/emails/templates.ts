import { campaignBlocksSchema, type CampaignBlock } from "../campaigns/blocks";
import { prepareCampaignBlocksForEmail } from "../campaigns/email-image";
import { renderCampaignEmailHtml } from "../campaigns/render";
import { WELCOME_CAMPAIGN_NAME } from "../campaigns/welcome-shared";
import { supabaseAdmin } from "../supabase/admin";
import type { EmailCampaign } from "../supabase/types";
import {
  interpolateMergeTokens,
  renderOrderSummaryHtml,
  renderShipmentDetailsHtml,
  sampleOrderLines,
  sampleOrderMergeVars,
  type EmailMergeVars,
  type OrderEmailLine,
} from "./merge";
import {
  EMAIL_TEMPLATE_DEFINITIONS,
  EMAIL_TEMPLATE_SLUGS,
  type EmailTemplateSlug,
} from "./template-defs";

export type EmailTemplateRecord = {
  slug: EmailTemplateSlug;
  name: string;
  subject: string;
  preview_text: string | null;
  blocks: CampaignBlock[];
  created_at: string;
  updated_at: string;
};

const parseBlocks = (value: unknown): CampaignBlock[] => {
  const parsed = campaignBlocksSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
};

const copyWelcomeCampaignIfPresent = async (): Promise<{
  subject: string;
  preview_text: string | null;
  blocks: CampaignBlock[];
} | null> => {
  const { data, error } = await supabaseAdmin
    .from("email_campaigns")
    .select("subject, preview_text, blocks")
    .ilike("name", WELCOME_CAMPAIGN_NAME)
    .neq("status", "cancelled")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const campaign = data as Pick<EmailCampaign, "subject" | "preview_text" | "blocks">;
  const blocks = parseBlocks(campaign.blocks);
  if (!campaign.subject.trim() || blocks.length === 0) return null;
  return {
    subject: campaign.subject,
    preview_text: campaign.preview_text,
    blocks,
  };
};

export const ensureEmailTemplates = async (): Promise<EmailTemplateRecord[]> => {
  const { data, error } = await supabaseAdmin.from("email_templates").select("*");
  if (error) {
    throw new Error(error.message);
  }

  const existing = new Map(
    ((data ?? []) as Array<EmailTemplateRecord & { blocks: unknown }>).map((row) => [
      row.slug,
      { ...row, blocks: parseBlocks(row.blocks) },
    ]),
  );

  for (const slug of EMAIL_TEMPLATE_SLUGS) {
    if (existing.has(slug)) continue;
    const def = EMAIL_TEMPLATE_DEFINITIONS[slug];
    let subject = def.defaultSubject;
    let preview_text: string | null = def.defaultPreview;
    let blocks = def.defaultBlocks();

    if (slug === "new_subscriber") {
      const copied = await copyWelcomeCampaignIfPresent();
      if (copied) {
        subject = copied.subject;
        preview_text = copied.preview_text;
        blocks = copied.blocks;
      }
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("email_templates")
      .insert({
        slug,
        name: def.name,
        subject,
        preview_text,
        blocks,
      })
      .select("*")
      .single();

    if (insertError) {
      if (insertError.code === "23505") continue;
      throw new Error(insertError.message);
    }

    if (inserted) {
      existing.set(slug, {
        ...(inserted as EmailTemplateRecord),
        blocks: parseBlocks((inserted as { blocks: unknown }).blocks),
      });
    }
  }

  return EMAIL_TEMPLATE_SLUGS.map((slug) => existing.get(slug)).filter(
    (row): row is EmailTemplateRecord => Boolean(row),
  );
};

export const getEmailTemplate = async (slug: EmailTemplateSlug): Promise<EmailTemplateRecord | null> => {
  await ensureEmailTemplates();
  const { data, error } = await supabaseAdmin.from("email_templates").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { ...(data as EmailTemplateRecord), blocks: parseBlocks((data as { blocks: unknown }).blocks) };
};

export const updateEmailTemplate = async (
  slug: EmailTemplateSlug,
  patch: { subject?: string; preview_text?: string | null; blocks?: CampaignBlock[] },
): Promise<EmailTemplateRecord> => {
  const { data, error } = await supabaseAdmin
    .from("email_templates")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", slug)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return { ...(data as EmailTemplateRecord), blocks: parseBlocks((data as { blocks: unknown }).blocks) };
};

export type RenderEmailTemplateInput = {
  slug: EmailTemplateSlug;
  mergeVars?: EmailMergeVars;
  items?: OrderEmailLine[];
  totalAud?: number;
  shipment?: {
    order_number: string;
    photo_title: string;
    variant_label: string;
    edition_line: string;
    tracking_number: string;
  };
  unsubscribeUrl?: string | null;
  recipientFirstName?: string | null;
};

export const renderEmailTemplate = async (
  input: RenderEmailTemplateInput,
): Promise<{ subject: string; html: string; previewText: string | null } | null> => {
  const template = await getEmailTemplate(input.slug);
  if (!template || !template.subject.trim() || template.blocks.length === 0) {
    return null;
  }

  const def = EMAIL_TEMPLATE_DEFINITIONS[input.slug];
  const vars = input.mergeVars ?? {};
  const mergeHtml: Partial<Record<"order_summary" | "shipment_details", string>> = {};
  if (input.items && input.totalAud != null) {
    mergeHtml.order_summary = renderOrderSummaryHtml(input.items, input.totalAud);
  }
  if (input.shipment) {
    mergeHtml.shipment_details = renderShipmentDetailsHtml(input.shipment);
  }

  const emailBlocks = await prepareCampaignBlocksForEmail(template.blocks);
  const html = await renderCampaignEmailHtml({
    subject: template.subject,
    previewText: template.preview_text,
    blocks: emailBlocks,
    unsubscribeUrl: def.kind === "marketing" ? input.unsubscribeUrl : null,
    recipientFirstName: input.recipientFirstName,
    skipImagePrepare: true,
    autoGreeting: def.kind === "marketing",
    mergeVars: vars,
    mergeHtml,
  });

  return {
    subject: interpolateMergeTokens(template.subject, vars),
    html,
    previewText: template.preview_text,
  };
};

export const previewEmailTemplate = async (slug: EmailTemplateSlug): Promise<{
  subject: string;
  html: string;
}> => {
  const sample = sampleOrderMergeVars();
  const rendered = await renderEmailTemplate({
    slug,
    mergeVars: sample,
    items: sampleOrderLines(),
    totalAud: 45000,
    shipment: {
      order_number: sample.order_number,
      photo_title: sample.photo_title,
      variant_label: sample.variant_label,
      edition_line: sample.edition_line,
      tracking_number: sample.tracking_number,
    },
    unsubscribeUrl: "https://exhibition.margies.app/unsubscribe",
    recipientFirstName: sample.first_name,
  });

  if (!rendered) {
    throw new Error("Template is empty.");
  }

  return { subject: rendered.subject, html: rendered.html };
};
