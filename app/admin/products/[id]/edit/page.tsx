import { notFound } from "next/navigation";

import { ProductEditorForm } from "../../../../../components/admin/ProductEditorForm";
import { fetchAdminJson } from "../../../_lib/fetch-admin";

type ProductDetailResponse = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  product_type: "print" | "merchandise";
  location_tag: string | null;
  installation_tag: string | null;
  is_available: boolean;
  is_featured: boolean;
  product_variants: Array<{
    id: string;
    variant_label: string;
    price_aud: number;
    edition_size: number | null;
    stock_quantity: number | null;
    stripe_price_id: string | null;
    is_active: boolean;
    has_order_items: boolean;
  }>;
  product_images: Array<{
    id: string;
    image_url: string;
    alt_text: string | null;
    sort_order: number;
    is_primary: boolean;
  }>;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminEditProductPage({ params }: PageProps) {
  const { id } = await params;

  let product: ProductDetailResponse;
  try {
    product = await fetchAdminJson<ProductDetailResponse>(`/api/admin/products/${id}`);
  } catch {
    notFound();
  }

  return (
    <ProductEditorForm
      mode="edit"
      initialData={{
        id: product.id,
        title: product.title,
        slug: product.slug,
        description: product.description ?? "",
        product_type: product.product_type,
        location_tag: product.location_tag ?? "",
        installation_tag: product.installation_tag ?? "",
        is_available: product.is_available,
        is_featured: product.is_featured,
        variants: product.product_variants.map((variant) => ({
          id: variant.id,
          has_order_items: variant.has_order_items,
          variant_label: variant.variant_label,
          price_dollars: (variant.price_aud / 100).toFixed(2),
          edition_size: variant.edition_size?.toString() ?? "",
          stock_quantity: variant.stock_quantity?.toString() ?? "",
          stripe_price_id: variant.stripe_price_id ?? "",
          is_active: variant.is_active,
        })),
        images: product.product_images.map((image) => ({
          id: image.id,
          image_url: image.image_url,
          alt_text: image.alt_text ?? "",
          sort_order: image.sort_order.toString(),
          is_primary: image.is_primary,
        })),
      }}
    />
  );
}
