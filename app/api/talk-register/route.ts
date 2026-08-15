import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "../../../lib/api-route-errors";
import { sendTalkRegistrationAlertEmail } from "../../../lib/emails/registration-alert";
import { sendTalkConfirmationEmail } from "../../../lib/emails/talk-confirmation";
import { supabaseAdmin } from "../../../lib/supabase/admin";
import {
  getTalkCapacity,
  normalizeTalkEmail,
  type TalkList,
} from "../../../lib/talk-registration";

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(120),
  party_size: z.number().int().min(1).max(10).default(1),
  source: z.enum(["installations_talk", "visit_talk", "home", "other"]).optional(),
  /** Prefer waitlist when seats cannot fit this party (or when full). */
  waitlist: z.boolean().optional(),
});

const countConfirmedSeats = async (): Promise<number> => {
  const { data, error } = await supabaseAdmin
    .from("talk_registrations")
    .select("party_size")
    .eq("list", "confirmed")
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
    const preferWaitlist = parsed.data.waitlist === true;
    const capacity = await getTalkCapacity();

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("talk_registrations")
      .select("id, party_size, list, cancelled_at")
      .ilike("email", email)
      .is("cancelled_at", null)
      .maybeSingle();

    if (existingError) {
      console.error("Talk registration lookup failed", existingError);
      return NextResponse.json({ success: false, error: "Could not complete registration." }, { status: 500 });
    }

    if (existing) {
      const list = (existing.list as TalkList) ?? "confirmed";
      return NextResponse.json({
        success: true,
        already_registered: true,
        list,
        message:
          list === "waitlist"
            ? "You're already on the wait list for this talk."
            : "You're already registered for this talk.",
      });
    }

    const seatsTaken = await countConfirmedSeats();
    const seatsRemaining = Math.max(0, capacity - seatsTaken);
    const canConfirm = seatsTaken + partySize <= capacity;

    let list: TalkList = "confirmed";
    if (preferWaitlist || !canConfirm) {
      if (!canConfirm && seatsRemaining > 0 && !preferWaitlist) {
        return NextResponse.json(
          {
            success: false,
            error: `Only ${seatsRemaining} seat${seatsRemaining === 1 ? "" : "s"} available — choose a smaller party size, or join the wait list.`,
            seats_remaining: seatsRemaining,
            is_full: false,
            can_waitlist: true,
          },
          { status: 409 },
        );
      }
      list = "waitlist";
    }

    const { error: insertError } = await supabaseAdmin.from("talk_registrations").insert({
      email,
      name,
      party_size: partySize,
      list,
      source,
    });

    if (insertError) {
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

    void sendTalkRegistrationAlertEmail({
      email,
      name,
      partySize,
      list,
      source,
    });

    if (list === "confirmed") {
      void sendTalkConfirmationEmail({
        email,
        name,
        partySize,
      });
    }

    const nextRemaining =
      list === "confirmed" ? Math.max(0, capacity - seatsTaken - partySize) : seatsRemaining;

    return NextResponse.json({
      success: true,
      already_registered: false,
      list,
      seats_remaining: nextRemaining,
      is_full: nextRemaining <= 0,
    });
  } catch (error) {
    return handleRouteError(error, "Talk registration route failed");
  }
}

export async function GET() {
  try {
    const capacity = await getTalkCapacity();
    const seatsTaken = await countConfirmedSeats();
    const seatsRemaining = Math.max(0, capacity - seatsTaken);
    return NextResponse.json({
      seats_remaining: seatsRemaining,
      is_full: seatsRemaining <= 0,
    });
  } catch (error) {
    return handleRouteError(error, "Talk registration capacity route failed");
  }
}
