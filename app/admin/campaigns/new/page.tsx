import { redirect } from "next/navigation";

/** Creating a campaign is done via POST from the list page. */
export default function AdminCampaignNewPage() {
  redirect("/admin/campaigns");
}
