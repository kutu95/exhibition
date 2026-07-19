import fs from "node:fs/promises";

import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { resolveReadableMediaPath } from "../../../../../lib/media-storage";
import { stripe } from "../../../../../lib/stripe";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";
import { isValidProductImageUrl } from "../../../../../lib/utils/site-content-image";

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

const productUpdateSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  product_type: z.enum(["print", "merchandise"]),
  location_tag: z.string().nullable(),
  installation_tag: z.string().nullable(),
  photo_type_tag: z.enum(photoTypeOptions).nullable(),
  is_available: z.boolean(),
  is_featured: z.boolean(),
  theme_ids: z.array(z.string().uuid()),
  variants: z.array(variantSchema).min(1),
  images: z.array(imageSchema),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

type VariantStripeRow = {
  id: string;
  stripe_price_id: string | null;
};

type ProductImageRow = {
  id: string;
  image_url: string;
};

const getImageUrlPath = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/images/")) return trimmed;

  try {
    const parsed = new URL(trimmed);
    return parsed.pathname.startsWith("/images/") ? parsed.pathname : null;
  } catch {
    return null;
  }
};

const archiveStripeCatalogue = async (variants: VariantStripeRow[]) => {
  const archivedProductIds = new Set<string>();

  for (const variant of variants) {
    if (!variant.stripe_price_id) continue;

    const price = await stripe.prices.retrieve(variant.stripe_price_id);
    await stripe.prices.update(variant.stripe_price_id, { active: false });

    const stripeProductId = typeof price.product === "string" ? price.product : price.product.id;
    if (!archivedProductIds.has(stripeProductId)) {
      await stripe.products.update(stripeProductId, { active: false });
      archivedProductIds.add(stripeProductId);
    }
  }

  return {
    archived_prices: variants.filter((variant) => variant.stripe_price_id).length,
    archived_products: archivedProductIds.size,
  };
};

const deleteProductImageFiles = async (images: ProductImageRow[]) => {
  const urlPaths = Array.from(new Set(images.flatMap((image) => {
    const urlPath = getImageUrlPath(image.image_url);
    return urlPath ? [urlPath] : [];
  })));

  let deletedFiles = 0;
  let deletedMediaRows = 0;

  for (const urlPath of urlPaths) {
    const { data: media, error: mediaError } = await supabaseAdmin
      .from("media_files")
      .select("id,url_path")
      .eq("url_path", urlPath)
      .maybeSingle();

    if (mediaError) {
      throw new Error(mediaError.message);
    }

    if (media) {
      const { data: siteContentReferences, error: siteContentError } = await supabaseAdmin
        .from("site_content")
        .select("id")
        .eq("media_file_id", media.id)
        .limit(1);

      if (siteContentError) {
        throw new Error(siteContentError.message);
      }

      if ((siteContentReferences ?? []).length > 0) {
        continue;
      }

      const { error: deleteMediaError } = await supabaseAdmin
        .from("media_files")
        .delete()
        .eq("id", media.id);

      if (deleteMediaError) {
        throw new Error(deleteMediaError.message);
      }
      deletedMediaRows += 1;
    }

    const absoluteFilePath = resolveReadableMediaPath(urlPath);
    await fs.unlink(absoluteFilePath).then(
      () => {
        deletedFiles += 1;
      },
      (error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") {
          throw error;
        }
      },
    );
  }

  return { deleted_files: deletedFiles, deleted_media_rows: deletedMediaRows };
};

