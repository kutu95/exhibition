import { CampaignsTableClient } from "../../../components/admin/CampaignsTableClient";
import { fetchAdminJson } from "../_lib/fetch-admin";
import type { EmailCampaign } from "../../../lib/supabase/types";

type CampaignsResponse = {
  campaigns: EmailCampaign[];
  audience_count: number;
  audience_counts?: {
    subscribers: number;
    talk_registrations: number;
  };
};

export default async function AdminCampaignsPage() {
  const data = await fetchAdminJson<CampaignsResponse>("/api/admin/campaigns");
  const counts = data.audience_counts ?? {
    subscribers: data.audience_count,
    talk_registrations: 0,
  };

  return (
    <CampaignsTableClient
      campaigns={data.campaigns}
      audienceCount={counts.subscribers}
      talkAudienceCount={counts.talk_registrations}
    />
  );
}
