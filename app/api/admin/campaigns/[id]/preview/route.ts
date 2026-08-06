import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../../lib/admin-auth";
import { loadCampaign, parseCampaignBlocks } from "../../../../../../lib/campaigns/send";
import { renderCampaignEmailHtml } from "../../../../../../lib/campaigns/render";
import { siteConfig } from "../../../../../../lib/metadata";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const campaign = await loadCampaign(id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const blocks = parseCampaignBlocks(campaign.blocks);
  const html = renderCampaignEmailHtml({
    subject: campaign.subject || "Preview",
    previewText: campaign.preview_text,
    blocks,
    unsubscribeUrl: `${siteConfig.url.replace(/\/$/, "")}/unsubscribe`,
    recipientFirstName: "Preview",
  });

  return NextResponse.json({
    subject: campaign.subject,
    html,
  });
}
