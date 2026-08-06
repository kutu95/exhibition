import { notFound } from "next/navigation";

import { CampaignEditorClient } from "../../../../components/admin/CampaignEditorClient";
import { fetchAdminJson } from "../../_lib/fetch-admin";
import type { EmailCampaign } from "../../../../lib/supabase/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

type CampaignDetailResponse = {
  campaign: EmailCampaign;
  stats: {
    sent: number;
    failed: number;
    skipped: number;
    pending: number;
  };
};

type CampaignsResponse = {
  audience_count: number;
};

export default async function AdminCampaignEditPage({ params }: PageProps) {
  const { id } = await params;

  let detail: CampaignDetailResponse;
  try {
    detail = await fetchAdminJson<CampaignDetailResponse>(`/api/admin/campaigns/${id}`);
  } catch {
    notFound();
  }

  const list = await fetchAdminJson<CampaignsResponse>("/api/admin/campaigns").catch(() => ({
    audience_count: 0,
  }));

  return (
    <CampaignEditorClient
      campaign={detail.campaign}
      stats={detail.stats}
      audienceCount={list.audience_count}
    />
  );
}
