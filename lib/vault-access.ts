import { cookies, headers } from "next/headers";

import { areCollectionsAllowedForHost, areCollectionsAllowedForRequest } from "./purchases-access";
import { VAULT_SESSION_COOKIE, verifyVaultSessionToken } from "./vault-auth";
import { supabaseAdmin } from "./supabase/admin";

export const hasActiveVaultSession = async (): Promise<boolean> => {
  const headerStore = await headers();
  if (!areCollectionsAllowedForHost(headerStore.get("host"))) return false;

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
  if (!areCollectionsAllowedForRequest(request)) return false;

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
