import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../../../lib/api-route-errors";
import { supabaseAdmin } from "../../../../../../../lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const { data, error } = await supabaseAdmin
      .from("vault_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .is("revoked_at", null)
      .select("id, label, email, access_request_id, expires_at, revoked_at, last_used_at, created_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Invite not found or already revoked." }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, "Admin vault invite revoke failed");
  }
}
