import type { ProductVisibility } from "./supabase/types";
import { supabaseAdmin } from "./supabase/admin";

export type Gallery = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
};

export const productGalleryFields = (
  galleryId: string | null | undefined,
): { visibility: ProductVisibility; gallery_id: string | null } => ({
  visibility: galleryId ? "vault" : "public",
  gallery_id: galleryId ?? null,
});

export const parseGalleryId = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const resolveProductGallery = async (
  galleryId: string | null | undefined,
  visibility?: ProductVisibility,
): Promise<{ visibility: ProductVisibility; gallery_id: string | null } | { error: string }> => {
  const resolvedId = visibility === "public" ? null : galleryId ?? null;
  if (visibility === "vault" && !resolvedId) {
    return { error: "Choose a private gallery for vault products." };
  }
  if (!resolvedId) {
    return productGalleryFields(null);
  }

  const { data, error } = await supabaseAdmin.from("galleries").select("id").eq("id", resolvedId).maybeSingle();
  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: "Gallery not found." };
  }
  return productGalleryFields(resolvedId);
};
