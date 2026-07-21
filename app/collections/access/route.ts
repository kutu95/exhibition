import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../lib/supabase/admin";
import {
  createVaultSessionToken,
  getVaultCookieConfig,
  hashVaultToken,
  VAULT_SESSION_MAX_AGE_SECONDS,
} from "../../../lib/vault-auth";

const redirectBase = (request: Request): string =>
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.url;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const leave = url.searchParams.get("leave") === "1";
  const rawToken = url.searchParams.get("t")?.trim();
  const base = redirectBase(request);

  if (leave) {
    const response = NextResponse.redirect(new URL("/shop", base));
    response.cookies.set({
      ...getVaultCookieConfig(0),
      value: "",
      maxAge: 0,
    });
    return response;
  }

  if (!rawToken) {
    return NextResponse.redirect(new URL("/collections/request", base));
  }

  const tokenHash = hashVaultToken(rawToken);
  const { data: invite, error } = await supabaseAdmin
    .from("vault_invites")
    .select("id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !invite || invite.revoked_at) {
    return NextResponse.redirect(new URL("/collections/request?invalid=1", base));
  }

  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(new URL("/collections/request?expired=1", base));
  }

  await supabaseAdmin
    .from("vault_invites")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", invite.id);

  const expiresAt = invite.expires_at ? new Date(invite.expires_at) : null;
  const sessionToken = await createVaultSessionToken(invite.id, expiresAt);
  const maxAge = expiresAt
    ? Math.max(60, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
    : VAULT_SESSION_MAX_AGE_SECONDS;

  const response = NextResponse.redirect(new URL("/shop?collections=open", base));
  response.cookies.set({
    ...getVaultCookieConfig(maxAge),
    value: sessionToken,
  });
  return response;
}
