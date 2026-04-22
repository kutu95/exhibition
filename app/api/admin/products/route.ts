import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

const locationOptions = ["Calgardup Bay", "Redgate Beach", "Isaac Rock", "SS Georgette Wreck"] as const;
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

const productSchema = z.object({
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

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: products, error: productsError } = await supabaseAdmin
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 500 });
  }

  const productIds = (products ?? []).map((product) => product.id);
  const variantsCountMap = new Map<string, number>();

  if (productIds.length > 0) {
    const { data: variants, error: variantsError } = await supabaseAdmin
      .from("product_variants")
      .select("product_id")
      .in("product_id", productIds);

    if (variantsError) {
      return NextResponse.json({ error: variantsError.message }, { status: 500 });
    }

    (variants ?? []).forEach((variant) => {
      const current = variantsCountMap.get(variant.product_id) ?? 0;
      variantsCountMap.set(variant.product_id, current + 1);
    });
  }

  return NextResponse.json(
    (products ?? []).map((product) => ({
      ...product,
      variants_count: variantsCountMap.get(product.id) ?? 0,
    })),
  );
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
  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .insert({
      title: payload.title,
      slug: payload.slug,
      description: payload.description,
      product_type: payload.product_type,
      location_tag: payload.location_tag,
      installation_tag: payload.installation_tag,
      is_available: payload.is_available,
      is_featured: payload.is_featured,
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
    is_active: variant.is_active,
  }));

  const imagesPayload = payload.images.map((image) => ({
    product_id: productId,
    image_url: image.image_url,
    alt_text: image.alt_text,
    sort_order: image.sort_order,
    is_primary: image.is_primary,
  }));

  const [{ error: variantsError }, { error: imagesError }] = await Promise.all([
    supabaseAdmin.from("product_variants").insert(variantsPayload),
    imagesPayload.length > 0
      ? supabaseAdmin.from("product_images").insert(imagesPayload)
      : Promise.resolve({ error: null }),
  ]);

  if (variantsError || imagesError) {
    await supabaseAdmin.from("products").delete().eq("id", productId);
    return NextResponse.json(
      { error: variantsError?.message ?? imagesError?.message ?? "Failed to create product assets." },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: productId });
}
