import { notFound } from "next/navigation";

import { ProductEditorForm } from "../../../../../components/admin/ProductEditorForm";
import type { Gallery } from "../../../../../lib/galleries";
import { getMasterFileDimensions } from "../../../../../lib/master-files";
import type { Theme, VariantTemplate } from "../../../../../lib/supabase/types";
import { fetchAdminJson } from "../../../_lib/fetch-admin";

type ProductDetailResponse = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  product_type: "print" | "merchandise";
  location_tag: string | null;
  installation_tag: string | null;
  photo_type_tag: string | null;
  is_available: boolean;
  is_featured: boolean;
  visibility?: "public" | "vault";
  gallery_id?: string | null;
  product_variants: Array<{
    id: string;
    variant_label: string;
    price_aud: number;
    edition_size: number | null;
    stock_quantity: number | null;
    stripe_price_id: string | null;
    width_mm: number | null;
    height_mm: number | null;
    border_mm: number | null;
    paper_type: string | null;
    print_type: string | null;
    print_dpi: number | null;
    source_print_profile_id: string | null;
    destination_print_profile_id: string | null;
    tier_label: string | null;
    finish: string | null;
    is_framed: boolean;
    frame_type: string | null;
    lab_cost_aud: number | null;
    suggested_retail_min_aud: number | null;
    suggested_retail_max_aud: number | null;
    turnaround_days_min: number | null;
    turnaround_days_max: number | null;
    shipping_class: string | null;
    fulfilment_notes: string | null;
    aspect_ratio: string | null;
    canvas_wrap_mm: number | null;
    wrap_style: string | null;
    front_face_width_mm: number | null;
    front_face_height_mm: number | null;
    master_filename: string | null;
    fit_mode?: "cover_crop" | "custom_size" | null;
    crop_offset?: number | null;
    size_lock?: "long_edge" | "width" | "height" | null;
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
  product_themes: Array<{ theme_id: string }>;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminEditProductPage({ params }: PageProps) {
  const { id } = await params;

  let product: ProductDetailResponse;
  let variantTemplates: VariantTemplate[];
  let themes: Theme[];
  let galleries: Gallery[];
  try {
    [product, variantTemplates, themes, galleries] = await Promise.all([
      fetchAdminJson<ProductDetailResponse>(`/api/admin/products/${id}`),
      fetchAdminJson<VariantTemplate[]>("/api/admin/variant-templates"),
      fetchAdminJson<Theme[]>("/api/admin/themes"),
      fetchAdminJson<Gallery[]>("/api/admin/galleries"),
    ]);
  } catch {
    notFound();
  }

  const masterFilename =
    product.product_variants.find((variant) => variant.master_filename)?.master_filename ?? null;
  const masterDimensions = masterFilename
    ? await getMasterFileDimensions(masterFilename).catch(() => null)
    : null;

  return (
    <ProductEditorForm
      mode="edit"
      masterPixelWidth={masterDimensions?.pixel_width ?? null}
      masterPixelHeight={masterDimensions?.pixel_height ?? null}
      masterFilename={masterFilename}
      initialData={{
        id: product.id,
        title: product.title,
        slug: product.slug,
        description: product.description ?? "",
        product_type: product.product_type,
        location_tag: product.location_tag ?? "",
        installation_tag: product.installation_tag ?? "",
        photo_type_tag: product.photo_type_tag ?? "",
        is_available: product.is_available,
        is_featured: product.is_featured,
        gallery_id: product.gallery_id ?? null,
        theme_ids: product.product_themes.map((assignment) => assignment.theme_id),
        variants: product.product_variants.map((variant) => ({
          id: variant.id,
          has_order_items: variant.has_order_items,
          template_id: "",
          variant_label: variant.variant_label,
          price_dollars: (variant.price_aud / 100).toFixed(2),
          edition_size: variant.edition_size?.toString() ?? "",
          stock_quantity: variant.stock_quantity?.toString() ?? "",
          stripe_price_id: variant.stripe_price_id ?? "",
          width_mm: variant.width_mm?.toString() ?? "",
          height_mm: variant.height_mm?.toString() ?? "",
          border_mm: variant.border_mm?.toString() ?? "0",
          paper_type: variant.paper_type ?? "",
          print_type: variant.print_type ?? "",
          print_dpi: variant.print_dpi?.toString() ?? "300",
          source_print_profile_id: variant.source_print_profile_id ?? "",
          destination_print_profile_id: variant.destination_print_profile_id ?? "",
          tier_label: variant.tier_label ?? "",
          finish: variant.finish ?? "",
          is_framed: variant.is_framed,
          frame_type: variant.frame_type ?? "",
          lab_cost_dollars: variant.lab_cost_aud === null ? "" : (variant.lab_cost_aud / 100).toFixed(2),
          suggested_retail_min_dollars:
            variant.suggested_retail_min_aud === null ? "" : (variant.suggested_retail_min_aud / 100).toFixed(2),
          suggested_retail_max_dollars:
            variant.suggested_retail_max_aud === null ? "" : (variant.suggested_retail_max_aud / 100).toFixed(2),
          turnaround_days_min: variant.turnaround_days_min?.toString() ?? "",
          turnaround_days_max: variant.turnaround_days_max?.toString() ?? "",
          shipping_class: variant.shipping_class ?? "",
          fulfilment_notes: variant.fulfilment_notes ?? "",
          aspect_ratio: variant.aspect_ratio ?? "",
          canvas_wrap_mm: variant.canvas_wrap_mm?.toString() ?? "",
          wrap_style: variant.wrap_style ?? "",
          front_face_width_mm: variant.front_face_width_mm?.toString() ?? "",
          front_face_height_mm: variant.front_face_height_mm?.toString() ?? "",
          fit_mode: variant.fit_mode === "custom_size" ? "custom_size" : "cover_crop",
          crop_offset: String(variant.crop_offset ?? 0),
          size_lock:
            variant.size_lock === "long_edge" || variant.size_lock === "width" || variant.size_lock === "height"
              ? variant.size_lock
              : "",
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
      variantTemplates={variantTemplates}
      themes={themes}
      galleries={galleries}
    />
  );
}
