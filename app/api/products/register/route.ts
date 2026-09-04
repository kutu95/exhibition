import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveProductGallery } from "../../../../lib/galleries";
import { verifyBearerApiKey } from "../../../../lib/api-key-auth";
import {
  isDuplicateProductSlugError,
  isStripeConfigurationError,
  registerPrintProduct,
} from "../../../../lib/product-registration";

export const runtime = "nodejs";

const installationOptions = ["Cubarama", "Captain Godfrey AI", "Drift"] as const;
const photoTypeOptions = ["Still camera", "Drone", "Underwater"] as const;

const registerProductSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  location_tag: z.string().nullable(),
  credit_attribution: z.string().nullable().optional(),
  installation_tag: z.enum(installationOptions).nullable(),
  photo_type_tag: z.enum(photoTypeOptions).nullable().default(null),
  is_featured: z.boolean(),
  visibility: z.enum(["public", "vault"]).optional(),
  gallery_id: z.string().uuid().nullable().optional().default(null),
  edition_size: z.number().int().positive(),
  master_filename: z.string().min(1),
  web_image_url: z.string().url(),
  master_pixel_width: z.number().int().positive().optional(),
  master_pixel_height: z.number().int().positive().optional(),
  theme_ids: z.array(z.string().uuid()).optional(),
});

export async function POST(request: Request) {
  if (!verifyBearerApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = registerProductSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product registration payload." }, { status: 400 });
  }

  const payload = parsed.data;
  const gallery = await resolveProductGallery(payload.gallery_id, payload.visibility);
  if ("error" in gallery) {
    return NextResponse.json({ error: gallery.error }, { status: 400 });
  }

  try {
    const created = await registerPrintProduct({
      ...payload,
      gallery_id: gallery.gallery_id,
      visibility: gallery.visibility,
    });

    return NextResponse.json(
      {
        ok: true,
        product_id: created.id,
        variants_created: created.product_variants.length,
        ...created,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NO_ACTIVE_VARIANT_TEMPLATES") {
      return NextResponse.json({ error: "No active variant templates found." }, { status: 500 });
    }

    console.error("Product registration failed", error);
    if (isStripeConfigurationError(error)) {
      return NextResponse.json(
        { error: "Stripe is not configured correctly for product registration." },
        { status: 500 },
      );
    }

    if (isDuplicateProductSlugError(error)) {
      return NextResponse.json(
        { error: `A product with slug "${payload.slug}" already exists.` },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: "Failed to register product." }, { status: 500 });
  }
}
