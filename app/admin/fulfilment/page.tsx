import {
  FulfilmentDashboardClient,
  type FulfilmentDashboardItem,
} from "../../../components/admin/FulfilmentDashboardClient";
import { fetchAdminJson } from "../_lib/fetch-admin";

type FulfilmentQueuePayload = {
  items: FulfilmentDashboardItem[];
  fetched_at: string;
};

export default async function AdminFulfilmentPage() {
  const payload = await fetchAdminJson<FulfilmentQueuePayload>("/api/admin/fulfilment/queue");

  return (
    <div>
      <h1>Fulfilment</h1>
      <p>Process print orders, prepare Pixel Perfect submissions, and manage shipping updates.</p>
      <FulfilmentDashboardClient items={payload.items} fetchedAt={payload.fetched_at} />
    </div>
  );
}
