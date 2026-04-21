import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../../../lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { data: event, error: loadError } = await supabaseAdmin
    .from("events")
    .select("is_published")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !event) {
    return NextResponse.json({ error: loadError?.message ?? "Event not found." }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("events")
    .update({ is_published: !event.is_published })
    .eq("id", id)
    .select("id,is_published")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
