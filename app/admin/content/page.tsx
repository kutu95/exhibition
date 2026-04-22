import { ContentAdminClient } from "../../../components/admin/ContentAdminClient";
import { fetchAdminJson } from "../_lib/fetch-admin";
import type { MediaFile, SiteContent } from "../../../lib/supabase/types";

type SiteContentWithMedia = SiteContent & {
  media_files: MediaFile | null;
};

export default async function AdminContentPage() {
  const [contentRows, mediaFiles] = await Promise.all([
    fetchAdminJson<SiteContentWithMedia[]>("/api/admin/content"),
    fetchAdminJson<MediaFile[]>("/api/admin/media"),
  ]);

  return <ContentAdminClient initialContentRows={contentRows} initialMediaFiles={mediaFiles} />;
}
