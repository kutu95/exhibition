import { VaultAdminClient } from "../../../components/admin/VaultAdminClient";
import type { VaultAccessRequest, VaultInvite } from "../../../lib/supabase/types";
import { fetchAdminJson } from "../_lib/fetch-admin";

type InviteListItem = Omit<VaultInvite, "token_hash">;

export default async function AdminVaultPage() {
  const [requests, invites] = await Promise.all([
    fetchAdminJson<VaultAccessRequest[]>("/api/admin/vault/requests"),
    fetchAdminJson<InviteListItem[]>("/api/admin/vault/invites"),
  ]);

  return (
    <div>
      <h1>Private collections</h1>
      <p>
        Review access requests and issue links that unlock vault photographs in the shop. Public visitors never see
        vault products unless they open a valid link.
      </p>
      <VaultAdminClient initialRequests={requests} initialInvites={invites} />
    </div>
  );
}
