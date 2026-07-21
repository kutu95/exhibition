import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../../../lib/api-route-errors";
import { sendVaultAccessEmail } from "../../../../../../../lib/emails/vault-access";
import { supabaseAdmin } from "../../../../../../../lib/supabase/admin";
import {
  buildVaultAccessUrl,
  createVaultInviteToken,
  hashVaultToken,
} from "../../../../../../../lib/vault-auth";

const reviewSchema = z.object({
  action: z.enum(["approve", "decline"]),
  admin_note: z.string().trim().max(1000).optional().nullable(),
  send_email: z.boolean().optional(),
  expires_at: z.string().datetime().optional().nullable(),
});

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
    const parsed = reviewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid review payload." }, { status: 400 });
    }

    const { data: existing, error: loadError } = await supabaseAdmin
      .from("vault_access_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }
    if (existing.status !== "pending") {
      return NextResponse.json({ error: "This request has already been reviewed." }, { status: 409 });
    }

    if (parsed.data.action === "decline") {
      const { data, error } = await supabaseAdmin
        .from("vault_access_requests")
        .update({
          status: "declined",
          admin_note: parsed.data.admin_note ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data);
    }

    const rawToken = createVaultInviteToken();
    const tokenHash = hashVaultToken(rawToken);
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("vault_invites")
      .insert({
        token_hash: tokenHash,
        label: existing.name,
        email: existing.email,
        access_request_id: existing.id,
        expires_at: parsed.data.expires_at ?? null,
      })
      .select("id, label, email, access_request_id, expires_at, revoked_at, last_used_at, created_at")
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: inviteError?.message ?? "Failed to create invite." }, { status: 500 });
    }

    const { data: requestRow, error: updateError } = await supabaseAdmin
      .from("vault_access_requests")
      .update({
        status: "approved",
        admin_note: parsed.data.admin_note ?? null,
        invite_id: invite.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const accessUrl = buildVaultAccessUrl(rawToken);
    let emailSent = false;
    let emailError: string | undefined;

    if (parsed.data.send_email !== false) {
      const result = await sendVaultAccessEmail({
        to: existing.email,
        name: existing.name,
        accessUrl,
      });
      emailSent = result.sent;
      emailError = result.error;
    }

    return NextResponse.json({
      request: requestRow,
      invite: {
        ...invite,
        access_url: accessUrl,
        email_sent: emailSent,
        email_error: emailError ?? null,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Admin vault request review failed");
  }
}
