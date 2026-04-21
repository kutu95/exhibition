import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "../../../lib/supabase/admin";

const subscribeSchema = z.object({
  email: z.string().email(),
  first_name: z.string().min(1).optional(),
  source: z.enum(["holding_page", "shop", "visit_page", "footer", "other"]).optional(),
});

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = subscribeSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload." },
        { status: 400 },
      );
    }

    const { email, first_name, source } = parsed.data;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("email_subscribers")
      .select("id, unsubscribed_at")
      .eq("email", email)
      .maybeSingle();

    if (existingError) {
      console.error("Subscribe lookup failed", existingError);
      return NextResponse.json(
        { success: false, error: "Could not process subscription." },
        { status: 500 },
      );
    }

    if (existing && existing.unsubscribed_at === null) {
      return NextResponse.json({ success: true });
    }

    if (existing) {
      const updates: {
        first_name?: string;
        source?: "holding_page" | "shop" | "visit_page" | "footer" | "other";
        unsubscribed_at?: null;
      } = {};

      if (first_name) {
        updates.first_name = first_name;
      }
      if (source) {
        updates.source = source;
      }
      if (existing.unsubscribed_at !== null) {
        updates.unsubscribed_at = null;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from("email_subscribers")
          .update(updates)
          .eq("email", email);

        if (updateError) {
          console.error("Subscribe update failed", updateError);
          return NextResponse.json(
            { success: false, error: "Could not process subscription." },
            { status: 500 },
          );
        }
      }

      return NextResponse.json({ success: true });
    }

    const { error: insertError } = await supabaseAdmin.from("email_subscribers").insert({
      email,
      first_name: first_name ?? null,
      source: source ?? null,
    });

    if (insertError) {
      console.error("Subscribe insert failed", insertError);
      return NextResponse.json(
        { success: false, error: "Could not process subscription." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Subscribe route failed", error);
    return NextResponse.json(
      { success: false, error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
