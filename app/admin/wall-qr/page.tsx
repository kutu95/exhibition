import { fetchAdminJson } from "../_lib/fetch-admin";
import { WallQrLabelsClient, type WallQrProduct } from "../../../components/admin/WallQrLabelsClient";

type ProductListItem = {
  title: string;
  slug?: string | null;
  product_type: string;
  location_tag: string | null;
  is_available: boolean;
  visibility?: "public" | "vault";
};

export default async function AdminWallQrPage() {
  const products = await fetchAdminJson<ProductListItem[]>("/api/admin/products");
  const labels: WallQrProduct[] = products
    .filter((product) => product.product_type === "print" && product.is_available && product.slug)
    .map((product) => ({
      title: product.title,
      slug: product.slug ?? "",
      location_tag: product.location_tag,
      visibility: product.visibility ?? "public",
    }));

  return <WallQrLabelsClient products={labels} />;
}
