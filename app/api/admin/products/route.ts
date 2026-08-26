import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { resolveProductGallery } from "../../../../lib/galleries";
import { handleRouteError } from "../../../../lib/api-route-errors";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { isValidProductImageUrl } from "../../../../lib/utils/site-content-image";

const photoTypeOptions = ["Still camera", "Drone", "Underwater"] as const;

const variantSchema = z.object({
  id: z.string().uuid().optional(),
  variant_label: z.string().min(1),
  price_aud: z.number().int().nonnegative(),
  edition_size: z.number().int().positive().nullable(),
  stock_quantity: z.number().int().nonnegative().nullable(),
  stripe_price_id: z.string().nullable(),
  width_mm: z.number().int().positive().nullable(),
  height_mm: z.number().int().positive().nullable(),
  border_mm: z.number().int().nonnegative(),
  paper_type: z.string().nullable(),
  print_type: z.string().nullable(),
  print_dpi: z.number().int().positive().nullable(),
  source_print_profile_id: z.string().uuid().nullable(),
  destination_print_profile_id: z.string().uuid().nullable(),
  tier_label: z.string().nullable(),
  finish: z.string().nullable(),
  is_framed: z.boolean(),
  frame_type: z.string().nullable(),
  lab_cost_aud: z.number().int().nonnegative().nullable(),
  suggested_retail_min_aud: z.number().int().nonnegative().nullable(),
  suggested_retail_max_aud: z.number().int().nonnegative().nullable(),
  turnaround_days_min: z.number().int().positive().nullable(),
  turnaround_days_max: z.number().int().positive().nullable(),
  shipping_class: z.string().nullable(),
  fulfilment_notes: z.string().nullable(),
  fulfilment_provider: z.enum(["posterfactory", "pixelperfect"]).nullable().optional(),
  fulfilment_class: z.enum(["standard", "fine_art", "framed", "canvas"]).nullable().optional(),
  supplier_product_code: z.string().nullable().optional(),
  aspect_ratio: z.string().nullable(),
  canvas_wrap_mm: z.number().int().nonnegative().nullable(),
  wrap_style: z.string().nullable(),
  front_face_width_mm: z.number().int().positive().nullable(),
  front_face_height_mm: z.number().int().positive().nullable(),
  fit_mode: z.enum(["cover_crop", "custom_size"]).default("cover_crop"),
  crop_offset: z.number().min(-1).max(1).default(0),
  size_lock: z.enum(["long_edge", "width", "height"]).nullable(),
  is_active: z.boolean(),
});

const imageSchema = z.object({
  id: z.string().uuid().optional(),
  image_url: z.string().min(1).refine(isValidProductImageUrl, {
    message: "Image URL must be an absolute http(s) URL or a local /images/ path.",
  }),
  alt_text: z.string().nullable(),
  sort_order: z.number().int(),
  is_primary: z.boolean(),
});

const productSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  product_type: z.enum(["print", "merchandise"]),
  location_tag: z.string().nullable(),
  installation_tag: z.string().nullable(),
  photo_type_tag: z.enum(photoTypeOptions).nullable(),
  is_available: z.boolean(),
  is_featured: z.boolean(),
  gallery_id: z.string().uuid().nullable().optional().default(null),
  visibility: z.enum(["public", "vault"]).optional(),
  theme_ids: z.array(z.string().uuid()),
  variants: z.array(variantSchema).min(1),
  images: z.array(imageSchema),
});

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (productsError) {
      return NextResponse.json({ error: productsError.message }, { status: 500 });
    }

    const productIds = (products ?? []).map((product) => product.id);
    const variantsCountMap = new Map<string, number>();
    const imageByProduct = new Map<string, { image_url: string; image_alt: string | null }>();

    if (productIds.length > 0) {
      const [{ data: variants, error: variantsError }, { data: images, error: imagesError }] = await Promise.all([
        supabaseAdmin.from("product_variants").select("product_id").in("product_id", productIds),
        supabaseAdmin
          .from("product_images")
          .select("product_id, image_url, alt_text, is_primary, sort_order")
          .in("product_id", productIds)
          .order("sort_order", { ascending: true }),
      ]);

      if (variantsError) {
        return NextResponse.json({ error: variantsError.message }, { status: 500 });
      }
      if (imagesError) {
        return NextResponse.json({ error: imagesError.message }, { status: 500 });
      }

      (variants ?? []).forEach((variant) => {
        const current = variantsCountMap.get(variant.product_id) ?? 0;
        variantsCountMap.set(variant.product_id, current + 1);
      });

      (images ?? []).forEach((image) => {
        const current = imageByProduct.get(image.product_id);
        if (!current || image.is_primary) {
          imageByProduct.set(image.product_id, {
            image_url: image.image_url,
            image_alt: image.alt_text,
          });
        }
      });
    }

    return NextResponse.json(
      (products ?? []).map((product) => {
        const image = imageByProduct.get(product.id);
        return {
          ...product,
          variants_count: variantsCountMap.get(product.id) ?? 0,
          image_url: image?.image_url ?? null,
          image_alt: image?.image_alt ?? null,
        };
      }),
    );
  } catch (error) {
    return handleRouteError(error, "Admin products list failed");
  }
}

