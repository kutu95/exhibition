import { withTransaction } from "./postgres";
import {
  describeFramingNote,
  resolvePrintSize,
  type VariantFramingInput,
} from "./print-framing";

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
  visibility?: "public" | "vault";
  theme_ids?: string[];
  variant_template_ids?: string[];
  variant_template_prices?: Record<string, number>;
  /** Per-template framing overrides keyed by template UUID. */
  variant_framing?: Record<string, VariantFramingInput>;
  master_pixel_width?: number | null;
  master_pixel_height?: number | null;
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

type TemplateRow = {
  id: string;
  variant_label: string;
  width_mm: number;
  height_mm: number;
  border_mm: number;
  paper_type: string | null;
  print_type: string | null;
  base_price_aud: number;
  edition_size: number | null;
  tier_label: string | null;
  finish: string | null;
  is_framed: boolean;
  frame_type: string | null;
  print_dpi: number;
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
  const priceOverrides = payload.variant_template_prices ?? {};
  const framingByTemplate = payload.variant_framing ?? {};
  const masterPixelWidth = payload.master_pixel_width ?? null;
  const masterPixelHeight = payload.master_pixel_height ?? null;

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
          is_featured,
          visibility
        )
        values ($1, $2, $3, 'print', $4, $5, $6, true, $7, $8)
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
        payload.visibility ?? "public",
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

    const { rows: templates } = await client.query<TemplateRow>(
      `
        select *
        from exhibition.variant_templates vt
        where vt.is_active = true
          and ($1::uuid[] is null or vt.id = any($1::uuid[]))
        order by vt.sort_order asc, vt.created_at asc
      `,
      [selectedTemplateIds],
    );

    if (templates.length === 0) {
      throw new Error("NO_ACTIVE_VARIANT_TEMPLATES");
    }

    const variantRows: VariantRow[] = [];

    for (const template of templates) {
      const framing = framingByTemplate[template.id] ?? null;
      const resolved = resolvePrintSize({
        templateWidthMm: template.width_mm,
        templateHeightMm: template.height_mm,
        pixelWidth: masterPixelWidth,
        pixelHeight: masterPixelHeight,
        framing,
      });

      const framingNote = describeFramingNote(template.variant_label, resolved);
      const fulfilmentNotes = [template.fulfilment_notes, framingNote].filter(Boolean).join(" ");
      const label =
        resolved.fit_mode === "custom_size"
          ? `${template.variant_label} (custom ${resolved.width_mm}x${resolved.height_mm}mm)`
          : template.variant_label;

      const { rows: inserted } = await client.query<VariantRow>(
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
            front_face_height_mm,
            fit_mode,
            crop_offset,
            size_lock
          )
          values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            null, null, null, null, true,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
            $28, $29, $30
          )
          returning *
        `,
        [
          product.id,
          label,
          resolved.width_mm,
          resolved.height_mm,
          template.border_mm,
          template.paper_type,
          template.print_type,
          priceOverrides[template.id] ?? template.base_price_aud,
          template.edition_size ?? payload.edition_size,
          payload.master_filename,
          template.tier_label,
          template.finish,
          template.is_framed,
          template.frame_type,
          template.print_dpi,
          template.lab_cost_aud,
          template.suggested_retail_min_aud,
          template.suggested_retail_max_aud,
          template.turnaround_days_min,
          template.turnaround_days_max,
          template.shipping_class,
          fulfilmentNotes || null,
          resolved.aspect_ratio ?? template.aspect_ratio,
          template.canvas_wrap_mm,
          template.wrap_style,
          template.front_face_width_mm,
          template.front_face_height_mm,
          resolved.fit_mode,
          resolved.crop_offset,
          resolved.size_lock,
        ],
      );

      if (inserted[0]) variantRows.push(inserted[0]);
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

    return {
      ...product,
      product_variants: variantRows,
      product_images: imageRows,
    };
  });
};
