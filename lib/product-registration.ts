import { withTransaction } from "./postgres";
import {
  defaultPrintTypeForPaper,
  formatCustomSizeVariantLabel,
  suggestTierForLongEdge,
  type PrintTypeCode,
} from "./print-catalogue";
import {
  describeFramingNote,
  resolvePrintSize,
  type VariantFramingInput,
} from "./print-framing";
import { getPrintPricingBundle } from "./print-papers";
import { computeVariantPricing, deriveAspectPreservingSizeMm } from "./print-size";

/** Explicit paper × long-edge variant (Import Wizard path). Prices in cents. */
export type CustomSizeVariantSpec = {
  paper_type: string;
  print_type?: PrintTypeCode | null;
  long_edge_mm: number;
  /** Override retail in cents; omit or null to use lab × markup. */
  price_aud?: number | null;
  border_mm?: number;
  print_dpi?: number;
  finish?: string | null;
  edition_size?: number | null;
  tier_label?: string | null;
};

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
  /** Legacy / Register Photo: copy from variant_templates. */
  variant_template_ids?: string[];
  variant_template_prices?: Record<string, number>;
  /** Per-template framing overrides keyed by template UUID. */
  variant_framing?: Record<string, VariantFramingInput>;
  /** Preferred Import Wizard path: aspect-true custom sizes without ISO templates. */
  custom_size_variants?: CustomSizeVariantSpec[];
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

const VARIANT_INSERT_SQL = `
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
`;

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
  const customSpecs = payload.custom_size_variants?.filter((spec) => spec.long_edge_mm > 0 && spec.paper_type.trim()) ?? [];
  const useCustomSpecs = customSpecs.length > 0;
  const selectedTemplateIds = !useCustomSpecs && payload.variant_template_ids?.length ? payload.variant_template_ids : null;
  const priceOverrides = payload.variant_template_prices ?? {};
  const framingByTemplate = payload.variant_framing ?? {};
  const masterPixelWidth = payload.master_pixel_width ?? null;
  const masterPixelHeight = payload.master_pixel_height ?? null;
  const pricingSettings = useCustomSpecs ? await getPrintPricingBundle() : null;

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

    const variantRows: VariantRow[] = [];

    if (useCustomSpecs) {
      if (!masterPixelWidth || !masterPixelHeight || masterPixelWidth <= 0 || masterPixelHeight <= 0) {
        throw new Error("MASTER_PIXELS_REQUIRED_FOR_CUSTOM_SIZE");
      }

      for (const spec of customSpecs) {
        const paper = spec.paper_type.trim();
        const printType = (spec.print_type ?? defaultPrintTypeForPaper(paper)) as PrintTypeCode;
        const size = deriveAspectPreservingSizeMm(spec.long_edge_mm, masterPixelWidth, masterPixelHeight);
        const pricing = computeVariantPricing({
          widthMm: size.width_mm,
          heightMm: size.height_mm,
          paperLabel: paper,
          markupFactor: pricingSettings?.markupFactor ?? 3,
          basePriceAud: pricingSettings?.basePriceAud ?? 0,
          papers: pricingSettings?.papers,
        });

        if (!pricing && (spec.price_aud === null || spec.price_aud === undefined)) {
          throw new Error(`NO_SQ_IN_RATE_FOR_PAPER:${paper}`);
        }

        const priceAud =
          typeof spec.price_aud === "number" && Number.isFinite(spec.price_aud)
            ? Math.round(spec.price_aud)
            : (pricing?.retailCents ?? 0);
        const labCostAud = pricing?.labCostCents ?? null;
        const tierLabel =
          spec.tier_label?.trim() ||
          suggestTierForLongEdge(Math.max(size.width_mm, size.height_mm), printType) ||
          null;
        const label = formatCustomSizeVariantLabel({
          paperLabel: paper,
          widthMm: size.width_mm,
          heightMm: size.height_mm,
          longEdgeMm: spec.long_edge_mm,
        });
        const fulfilmentNotes = [
          `Custom size ${size.width_mm}x${size.height_mm}mm (lock long_edge ${spec.long_edge_mm}mm).`,
          "Order as custom paper at Pixel Perfect.",
        ].join(" ");

        const { rows: inserted } = await client.query<VariantRow>(VARIANT_INSERT_SQL, [
          product.id,
          label,
          size.width_mm,
          size.height_mm,
          spec.border_mm ?? 0,
          paper,
          printType,
          priceAud,
          spec.edition_size ?? payload.edition_size,
          payload.master_filename,
          tierLabel,
          spec.finish ?? null,
          false,
          null,
          spec.print_dpi ?? 300,
          labCostAud,
          null,
          null,
          null,
          null,
          null,
          fulfilmentNotes,
          size.aspect_ratio,
          null,
          null,
          null,
          null,
          "custom_size",
          0,
          "long_edge",
        ]);

        if (inserted[0]) variantRows.push(inserted[0]);
      }
    } else {
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
            ? formatCustomSizeVariantLabel({
                paperLabel: template.paper_type ?? template.variant_label,
                widthMm: resolved.width_mm,
                heightMm: resolved.height_mm,
                longEdgeMm: Math.max(resolved.width_mm, resolved.height_mm),
              })
            : template.variant_label;

        const { rows: inserted } = await client.query<VariantRow>(VARIANT_INSERT_SQL, [
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
        ]);

        if (inserted[0]) variantRows.push(inserted[0]);
      }
    }

    if (variantRows.length === 0) {
      throw new Error("NO_VARIANTS_CREATED");
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