export async function GET(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (productError) {
    return NextResponse.json({ error: productError.message }, { status: 500 });
  }
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const [
    { data: variants, error: variantsError },
    { data: images, error: imagesError },
    { data: themes, error: themesError },
  ] =
    await Promise.all([
      supabaseAdmin.from("product_variants").select("*").eq("product_id", id).order("created_at"),
      supabaseAdmin.from("product_images").select("*").eq("product_id", id).order("sort_order"),
      supabaseAdmin.from("product_themes").select("theme_id").eq("product_id", id),
    ]);

  if (variantsError || imagesError || themesError) {
    return NextResponse.json(
      { error: variantsError?.message ?? imagesError?.message ?? themesError?.message ?? "Failed to load product assets." },
      { status: 500 },
    );
  }

  const variantIds = (variants ?? []).map((variant) => variant.id);
  const referencedVariantIds = new Set<string>();
  if (variantIds.length > 0) {
    const { data: references } = await supabaseAdmin
      .from("order_items")
      .select("variant_id")
      .in("variant_id", variantIds);
    (references ?? []).forEach((row) => referencedVariantIds.add(row.variant_id));
  }

  return NextResponse.json({
    ...product,
    product_variants: (variants ?? []).map((variant) => ({
      ...variant,
      has_order_items: referencedVariantIds.has(variant.id),
    })),
    product_images: images ?? [],
    product_themes: themes ?? [],
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = productUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product payload." }, { status: 400 });
  }

  const payload = parsed.data;

  const { error: updateError } = await supabaseAdmin
    .from("products")
    .update({
      title: payload.title,
      slug: payload.slug,
      description: payload.description,
      product_type: payload.product_type,
      location_tag: payload.location_tag,
      installation_tag: payload.installation_tag,
      photo_type_tag: payload.photo_type_tag,
      is_available: payload.is_available,
      is_featured: payload.is_featured,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const [{ data: existingVariants }, { data: existingImages }] = await Promise.all([
    supabaseAdmin.from("product_variants").select("id").eq("product_id", id),
    supabaseAdmin.from("product_images").select("id").eq("product_id", id),
  ]);

  const submittedVariantIds = new Set(payload.variants.flatMap((variant) => (variant.id ? [variant.id] : [])));
  const submittedImageIds = new Set(payload.images.flatMap((image) => (image.id ? [image.id] : [])));

  const variantIdsToDelete = (existingVariants ?? [])
    .map((variant) => variant.id)
    .filter((variantId) => !submittedVariantIds.has(variantId));

  if (variantIdsToDelete.length > 0) {
    const { data: orderItemsReferences } = await supabaseAdmin
      .from("order_items")
      .select("variant_id")
      .in("variant_id", variantIdsToDelete)
      .limit(1);

    if ((orderItemsReferences ?? []).length > 0) {
      return NextResponse.json(
        { error: "Cannot delete variants referenced by existing order items." },
        { status: 400 },
      );
    }
  }

  const imageIdsToDelete = (existingImages ?? [])
    .map((image) => image.id)
    .filter((imageId) => !submittedImageIds.has(imageId));

  const existingVariantRows = payload.variants.filter((variant) => variant.id);
  const newVariantRows = payload.variants.filter((variant) => !variant.id);
  const existingImageRows = payload.images.filter((image) => image.id);
  const newImageRows = payload.images.filter((image) => !image.id);

  if (existingVariantRows.length > 0) {
    const { error } = await supabaseAdmin
      .from("product_variants")
      .upsert(
        existingVariantRows.map((variant) => ({
          id: variant.id,
          product_id: id,
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
          aspect_ratio: variant.aspect_ratio,
          canvas_wrap_mm: variant.canvas_wrap_mm,
          wrap_style: variant.wrap_style,
          front_face_width_mm: variant.front_face_width_mm,
          front_face_height_mm: variant.front_face_height_mm,
          fit_mode: variant.fit_mode,
          crop_offset: variant.crop_offset,
          size_lock: variant.size_lock,
          is_active: variant.is_active,
        })),
        { onConflict: "id" },
      );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (newVariantRows.length > 0) {
    const { error } = await supabaseAdmin.from("product_variants").insert(
      newVariantRows.map((variant) => ({
        product_id: id,
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
        aspect_ratio: variant.aspect_ratio,
        canvas_wrap_mm: variant.canvas_wrap_mm,
        wrap_style: variant.wrap_style,
        front_face_width_mm: variant.front_face_width_mm,
        front_face_height_mm: variant.front_face_height_mm,
        fit_mode: variant.fit_mode,
        crop_offset: variant.crop_offset,
        size_lock: variant.size_lock,
        is_active: variant.is_active,
      })),
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (existingImageRows.length > 0) {
    const { error } = await supabaseAdmin
      .from("product_images")
      .upsert(
        existingImageRows.map((image) => ({
          id: image.id,
          product_id: id,
          image_url: image.image_url,
          alt_text: image.alt_text,
          sort_order: image.sort_order,
          is_primary: image.is_primary,
        })),
        { onConflict: "id" },
      );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (newImageRows.length > 0) {
    const { error } = await supabaseAdmin.from("product_images").insert(
      newImageRows.map((image) => ({
        product_id: id,
        image_url: image.image_url,
        alt_text: image.alt_text,
        sort_order: image.sort_order,
        is_primary: image.is_primary,
      })),
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (variantIdsToDelete.length > 0) {
    const { error } = await supabaseAdmin.from("product_variants").delete().in("id", variantIdsToDelete);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (imageIdsToDelete.length > 0) {
    const { error } = await supabaseAdmin.from("product_images").delete().in("id", imageIdsToDelete);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { error: deleteThemesError } = await supabaseAdmin
    .from("product_themes")
    .delete()
    .eq("product_id", id);
  if (deleteThemesError) {
    return NextResponse.json({ error: deleteThemesError.message }, { status: 500 });
  }

  if (payload.theme_ids.length > 0) {
    const { error: insertThemesError } = await supabaseAdmin
      .from("product_themes")
      .insert(payload.theme_ids.map((themeId) => ({ product_id: id, theme_id: themeId })));
    if (insertThemesError) {
      return NextResponse.json({ error: insertThemesError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("id,title")
    .eq("id", id)
    .maybeSingle();

  if (productError) {
    return NextResponse.json({ error: productError.message }, { status: 500 });
  }
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const [{ data: variants, error: variantsError }, { data: images, error: imagesError }] =
    await Promise.all([
      supabaseAdmin.from("product_variants").select("id,stripe_price_id").eq("product_id", id),
      supabaseAdmin.from("product_images").select("id,image_url").eq("product_id", id),
    ]);

  if (variantsError || imagesError) {
    return NextResponse.json(
      { error: variantsError?.message ?? imagesError?.message ?? "Failed to load product assets." },
      { status: 500 },
    );
  }

  const variantRows = (variants ?? []) as VariantStripeRow[];
  const imageRows = (images ?? []) as ProductImageRow[];
  const variantIds = variantRows.map((variant) => variant.id);

  const { data: orderReferences, error: orderReferenceError } = variantIds.length > 0
    ? await supabaseAdmin
        .from("order_items")
        .select("id")
        .in("variant_id", variantIds)
        .limit(1)
    : { data: [], error: null };

  if (orderReferenceError) {
    return NextResponse.json({ error: orderReferenceError.message }, { status: 500 });
  }

  let stripeArchiveResult: { archived_prices: number; archived_products: number };
  try {
    stripeArchiveResult = await archiveStripeCatalogue(variantRows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to archive Stripe catalogue entries.";
    return NextResponse.json({ error: `Stripe archival failed: ${message}` }, { status: 502 });
  }

  if ((orderReferences ?? []).length > 0) {
    const [{ error: productArchiveError }, { error: variantArchiveError }] = await Promise.all([
      supabaseAdmin
        .from("products")
        .update({ is_available: false, is_featured: false })
        .eq("id", id),
      supabaseAdmin
        .from("product_variants")
        .update({ is_active: false, stock_quantity: 0 })
        .eq("product_id", id),
    ]);

    if (productArchiveError || variantArchiveError) {
      return NextResponse.json(
        { error: productArchiveError?.message ?? variantArchiveError?.message ?? "Failed to archive product." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      action: "archived",
      ...stripeArchiveResult,
    });
  }

  const { error: deleteProductError } = await supabaseAdmin
    .from("products")
    .delete()
    .eq("id", id);

  if (deleteProductError) {
    return NextResponse.json({ error: deleteProductError.message }, { status: 500 });
  }

  try {
    const fileDeleteResult = await deleteProductImageFiles(imageRows);
    return NextResponse.json({
      success: true,
      action: "deleted",
      ...stripeArchiveResult,
      ...fileDeleteResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete product image files.";
    return NextResponse.json(
      {
        success: true,
        action: "deleted",
        warning: `Product was deleted, but image cleanup failed: ${message}`,
        ...stripeArchiveResult,
      },
      { status: 207 },
    );
  }
}
