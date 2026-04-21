import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

const locationOptions = ["Calgardup Bay", "Red Gate Beach", "Isaac Rock", "SS Georgette Wreck"] as const;
const installationOptions = ["Cubarama", "Captain Godfrey AI", "Drift"] as const;

const variantSchema = z.object({
  id: z.string().uuid().optional(),
  variant_label: z.string().min(1),
  price_aud: z.number().int().nonnegative(),
  edition_size: z.number().int().positive().nullable(),
  stock_quantity: z.number().int().nonnegative().nullable(),
  stripe_price_id: z.string().nullable(),
  is_active: z.boolean(),
});

const imageSchema = z.object({
  id: z.string().uuid().optional(),
  image_url: z.string().url(),
  alt_text: z.string().nullable(),
  sort_order: z.number().int(),
  is_primary: z.boolean(),
});

const productUpdateSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  product_type: z.enum(["print", "merchandise"]),
  location_tag: z.enum(locationOptions).nullable(),
  installation_tag: z.enum(installationOptions).nullable(),
  is_available: z.boolean(),
  is_featured: z.boolean(),
  variants: z.array(variantSchema).min(1),
  images: z.array(imageSchema),
});

type RouteContext = {
  params: Promise<{ id: string }>;
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

  const [{ data: variants, error: variantsError }, { data: images, error: imagesError }] =
    await Promise.all([
      supabaseAdmin.from("product_variants").select("*").eq("product_id", id).order("created_at"),
      supabaseAdmin.from("product_images").select("*").eq("product_id", id).order("sort_order"),
    ]);

  if (variantsError || imagesError) {
    return NextResponse.json(
      { error: variantsError?.message ?? imagesError?.message ?? "Failed to load product assets." },
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

  return NextResponse.json({ success: true });
}
