import { fetchAdminJson } from "../_lib/fetch-admin";
import { ProductsTableClient } from "../../../components/admin/ProductsTableClient";

type ProductListItem = {
  id: string;
  title: string;
  product_type: string;
  location_tag: string | null;
  variants_count: number;
  is_featured: boolean;
  is_available: boolean;
};

export default async function AdminProductsPage() {
  const products = await fetchAdminJson<ProductListItem[]>("/api/admin/products");
  return <ProductsTableClient products={products} />;
}
