import { cookies, headers } from "next/headers";

import { ADMIN_SESSION_COOKIE, verifyAdminSession, verifyAdminSessionToken } from "./admin-auth";
import { areCollectionsAllowedForHost, areCollectionsAllowedForRequest } from "./purchases-access";
import { supabaseAdmin } from "./supabase/admin";
import {
  VAULT_SESSION_COOKIE,
  verifyVaultSessionFromRequest,
  verifyVaultSessionToken,
  type VaultSessionPayload,
} from "./vault-auth";

export type VaultSessionGallery = {
  id: string;
  name: string;
};

export type VaultSessionAccess = {
  inviteIds: string[];
  galleryIds: string[];
  galleries: VaultSessionGallery[];
};

const emptyAccess = (): VaultSessionAccess => ({
  inviteIds: [],
  galleryIds: [],
  galleries: [],
});

const isInviteActive = (invite: {
  revoked_at: string | null;
  expires_at: string | null;
  gallery_id: string | null;
}): boolean => {
  if (!invite.gallery_id || invite.revoked_at) return false;
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) return false;
  return true;
};

const resolveAccessFromSession = async (
  session: VaultSessionPayload | null,
): Promise<VaultSessionAccess> => {
  if (!session || session.inviteIds.length === 0) {
    return emptyAccess();
  }

  const { data: invites } = await supabaseAdmin
    .from("vault_invites")
    .select("id, gallery_id, revoked_at, expires_at")
    .in("id", session.inviteIds);

  const activeInvites = (invites ?? []).filter(isInviteActive);
  const inviteIds = activeInvites.map((invite) => invite.id);
  const galleryIds = [...new Set(activeInvites.map((invite) => invite.gallery_id).filter(Boolean))] as string[];

  if (galleryIds.length === 0) {
    return emptyAccess();
  }

  const { data: galleries } = await supabaseAdmin
    .from("galleries")
    .select("id, name")
    .in("id", galleryIds)
    .order("name");

  return {
    inviteIds,
    galleryIds,
    galleries: (galleries ?? []).map((gallery) => ({ id: gallery.id, name: gallery.name })),
  };
};

export const getVaultSessionAccess = async (): Promise<VaultSessionAccess> => {
  const headerStore = await headers();
  if (!areCollectionsAllowedForHost(headerStore.get("host"))) {
    return emptyAccess();
  }

  const cookieStore = await cookies();
  const session = await verifyVaultSessionToken(cookieStore.get(VAULT_SESSION_COOKIE)?.value);
  return resolveAccessFromSession(session);
};

export const getVaultSessionAccessFromRequest = async (request: Request): Promise<VaultSessionAccess> => {
  if (!areCollectionsAllowedForRequest(request)) {
    return emptyAccess();
  }

  const session = await verifyVaultSessionFromRequest(request);
  return resolveAccessFromSession(session);
};

export const hasActiveVaultSession = async (): Promise<boolean> => {
  const access = await getVaultSessionAccess();
  return access.galleryIds.length > 0;
};

export const hasActiveVaultSessionFromRequest = async (request: Request): Promise<boolean> => {
  const access = await getVaultSessionAccessFromRequest(request);
  return access.galleryIds.length > 0;
};

export const allowedGalleryIdSet = (access: VaultSessionAccess): Set<string> => new Set(access.galleryIds);

export type CatalogAccess = VaultSessionAccess & {
  isAdmin: boolean;
};

const loadAllGalleries = async (): Promise<VaultSessionGallery[]> => {
  const { data } = await supabaseAdmin.from("galleries").select("id, name").order("name");
  return (data ?? []).map((gallery) => ({ id: gallery.id, name: gallery.name }));
};

const catalogAccessForAdmin = async (): Promise<CatalogAccess> => {
  const galleries = await loadAllGalleries();
  return {
    isAdmin: true,
    inviteIds: [],
    galleryIds: galleries.map((gallery) => gallery.id),
    galleries,
  };
};

export const getCatalogAccess = async (): Promise<CatalogAccess> => {
  const cookieStore = await cookies();
  const isAdmin = await verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (isAdmin) {
    return catalogAccessForAdmin();
  }

  const vault = await getVaultSessionAccess();
  return { ...vault, isAdmin: false };
};

export const getCatalogAccessFromRequest = async (request: Request): Promise<CatalogAccess> => {
  if (await verifyAdminSession(request)) {
    return catalogAccessForAdmin();
  }

  const vault = await getVaultSessionAccessFromRequest(request);
  return { ...vault, isAdmin: false };
};
