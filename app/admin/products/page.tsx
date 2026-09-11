import { fetchAdminJson } from "../_lib/fetch-admin";
import { ProductsTableClient } from "../../../components/admin/ProductsTableClient";
import type { Gallery } from "../../../lib/galleries";

type ProductListItem = {
  id: string;
  slug: string;
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
  audio_url: string | null;
  audio_duration: string | null;
  audio_transcript: string | null;
};

export default async function AdminProductsPage() {
  const [products, galleries] = await Promise.all([
    fetchAdminJson<ProductListItem[]>("/api/admin/products"),
    fetchAdminJson<Gallery[]>("/api/admin/galleries"),
  ]);
  return <ProductsTableClient products={products} galleries={galleries} />;
}
