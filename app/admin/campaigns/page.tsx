import { CampaignsTableClient } from "../../../components/admin/CampaignsTableClient";
import { fetchAdminJson } from "../_lib/fetch-admin";
import type { EmailCampaign } from "../../../lib/supabase/types";

type CampaignsResponse = {
  campaigns: EmailCampaign[];
  audience_count: number;
};

export default async function AdminCampaignsPage() {
  const data = await fetchAdminJson<CampaignsResponse>("/api/admin/campaigns");

  return (
    <CampaignsTableClient campaigns={data.campaigns} audienceCount={data.audience_count} />
  );
}
