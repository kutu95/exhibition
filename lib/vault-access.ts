import { cookies } from "next/headers";

import { VAULT_SESSION_COOKIE, verifyVaultSessionToken } from "./vault-auth";
import { supabaseAdmin } from "./supabase/admin";

export const hasActiveVaultSession = async (): Promise<boolean> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(VAULT_SESSION_COOKIE)?.value;
  const session = await verifyVaultSessionToken(token);
  if (!session) return false;

  const { data } = await supabaseAdmin
    .from("vault_invites")
    .select("id, revoked_at, expires_at")
    .eq("id", session.inviteId)
    .maybeSingle();

  if (!data || data.revoked_at) return false;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return false;
  return true;
};

export const hasActiveVaultSessionFromRequest = async (request: Request): Promise<boolean> => {
  const { verifyVaultSessionFromRequest } = await import("./vault-auth");
  const session = await verifyVaultSessionFromRequest(request);
  if (!session) return false;

  const { data } = await supabaseAdmin
    .from("vault_invites")
    .select("id, revoked_at, expires_at")
    .eq("id", session.inviteId)
    .maybeSingle();

  if (!data || data.revoked_at) return false;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return false;
  return true;
};
