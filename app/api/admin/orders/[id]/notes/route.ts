import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../../../lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const notesSchema = z.object({
  notes: z.string(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = notesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notes." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("orders").update({ notes: parsed.data.notes }).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
