import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../../lib/admin-auth";
import { emptyCampaignBlocks } from "../../../../../../lib/campaigns/blocks";
import { loadCampaign, parseCampaignBlocks } from "../../../../../../lib/campaigns/send";
import { handleRouteError } from "../../../../../../lib/api-route-errors";
import { supabaseAdmin } from "../../../../../../lib/supabase/admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const source = await loadCampaign(id);
    if (!source) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const blocks = parseCampaignBlocks(source.blocks);
    const { data, error } = await supabaseAdmin
      .from("email_campaigns")
      .insert({
        name: `${source.name} (copy)`,
        subject: source.subject,
        preview_text: source.preview_text,
        blocks: blocks.length > 0 ? blocks : emptyCampaignBlocks(),
        audience: source.audience === "talk_registrations" ? "talk_registrations" : "subscribers",
        status: "draft",
        scheduled_at: null,
        sent_at: null,
        audience_count: null,
        sent_count: 0,
        failed_count: 0,
        last_error: null,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Clone failed." }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Admin campaign clone failed");
  }
}
