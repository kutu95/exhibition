import { fetchAdminJson } from "../_lib/fetch-admin";
import { DiscountCodesClient } from "../../../components/admin/DiscountCodesClient";
import type { DiscountCodeRow } from "../../../lib/discount-codes";

export default async function AdminDiscountCodesPage() {
  const codes = await fetchAdminJson<DiscountCodeRow[]>("/api/admin/discount-codes");
  return <DiscountCodesClient codes={codes} />;
}