export async function POST(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = productSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product payload." }, { status: 400 });
  }

  const payload = parsed.data;
  const gallery = await resolveProductGallery(payload.gallery_id, payload.visibility);
  if ("error" in gallery) {
    return NextResponse.json({ error: gallery.error }, { status: 400 });
  }

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .insert({
      title: payload.title,
      slug: payload.slug,
      description: payload.description,
      product_type: payload.product_type,
      location_tag: payload.location_tag,
      installation_tag: payload.installation_tag,
      photo_type_tag: payload.photo_type_tag,
      is_available: payload.is_available,
      is_featured: payload.is_featured,
      visibility: gallery.visibility,
      gallery_id: gallery.gallery_id,
    })
    .select("id")
    .single();

  if (productError) {
    return NextResponse.json({ error: productError.message }, { status: 500 });
  }

  const productId = product.id;

  const variantsPayload = payload.variants.map((variant) => ({
    product_id: productId,
    variant_label: variant.variant_label,
    price_aud: variant.price_aud,
    edition_size: variant.edition_size,
    stock_quantity: variant.stock_quantity,
    stripe_price_id: variant.stripe_price_id,
    width_mm: variant.width_mm,
    height_mm: variant.height_mm,
    border_mm: variant.border_mm,
    paper_type: variant.paper_type,
    print_type: variant.print_type,
    print_dpi: variant.print_dpi,
    source_print_profile_id: variant.source_print_profile_id,
    destination_print_profile_id: variant.destination_print_profile_id,
    tier_label: variant.tier_label,
    finish: variant.finish,
    is_framed: variant.is_framed,
    frame_type: variant.frame_type,
    lab_cost_aud: variant.lab_cost_aud,
    suggested_retail_min_aud: variant.suggested_retail_min_aud,
    suggested_retail_max_aud: variant.suggested_retail_max_aud,
    turnaround_days_min: variant.turnaround_days_min,
    turnaround_days_max: variant.turnaround_days_max,
    shipping_class: variant.shipping_class,
    fulfilment_notes: variant.fulfilment_notes,
    fulfilment_provider: variant.fulfilment_provider ?? null,
    fulfilment_class: variant.fulfilment_class ?? null,
    supplier_product_code: variant.supplier_product_code ?? null,
    aspect_ratio: variant.aspect_ratio,
    canvas_wrap_mm: variant.canvas_wrap_mm,
    wrap_style: variant.wrap_style,
    front_face_width_mm: variant.front_face_width_mm,
    front_face_height_mm: variant.front_face_height_mm,
    fit_mode: variant.fit_mode,
    crop_offset: variant.crop_offset,
    size_lock: variant.size_lock,
    is_active: variant.is_active,
  }));

  const imagesPayload = payload.images.map((image) => ({
    product_id: productId,
    image_url: image.image_url,
    alt_text: image.alt_text,
    sort_order: image.sort_order,
    is_primary: image.is_primary,
  }));
  const themesPayload = payload.theme_ids.map((themeId) => ({
    product_id: productId,
    theme_id: themeId,
  }));

  const [{ error: variantsError }, { error: imagesError }, { error: themesError }] = await Promise.all([
    supabaseAdmin.from("product_variants").insert(variantsPayload),
    imagesPayload.length > 0
      ? supabaseAdmin.from("product_images").insert(imagesPayload)
      : Promise.resolve({ error: null }),
    themesPayload.length > 0
      ? supabaseAdmin.from("product_themes").insert(themesPayload)
      : Promise.resolve({ error: null }),
  ]);

  if (variantsError || imagesError || themesError) {
    await supabaseAdmin.from("products").delete().eq("id", productId);
    return NextResponse.json(
      { error: variantsError?.message ?? imagesError?.message ?? themesError?.message ?? "Failed to create product assets." },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: productId });
}
