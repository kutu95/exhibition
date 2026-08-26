import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from("order_items")
    .select("id,order_id,variant_id,quantity,unit_price_aud,edition_number_assigned,fulfilment_status")
    .eq("order_id", id);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  const variantIds = (items ?? []).map((item) => item.variant_id);
  const variantsById = new Map<
    string,
    {
      variant_label: string;
      edition_size: number | null;
      width_mm: number | null;
      height_mm: number | null;
      paper_type: string | null;
      lab_cost_aud: number | null;
      product_title: string;
      product_slug: string | null;
      image_url: string | null;
      image_alt: string | null;
    }
  >();

  type ProductImageRow = {
    image_url: string;
    alt_text: string | null;
    is_primary: boolean | null;
    sort_order: number | null;
  };

  type ProductRow = {
    title: string | null;
    slug: string | null;
    product_images: ProductImageRow[] | ProductImageRow | null;
  };

  const pickPrimaryImage = (
    images: ProductImageRow[] | ProductImageRow | null | undefined,
  ): { image_url: string; image_alt: string | null } | null => {
    const list = Array.isArray(images) ? images : images ? [images] : [];
    if (list.length === 0) return null;
    const sorted = [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const primary = sorted.find((image) => image.is_primary) ?? sorted[0];
    return primary ? { image_url: primary.image_url, image_alt: primary.alt_text } : null;
  };

  if (variantIds.length > 0) {
    const { data: variants, error: variantsError } = await supabaseAdmin
      .from("product_variants")
      .select("id,variant_label,edition_size,width_mm,height_mm,paper_type,lab_cost_aud,products(title,slug,product_images(image_url,alt_text,is_primary,sort_order))")
      .in("id", variantIds);

    if (variantsError) {
      return NextResponse.json({ error: variantsError.message }, { status: 500 });
    }

    (variants ?? []).forEach((variant) => {
      const products = (Array.isArray(variant.products) ? variant.products[0] : variant.products) as
        | ProductRow
        | null;
      const image = pickPrimaryImage(products?.product_images);
      variantsById.set(variant.id, {
        variant_label: variant.variant_label,
        edition_size: variant.edition_size,
        width_mm: variant.width_mm,
        height_mm: variant.height_mm,
        paper_type: variant.paper_type,
        lab_cost_aud: variant.lab_cost_aud,
        product_title: products?.title ?? "Unknown product",
        product_slug: products?.slug ?? null,
        image_url: image?.image_url ?? null,
        image_alt: image?.image_alt ?? null,
      });
    });
  }

  const enrichedItems = (items ?? []).map((item) => {
    const variant = variantsById.get(item.variant_id);
    return {
      ...item,
      variant_label: variant?.variant_label ?? "Unknown variant",
      edition_size: variant?.edition_size ?? null,
      width_mm: variant?.width_mm ?? null,
      height_mm: variant?.height_mm ?? null,
      paper_type: variant?.paper_type ?? null,
      lab_cost_aud: variant?.lab_cost_aud ?? null,
      product_title: variant?.product_title ?? "Unknown product",
      product_slug: variant?.product_slug ?? null,
      image_url: variant?.image_url ?? null,
      image_alt: variant?.image_alt ?? null,
    };
  });

  return NextResponse.json({
    order,
    items: enrichedItems,
  });
}
