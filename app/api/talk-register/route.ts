import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "../../../lib/api-route-errors";
import { supabaseAdmin } from "../../../lib/supabase/admin";
import { getTalkCapacity, normalizeTalkEmail } from "../../../lib/talk-registration";

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(120),
  party_size: z.number().int().min(1).max(10).default(1),
  source: z.enum(["installations_talk", "visit_talk", "home", "other"]).optional(),
});

const countActiveSeats = async (): Promise<number> => {
  const { data, error } = await supabaseAdmin
    .from("talk_registrations")
    .select("party_size")
    .is("cancelled_at", null);

  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + (row.party_size ?? 0), 0);
};

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = registerSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid registration details." }, { status: 400 });
    }

    const email = normalizeTalkEmail(parsed.data.email);
    const name = parsed.data.name.trim();
    const partySize = parsed.data.party_size;
    const source = parsed.data.source ?? null;
    const capacity = getTalkCapacity();

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("talk_registrations")
      .select("id, party_size, cancelled_at")
      .ilike("email", email)
      .is("cancelled_at", null)
      .maybeSingle();

    if (existingError) {
      console.error("Talk registration lookup failed", existingError);
      return NextResponse.json({ success: false, error: "Could not complete registration." }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({
        success: true,
        already_registered: true,
        message: "You're already registered for this talk.",
      });
    }

    const seatsTaken = await countActiveSeats();
    if (seatsTaken + partySize > capacity) {
      const seatsRemaining = Math.max(0, capacity - seatsTaken);
      return NextResponse.json(
        {
          success: false,
          error:
            seatsTaken >= capacity
              ? "This talk is fully booked."
              : `Only ${seatsRemaining} place${seatsRemaining === 1 ? "" : "s"} left — try a smaller party size.`,
          capacity,
          seats_taken: seatsTaken,
          seats_remaining: seatsRemaining,
        },
        { status: 409 },
      );
    }

    const { error: insertError } = await supabaseAdmin.from("talk_registrations").insert({
      email,
      name,
      party_size: partySize,
      source,
    });

    if (insertError) {
      // Race on unique email: treat as already registered.
      if (insertError.code === "23505") {
        return NextResponse.json({
          success: true,
          already_registered: true,
          message: "You're already registered for this talk.",
        });
      }
      console.error("Talk registration insert failed", insertError);
      return NextResponse.json({ success: false, error: "Could not complete registration." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      already_registered: false,
      seats_remaining: Math.max(0, capacity - seatsTaken - partySize),
    });
  } catch (error) {
    return handleRouteError(error, "Talk registration route failed");
  }
}

export async function GET() {
  try {
    const capacity = getTalkCapacity();
    const seatsTaken = await countActiveSeats();
    return NextResponse.json({
      capacity,
      seats_taken: seatsTaken,
      seats_remaining: Math.max(0, capacity - seatsTaken),
      is_full: seatsTaken >= capacity,
    });
  } catch (error) {
    return handleRouteError(error, "Talk registration capacity route failed");
  }
}
