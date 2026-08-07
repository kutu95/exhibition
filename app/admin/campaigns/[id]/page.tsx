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
  audience_counts?: {
    subscribers: number;
    talk_registrations: number;
  };
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
    audience_counts: { subscribers: 0, talk_registrations: 0 },
  }));

  const counts = list.audience_counts ?? {
    subscribers: list.audience_count,
    talk_registrations: 0,
  };

  return (
    <CampaignEditorClient
      campaign={{
        ...detail.campaign,
        audience:
          detail.campaign.audience === "talk_registrations" ? "talk_registrations" : "subscribers",
      }}
      stats={detail.stats}
      audienceCounts={counts}
    />
  );
}
