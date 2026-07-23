import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { handleRouteError } from "../../../../lib/api-route-errors";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { getTalkCapacity } from "../../../../lib/talk-registration";

export async function GET(request: Request) {
  try {
    const isAuthed = await verifyAdminSession(request);
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("talk_registrations")
      .select("id,email,name,party_size,source,created_at,cancelled_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data ?? [];
    const active = rows.filter((row) => row.cancelled_at === null);
    const seatsTaken = active.reduce((sum, row) => sum + (row.party_size ?? 0), 0);
    const capacity = getTalkCapacity();

    return NextResponse.json({
      metrics: {
        registrations: active.length,
        seats_taken: seatsTaken,
        capacity,
        seats_remaining: Math.max(0, capacity - seatsTaken),
        cancelled: rows.length - active.length,
      },
      registrations: rows,
    });
  } catch (error) {
    return handleRouteError(error, "Admin talk registrations route failed");
  }
}
