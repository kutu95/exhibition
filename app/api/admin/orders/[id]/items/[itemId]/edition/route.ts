import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../../../../../lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

const editionSchema = z.object({
  edition_number: z.number().int().positive(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, itemId } = await context.params;
  const body = await request.json();
  const parsed = editionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid edition number." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("order_items")
    .update({ edition_number_assigned: parsed.data.edition_number })
    .eq("id", itemId)
    .eq("order_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
