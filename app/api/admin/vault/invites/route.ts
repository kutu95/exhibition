import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import { sendVaultAccessEmail } from "../../../../../lib/emails/vault-access";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";
import {
  buildVaultAccessUrl,
  createVaultInviteToken,
  hashVaultToken,
} from "../../../../../lib/vault-auth";

const createInviteSchema = z.object({
  label: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(200).optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
  send_email: z.boolean().optional(),
  access_request_id: z.string().uuid().optional().nullable(),
});

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("vault_invites")
      .select("id, label, email, access_request_id, expires_at, revoked_at, last_used_at, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    return handleRouteError(error, "Admin vault invites list failed");
  }
}

export async function POST(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = createInviteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid invite payload." }, { status: 400 });
    }

    const rawToken = createVaultInviteToken();
    const tokenHash = hashVaultToken(rawToken);
    const email = parsed.data.email?.trim().toLowerCase() || null;

    const { data: invite, error } = await supabaseAdmin
      .from("vault_invites")
      .insert({
        token_hash: tokenHash,
        label: parsed.data.label,
        email,
        access_request_id: parsed.data.access_request_id ?? null,
        expires_at: parsed.data.expires_at ?? null,
      })
      .select("id, label, email, access_request_id, expires_at, revoked_at, last_used_at, created_at")
      .single();

    if (error || !invite) {
      return NextResponse.json({ error: error?.message ?? "Failed to create invite." }, { status: 500 });
    }

    if (parsed.data.access_request_id) {
      await supabaseAdmin
        .from("vault_access_requests")
        .update({
          status: "approved",
          invite_id: invite.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", parsed.data.access_request_id);
    }

    const accessUrl = buildVaultAccessUrl(rawToken);
    let emailSent = false;
    let emailError: string | undefined;

    if (parsed.data.send_email && email) {
      const result = await sendVaultAccessEmail({
        to: email,
        name: parsed.data.label,
        accessUrl,
      });
      emailSent = result.sent;
      emailError = result.error;
    }

    return NextResponse.json(
      {
        ...invite,
        access_url: accessUrl,
        email_sent: emailSent,
        email_error: emailError ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error, "Admin vault invite create failed");
  }
}
