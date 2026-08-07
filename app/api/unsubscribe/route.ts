import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyUnsubscribeToken } from "../../../lib/campaigns/unsubscribe";
import { supabaseAdmin } from "../../../lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Missing unsubscribe token." }, { status: 400 });
    }

    const payload = await verifyUnsubscribeToken(parsed.data.token);
    if (!payload) {
      return NextResponse.json({ error: "This unsubscribe link is invalid or expired." }, { status: 400 });
    }

    const email = payload.email.trim().toLowerCase();
    const now = new Date().toISOString();

    const { data: byId, error: byIdError } = await supabaseAdmin
      .from("email_subscribers")
      .select("id, email, unsubscribed_at")
      .eq("id", payload.subscriberId)
      .maybeSingle();

    if (byIdError) {
      return NextResponse.json({ error: byIdError.message }, { status: 500 });
    }

    let subscriber = byId && byId.email.toLowerCase() === email ? byId : null;

    if (!subscriber) {
      const { data: byEmail, error: byEmailError } = await supabaseAdmin
        .from("email_subscribers")
        .select("id, email, unsubscribed_at")
        .ilike("email", email)
        .maybeSingle();

      if (byEmailError) {
        return NextResponse.json({ error: byEmailError.message }, { status: 500 });
      }
      subscriber = byEmail;
    }

    if (subscriber) {
      if (!subscriber.unsubscribed_at) {
        const { error: updateError } = await supabaseAdmin
          .from("email_subscribers")
          .update({ unsubscribed_at: now })
          .eq("id", subscriber.id);

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
      }
      return NextResponse.json({ ok: true, email: subscriber.email });
    }

    // Talk-registration (or other) recipient with no website subscriber row — suppress by email.
    const { error: insertError } = await supabaseAdmin.from("email_subscribers").insert({
      email: payload.email.trim(),
      source: "other",
      is_confirmed: false,
      subscribed_at: now,
      unsubscribed_at: now,
    });

    if (insertError) {
      // Unique conflict: another request inserted first — mark unsubscribed.
      const { error: updateError } = await supabaseAdmin
        .from("email_subscribers")
        .update({ unsubscribed_at: now })
        .ilike("email", email);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, email: payload.email.trim() });
  } catch (error) {
    console.error("Unsubscribe failed", error);
    return NextResponse.json({ error: "Could not unsubscribe." }, { status: 500 });
  }
}
