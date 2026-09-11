import { VaultAdminClient } from "../../../components/admin/VaultAdminClient";
import type { Gallery } from "../../../lib/galleries";
import type { VaultAccessRequest, VaultInvite } from "../../../lib/supabase/types";
import { fetchAdminJson } from "../_lib/fetch-admin";

type InviteListItem = Omit<VaultInvite, "token_hash">;

export default async function AdminVaultPage() {
  const [requests, invites, galleries] = await Promise.all([
    fetchAdminJson<VaultAccessRequest[]>("/api/admin/vault/requests"),
    fetchAdminJson<InviteListItem[]>("/api/admin/vault/invites"),
    fetchAdminJson<Gallery[]>("/api/admin/galleries"),
  ]);

  return (
    <div>
      <h1>Private collections</h1>
      <p>
        Review access requests and issue links that unlock one private gallery in the shop. Public visitors can open a
        product page to view the photograph, description, and audio, but size and ordering stay locked unless they have
        a valid link for that gallery.
      </p>
      <VaultAdminClient initialRequests={requests} initialInvites={invites} initialGalleries={galleries} />
    </div>
  );
}
