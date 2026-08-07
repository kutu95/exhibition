import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { campaignBlocksSchema } from "../../../../../lib/campaigns/blocks";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  subject: z.string().max(300).optional(),
  preview_text: z.string().max(500).nullable().optional(),
  blocks: campaignBlocksSchema.optional(),
  status: z.enum(["draft", "scheduled", "cancelled"]).optional(),
  scheduled_at: z.string().nullable().optional(),
  audience: z.enum(["subscribers", "talk_registrations"]).optional(),
});

export async function GET(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const [{ data: campaign, error }, { data: sends, error: sendsError }] = await Promise.all([
      supabaseAdmin.from("email_campaigns").select("*").eq("id", id).maybeSingle(),
      supabaseAdmin
        .from("email_campaign_sends")
        .select("status")
        .eq("campaign_id", id),
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    if (sendsError) {
      return NextResponse.json({ error: sendsError.message }, { status: 500 });
    }

    const stats = {
      sent: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
    };
    for (const row of sends ?? []) {
      const key = row.status as keyof typeof stats;
      if (key in stats) stats[key] += 1;
    }

    return NextResponse.json({ campaign, stats });
  } catch (error) {
    return handleRouteError(error, "Admin campaign get failed");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid campaign update." }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("email_campaigns")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    if (existing.status === "sending" || existing.status === "sent") {
      return NextResponse.json(
        { error: "Sent or in-progress campaigns cannot be edited. Clone to make a new draft." },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
    if (parsed.data.subject !== undefined) updates.subject = parsed.data.subject.trim();
    if (parsed.data.preview_text !== undefined) {
      updates.preview_text = parsed.data.preview_text?.trim() || null;
    }
    if (parsed.data.blocks !== undefined) updates.blocks = parsed.data.blocks;
    if (parsed.data.audience !== undefined) updates.audience = parsed.data.audience;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.scheduled_at !== undefined) {
      updates.scheduled_at = parsed.data.scheduled_at;
      if (parsed.data.scheduled_at && parsed.data.status === undefined) {
        updates.status = "scheduled";
      }
      if (parsed.data.scheduled_at === null && parsed.data.status === undefined) {
        updates.status = "draft";
      }
    }

    const { data, error } = await supabaseAdmin
      .from("email_campaigns")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Update failed." }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, "Admin campaign update failed");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("email_campaigns")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    if (existing.status === "sending") {
      return NextResponse.json({ error: "Cannot delete a campaign that is sending." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("email_campaigns").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Admin campaign delete failed");
  }
}
