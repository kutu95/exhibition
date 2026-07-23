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
      .select("id,email,name,party_size,list,source,created_at,cancelled_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data ?? [];
    const active = rows.filter((row) => row.cancelled_at === null);
    const confirmed = active.filter((row) => row.list === "confirmed");
    const waitlist = active.filter((row) => row.list === "waitlist");
    const seatsTaken = confirmed.reduce((sum, row) => sum + (row.party_size ?? 0), 0);
    const waitlistSeats = waitlist.reduce((sum, row) => sum + (row.party_size ?? 0), 0);
    const capacity = await getTalkCapacity();

    return NextResponse.json({
      metrics: {
        registrations: confirmed.length,
        seats_taken: seatsTaken,
        capacity,
        seats_remaining: Math.max(0, capacity - seatsTaken),
        waitlist_registrations: waitlist.length,
        waitlist_seats: waitlistSeats,
        cancelled: rows.length - active.length,
      },
      registrations: rows,
    });
  } catch (error) {
    return handleRouteError(error, "Admin talk registrations route failed");
  }
}
