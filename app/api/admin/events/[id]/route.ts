import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

const eventSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  event_date: z.string().min(1),
  duration_minutes: z.number().int().positive().nullable(),
  location_name: z.string().nullable(),
  speaker_name: z.string().nullable(),
  speaker_bio: z.string().nullable(),
  is_ticketed: z.boolean(),
  ticket_url: z.string().nullable(),
  is_published: z.boolean(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { data, error } = await supabaseAdmin.from("events").select("*").eq("id", id).maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event payload." }, { status: 400 });
  }

  const { id } = await context.params;
  const payload = parsed.data;

  const { error } = await supabaseAdmin
    .from("events")
    .update({
      title: payload.title,
      slug: payload.slug,
      description: payload.description,
      event_date: payload.event_date,
      duration_minutes: payload.duration_minutes,
      location_name: payload.location_name,
      speaker_name: payload.speaker_name,
      speaker_bio: payload.speaker_bio,
      is_ticketed: payload.is_ticketed,
      ticket_url: payload.ticket_url,
      is_published: payload.is_published,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
