import { fetchAdminJson } from "../_lib/fetch-admin";
import { ProductsTableClient } from "../../../components/admin/ProductsTableClient";
import type { Gallery } from "../../../lib/galleries";

type ProductListItem = {
  id: string;
  title: string;
  product_type: string;
  location_tag: string | null;
  variants_count: number;
  is_featured: boolean;
  is_available: boolean;
  gallery_id: string | null;
  visibility?: "public" | "vault";
  image_url: string | null;
  image_alt: string | null;
};

export default async function AdminProductsPage() {
  const [products, galleries] = await Promise.all([
    fetchAdminJson<ProductListItem[]>("/api/admin/products"),
    fetchAdminJson<Gallery[]>("/api/admin/galleries"),
  ]);
  return <ProductsTableClient products={products} galleries={galleries} />;
}
