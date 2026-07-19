import { withTransaction } from "./postgres";
import { stripe } from "./stripe";

export type RegisterPrintProductPayload = {
  title: string;
  slug: string;
  description: string | null;
  location_tag: string | null;
  installation_tag: "Cubarama" | "Captain Godfrey AI" | "Drift" | null;
  photo_type_tag: "Still camera" | "Drone" | "Underwater" | null;
  is_featured: boolean;
  edition_size: number;
  master_filename: string;
  web_image_url: string;
  theme_ids?: string[];
  variant_template_ids?: string[];
  variant_template_prices?: Record<string, number>;
};

type ProductRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  product_type: "print";
  location_tag: string | null;
  installation_tag: string | null;
  photo_type_tag: string | null;
  is_available: boolean;
  is_featured: boolean;
  created_at: string;
};

type VariantRow = {
  id: string;
  product_id: string;
  variant_label: string;
  price_aud: number;
  edition_size: number | null;
  edition_number: number | null;
  stripe_price_id: string | null;
  stock_quantity: number | null;
  is_active: boolean;
  created_at: string;
  width_mm: number | null;
  height_mm: number | null;
  border_mm: number;
  paper_type: string | null;
  print_type: string | null;
  master_filename: string | null;
};

type ImageRow = {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
};

export const isStripeConfigurationError = (error: unknown): boolean =>
  error instanceof Error &&
  (
    error.message === "Missing STRIPE_SECRET_KEY" ||
    "type" in error && error.type === "StripeAuthenticationError"
  );

export const isDuplicateProductSlugError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "23505" &&
  "constraint" in error &&
  error.constraint === "products_slug_key";

export const normalizeManagedImageUrl = (value: string): string => {
  if (value.startsWith("/images/")) {
    return value;
  }

  try {
    const url = new URL(value);
    if (url.pathname.startsWith("/images/")) {
      return url.pathname;
    }
  } catch {
    // Leave non-URL values untouched; callers validate external URLs where needed.
  }

  return value;
};

export const registerPrintProduct = async (payload: RegisterPrintProductPayload) => {
  const webImageUrl = normalizeManagedImageUrl(payload.web_image_url);
  const selectedTemplateIds = payload.variant_template_ids?.length ? payload.variant_template_ids : null;
  const selectedTemplatePrices = JSON.stringify(payload.variant_template_prices ?? {});

  return withTransaction(async (client) => {
    const { rows: productRows } = await client.query<ProductRow>(
      `
        insert into exhibition.products (
          title,
          slug,
          description,
          product_type,
          location_tag,
          installation_tag,
          photo_type_tag,
          is_available,
          is_featured
        )
        values ($1, $2, $3, 'print', $4, $5, $6, true, $7)
        returning *
      `,
      [
        payload.title,
        payload.slug,
        payload.description,
        payload.location_tag,
        payload.installation_tag,
        payload.photo_type_tag,
        payload.is_featured,
      ],
    );

    const product = productRows[0];

    if (payload.theme_ids?.length) {
      await client.query(
        `
          insert into exhibition.product_themes (product_id, theme_id)
          select $1, unnest($2::uuid[])
        `,
        [product.id, payload.theme_ids],
      );
    }

    const { rows: variantRows } = await client.query<VariantRow>(
      `
        insert into exhibition.product_variants (
          product_id,
          variant_label,
          width_mm,
          height_mm,
          border_mm,
          paper_type,
          print_type,
          price_aud,
          edition_size,
          master_filename,
          source_print_profile_id,
          destination_print_profile_id,
          stripe_price_id,
          stock_quantity,
          is_active,
          tier_label,
          finish,
          is_framed,
          frame_type,
          print_dpi,
          lab_cost_aud,
          suggested_retail_min_aud,
          suggested_retail_max_aud,
          turnaround_days_min,
          turnaround_days_max,
          shipping_class,
          fulfilment_notes,
          aspect_ratio,
          canvas_wrap_mm,
          wrap_style,
          front_face_width_mm,
          front_face_height_mm
        )
        select
          $1,
          vt.variant_label,
          vt.width_mm,
          vt.height_mm,
          vt.border_mm,
          vt.paper_type,
          vt.print_type,
          coalesce(($5::jsonb ->> vt.id::text)::integer, vt.base_price_aud),
          coalesce(vt.edition_size, $2),
          $3,
          null,
          null,
          null,
          null,
          true,
          vt.tier_label,
          vt.finish,
          vt.is_framed,
          vt.frame_type,
          vt.print_dpi,
          vt.lab_cost_aud,
          vt.suggested_retail_min_aud,
          vt.suggested_retail_max_aud,
          vt.turnaround_days_min,
          vt.turnaround_days_max,
          vt.shipping_class,
          vt.fulfilment_notes,
          vt.aspect_ratio,
          vt.canvas_wrap_mm,
          vt.wrap_style,
          vt.front_face_width_mm,
          vt.front_face_height_mm
        from exhibition.variant_templates vt
        where vt.is_active = true
          and ($4::uuid[] is null or vt.id = any($4::uuid[]))
        order by vt.sort_order asc, vt.created_at asc
        returning *
      `,
      [product.id, payload.edition_size, payload.master_filename, selectedTemplateIds, selectedTemplatePrices],
    );

    if (variantRows.length === 0) {
      throw new Error("NO_ACTIVE_VARIANT_TEMPLATES");
    }

    const { rows: imageRows } = await client.query<ImageRow>(
      `
        insert into exhibition.product_images (
          product_id,
          image_url,
          alt_text,
          is_primary,
          sort_order
        )
        values ($1, $2, $3, true, 0)
        returning *
      `,
      [product.id, webImageUrl, payload.title],
    );

    const variantsWithStripePrices = [];

    for (const variant of variantRows) {
      const stripeProduct = await stripe.products.create({
        name: `${product.title} — ${variant.variant_label}`,
        metadata: {
          product_id: product.id,
          variant_id: variant.id,
        },
      });

      const stripePrice = await stripe.prices.create({
        unit_amount: variant.price_aud,
        currency: "aud",
        product: stripeProduct.id,
        metadata: {
          variant_id: variant.id,
        },
      });

      await client.query(
        `
          update exhibition.product_variants
          set stripe_price_id = $1
          where id = $2
        `,
        [stripePrice.id, variant.id],
      );

      variantsWithStripePrices.push({
        ...variant,
        stripe_price_id: stripePrice.id,
      });
    }

    return {
      ...product,
      product_variants: variantsWithStripePrices,
      product_images: imageRows,
    };
  });
};
