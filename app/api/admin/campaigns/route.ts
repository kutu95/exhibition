import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { emptyCampaignBlocks, campaignBlocksSchema } from "../../../../lib/campaigns/blocks";
import { countCampaignAudiences, isCampaignAudience } from "../../../../lib/campaigns/send";
import { handleRouteError } from "../../../../lib/api-route-errors";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  subject: z.string().max(300).optional(),
  preview_text: z.string().max(500).nullable().optional(),
  blocks: campaignBlocksSchema.optional(),
  audience: z.enum(["subscribers", "talk_registrations"]).optional(),
});

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [{ data, error }, counts] = await Promise.all([
      supabaseAdmin
        .from("email_campaigns")
        .select("*")
        .order("updated_at", { ascending: false }),
      countCampaignAudiences().catch(() => ({ subscribers: 0, talk_registrations: 0 })),
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      campaigns: data ?? [],
      audience_count: counts.subscribers,
      audience_counts: counts,
    });
  } catch (error) {
    return handleRouteError(error, "Admin campaigns list failed");
  }
}

export async function POST(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid campaign payload." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const audience = isCampaignAudience(parsed.data.audience) ? parsed.data.audience : "subscribers";
    const { data, error } = await supabaseAdmin
      .from("email_campaigns")
      .insert({
        name: parsed.data.name?.trim() || "Untitled campaign",
        subject: parsed.data.subject?.trim() || "",
        preview_text: parsed.data.preview_text?.trim() || null,
        blocks: parsed.data.blocks ?? emptyCampaignBlocks(),
        audience,
        status: "draft",
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Could not create campaign." }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Admin campaign create failed");
  }
}
