import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "../../../../lib/api-route-errors";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

const requestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  interest: z.string().trim().min(10).max(2000),
  organisation: z.string().trim().max(200).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please include your name, a valid email, and a short note about your interest." },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin.from("vault_access_requests").insert({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      interest: parsed.data.interest,
      organisation: parsed.data.organisation?.trim() || null,
      status: "pending",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Vault access request failed");
  }
}
