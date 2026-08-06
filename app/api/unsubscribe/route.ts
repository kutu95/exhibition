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

    const { data: subscriber, error: lookupError } = await supabaseAdmin
      .from("email_subscribers")
      .select("id, email, unsubscribed_at")
      .eq("id", payload.subscriberId)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }
    if (!subscriber || subscriber.email.toLowerCase() !== payload.email.toLowerCase()) {
      return NextResponse.json({ error: "Subscriber not found." }, { status: 404 });
    }

    if (!subscriber.unsubscribed_at) {
      const { error: updateError } = await supabaseAdmin
        .from("email_subscribers")
        .update({ unsubscribed_at: new Date().toISOString() })
        .eq("id", subscriber.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, email: subscriber.email });
  } catch (error) {
    console.error("Unsubscribe failed", error);
    return NextResponse.json({ error: "Could not unsubscribe." }, { status: 500 });
  }
}
