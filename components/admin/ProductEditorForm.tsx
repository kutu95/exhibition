"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { adminClientFetch, adminClientFetchError } from "../../lib/admin-client-fetch";
import type { VariantTemplate } from "../../lib/supabase/types";
import { isValidProductImageUrl } from "../../lib/utils/site-content-image";
import { slugify } from "../../lib/utils/slugify";
import styles from "./ProductEditorForm.module.css";

type VariantInput = {
  id?: string;
  has_order_items?: boolean;
  template_id: string;
  variant_label: string;
  price_dollars: string;
  edition_size: string;
  stock_quantity: string;
  stripe_price_id: string;
  width_mm: string;
  height_mm: string;
  border_mm: string;
  paper_type: string;
  print_type: string;
  print_dpi: string;
  source_print_profile_id: string;
  destination_print_profile_id: string;
  tier_label: string;
  finish: string;
  is_framed: boolean;
  frame_type: string;
  lab_cost_dollars: string;
  suggested_retail_min_dollars: string;
  suggested_retail_max_dollars: string;
  turnaround_days_min: string;
  turnaround_days_max: string;
  shipping_class: string;
  fulfilment_notes: string;
  aspect_ratio: string;
  canvas_wrap_mm: string;
  wrap_style: string;
  front_face_width_mm: string;
  front_face_height_mm: string;
  is_active: boolean;
};

type ImageInput = {
  id?: string;
  image_url: string;
  alt_text: string;
  sort_order: string;
  is_primary: boolean;
};

type ProductEditorInitialData = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  product_type: "print" | "merchandise";
  location_tag: string;
  installation_tag: string;
  photo_type_tag: string;
  is_available: boolean;
  is_featured: boolean;
  variants: VariantInput[];
  images: ImageInput[];
};

type ProductEditorFormProps = {
  mode: "new" | "edit";
  initialData?: ProductEditorInitialData;
  variantTemplates: VariantTemplate[];
};

const createBlankVariant = (): VariantInput => ({
  template_id: "",
  variant_label: "",
  price_dollars: "",
  edition_size: "",
  stock_quantity: "",
  stripe_price_id: "",
  width_mm: "",
  height_mm: "",
  border_mm: "0",
  paper_type: "",
  print_type: "",
  print_dpi: "300",
  source_print_profile_id: "",
  destination_print_profile_id: "",
  tier_label: "",
  finish: "",
  is_framed: false,
  frame_type: "",
  lab_cost_dollars: "",
  suggested_retail_min_dollars: "",
  suggested_retail_max_dollars: "",
  turnaround_days_min: "",
  turnaround_days_max: "",
  shipping_class: "",
  fulfilment_notes: "",
  aspect_ratio: "",
  canvas_wrap_mm: "",
  wrap_style: "",
  front_face_width_mm: "",
  front_face_height_mm: "",
  is_active: true,
});

const createBlankImage = (): ImageInput => ({
  image_url: "",
  alt_text: "",
  sort_order: "0",
  is_primary: false,
});

const centsToDollars = (value: number | null): string => (value === null ? "" : (value / 100).toFixed(2));

const applyTemplateToVariant = (variant: VariantInput, template: VariantTemplate): VariantInput => ({
  ...variant,
  template_id: template.id,
  variant_label: template.variant_label,
  price_dollars: (template.base_price_aud / 100).toFixed(2),
  edition_size: template.edition_size?.toString() ?? "",
  width_mm: template.width_mm.toString(),
  height_mm: template.height_mm.toString(),
  border_mm: template.border_mm.toString(),
  paper_type: template.paper_type,
  print_type: template.print_type,
  print_dpi: template.print_dpi.toString(),
  source_print_profile_id: template.source_print_profile_id ?? "",
  destination_print_profile_id: template.destination_print_profile_id ?? "",
  tier_label: template.tier_label ?? "",
  finish: template.finish ?? "",
  is_framed: template.is_framed,
  frame_type: template.frame_type ?? "",
  lab_cost_dollars: centsToDollars(template.lab_cost_aud),
  suggested_retail_min_dollars: centsToDollars(template.suggested_retail_min_aud),
  suggested_retail_max_dollars: centsToDollars(template.suggested_retail_max_aud),
  turnaround_days_min: template.turnaround_days_min?.toString() ?? "",
  turnaround_days_max: template.turnaround_days_max?.toString() ?? "",
  shipping_class: template.shipping_class ?? "",
  fulfilment_notes: template.fulfilment_notes ?? "",
  aspect_ratio: template.aspect_ratio ?? "",
  canvas_wrap_mm: template.canvas_wrap_mm?.toString() ?? "",
  wrap_style: template.wrap_style ?? "",
  front_face_width_mm: template.front_face_width_mm?.toString() ?? "",
  front_face_height_mm: template.front_face_height_mm?.toString() ?? "",
});

export function ProductEditorForm({ mode, initialData, variantTemplates }: ProductEditorFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialData?.slug));
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [productType, setProductType] = useState<"print" | "merchandise">(initialData?.product_type ?? "print");
  const [locationTag, setLocationTag] = useState(initialData?.location_tag ?? "");
  const [photoTypeTag, setPhotoTypeTag] = useState(initialData?.photo_type_tag ?? "");
  const [isAvailable, setIsAvailable] = useState(initialData?.is_available ?? true);
  const [isFeatured, setIsFeatured] = useState(initialData?.is_featured ?? false);
  const [variants, setVariants] = useState<VariantInput[]>(
    initialData?.variants.length ? initialData.variants : [createBlankVariant()],
  );
  const [images, setImages] = useState<ImageInput[]>(initialData?.images ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creatingTestOrderVariantId, setCreatingTestOrderVariantId] = useState<string | null>(null);
  const [testOrderMessage, setTestOrderMessage] = useState<string | null>(null);
  const activeVariantTemplates = useMemo(
    () => variantTemplates.filter((template) => template.is_active),
    [variantTemplates],
  );

  const slugSuggestion = useMemo(() => slugify(title), [title]);

  const applySlugSuggestion = (nextTitle: string) => {
    if (!slugTouched) {
      setSlug(slugify(nextTitle));
    }
  };

  const setPrimaryImage = (index: number) => {
    setImages((current) => current.map((image, imageIndex) => ({ ...image, is_primary: imageIndex === index })));
  };

  const handleSave = async () => {
    if (!title.trim() || !slug.trim()) {
      setError("Title and slug are required.");
      return;
    }
    if (variants.length === 0) {
      setError("At least one variant is required.");
      return;
    }

    const normalizedVariants = variants.map((variant) => ({
      id: variant.id,
      variant_label: variant.variant_label.trim(),
      price_aud: Math.round((Number.parseFloat(variant.price_dollars || "0") || 0) * 100),
      edition_size: variant.edition_size ? Number.parseInt(variant.edition_size, 10) : null,
      stock_quantity: variant.stock_quantity ? Number.parseInt(variant.stock_quantity, 10) : null,
      stripe_price_id: variant.stripe_price_id.trim() || null,
      width_mm: variant.width_mm ? Number.parseInt(variant.width_mm, 10) : null,
      height_mm: variant.height_mm ? Number.parseInt(variant.height_mm, 10) : null,
      border_mm: variant.border_mm ? Number.parseInt(variant.border_mm, 10) : 0,
      paper_type: variant.paper_type.trim() || null,
      print_type: variant.print_type.trim() || null,
      print_dpi: variant.print_dpi ? Number.parseInt(variant.print_dpi, 10) : null,
      source_print_profile_id: variant.source_print_profile_id || null,
      destination_print_profile_id: variant.destination_print_profile_id || null,
      tier_label: variant.tier_label.trim() || null,
      finish: variant.finish.trim() || null,
      is_framed: variant.is_framed,
      frame_type: variant.frame_type.trim() || null,
      lab_cost_aud: variant.lab_cost_dollars
        ? Math.round((Number.parseFloat(variant.lab_cost_dollars) || 0) * 100)
        : null,
      suggested_retail_min_aud: variant.suggested_retail_min_dollars
        ? Math.round((Number.parseFloat(variant.suggested_retail_min_dollars) || 0) * 100)
        : null,
      suggested_retail_max_aud: variant.suggested_retail_max_dollars
        ? Math.round((Number.parseFloat(variant.suggested_retail_max_dollars) || 0) * 100)
        : null,
      turnaround_days_min: variant.turnaround_days_min ? Number.parseInt(variant.turnaround_days_min, 10) : null,
      turnaround_days_max: variant.turnaround_days_max ? Number.parseInt(variant.turnaround_days_max, 10) : null,
      shipping_class: variant.shipping_class.trim() || null,
      fulfilment_notes: variant.fulfilment_notes.trim() || null,
      aspect_ratio: variant.aspect_ratio.trim() || null,
      canvas_wrap_mm: variant.canvas_wrap_mm ? Number.parseInt(variant.canvas_wrap_mm, 10) : null,
      wrap_style: variant.wrap_style.trim() || null,
      front_face_width_mm: variant.front_face_width_mm ? Number.parseInt(variant.front_face_width_mm, 10) : null,
      front_face_height_mm: variant.front_face_height_mm ? Number.parseInt(variant.front_face_height_mm, 10) : null,
      is_active: variant.is_active,
    }));

    if (normalizedVariants.some((variant) => !variant.variant_label || variant.price_aud < 0)) {
      setError("Each variant needs a label and valid price.");
      return;
    }
    if (
      productType === "print" &&
      normalizedVariants.some(
        (variant) =>
          !variant.width_mm ||
          !variant.height_mm ||
          variant.width_mm <= 0 ||
          variant.height_mm <= 0 ||
          !variant.print_dpi ||
          variant.print_dpi <= 0,
      )
    ) {
      setError("Each print variant must have positive width, height, and print DPI. Select a template first.");
      return;
    }

    const normalizedImages = images.map((image) => ({
      id: image.id,
      image_url: image.image_url.trim(),
      alt_text: image.alt_text.trim() || null,
      sort_order: Number.parseInt(image.sort_order || "0", 10) || 0,
      is_primary: image.is_primary,
    }));

    if (normalizedImages.some((image) => image.image_url.length > 0 && !isValidProductImageUrl(image.image_url))) {
      setError("Image URLs must be absolute http(s) URLs or local /images/ paths.");
      return;
    }

    const payload = {
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      product_type: productType,
      location_tag: locationTag ? locationTag : null,
      installation_tag: initialData?.installation_tag || null,
      photo_type_tag: photoTypeTag ? photoTypeTag : null,
      is_available: isAvailable,
      is_featured: isFeatured,
      variants: normalizedVariants,
      images: normalizedImages.filter((image) => image.image_url),
    };

    setSaving(true);
    setError(null);

    const endpoint = mode === "new" ? "/api/admin/products" : `/api/admin/products/${initialData?.id}`;
    const method = mode === "new" ? "POST" : "PATCH";

    try {
      const response = await adminClientFetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({ error: "Failed to save product." }))) as {
          error?: string;
        };
        setError(data.error ?? "Failed to save product.");
        setSaving(false);
        return;
      }

      router.push("/admin/products");
      router.refresh();
    } catch (saveError) {
      setError(adminClientFetchError(saveError));
      setSaving(false);
    }
  };

  const handleDeleteOrArchive = async () => {
    if (mode !== "edit" || !initialData?.id) return;

    const confirmed = window.confirm(
      "Archive/delete this product? If it has ever had an order, it will only be deactivated and archived. If it has no orders, it will be removed along with its variants, image rows, local image files, and Stripe catalogue entries will be archived.",
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    const response = await fetch(`/api/admin/products/${initialData.id}`, {
      method: "DELETE",
    });

    const data = (await response.json().catch(() => ({ error: "Failed to archive/delete product." }))) as {
      action?: "archived" | "deleted";
      error?: string;
      warning?: string;
    };

    if (!response.ok) {
      setError(data.error ?? "Failed to archive/delete product.");
      setDeleting(false);
      return;
    }

    if (data.warning) {
      setError(data.warning);
      setDeleting(false);
      return;
    }

    router.push("/admin/products");
    router.refresh();
  };

  const createTestOrder = async (variant: VariantInput) => {
    if (!variant.id) {
      setError("Save the product before creating a test order.");
      return;
    }

    if (!variant.is_active) {
      setError("Variant must be active before creating a test order.");
      return;
    }

    const confirmed = window.confirm(
      `Create a paid admin test order for "${variant.variant_label}" without Stripe? This will enter fulfilment.`,
    );
    if (!confirmed) return;

    setCreatingTestOrderVariantId(variant.id);
    setError(null);
    setTestOrderMessage(null);

    const response = await fetch("/api/admin/orders/manual", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        variant_id: variant.id,
        quantity: 1,
      }),
    });

    const body = (await response.json().catch(() => null)) as
      | { error?: string; order_number?: string }
      | null;

    if (!response.ok) {
      setError(body?.error ?? "Failed to create test order.");
      setCreatingTestOrderVariantId(null);
      return;
    }

    setTestOrderMessage(`Created test order ${body?.order_number ?? ""}.`);
    setCreatingTestOrderVariantId(null);
    router.refresh();
  };

  return (
    <div>
      <h1>{mode === "new" ? "Add New Product" : "Edit Product"}</h1>

      <div className={styles.form}>
        <section className={styles.panel}>
          <h2>Product</h2>
          <div className={styles.grid}>
            <label>
              Title
              <input
                value={title}
                onChange={(event) => {
                  const nextTitle = event.target.value;
                  setTitle(nextTitle);
                  applySlugSuggestion(nextTitle);
                }}
                required
              />
            </label>
            <label>
              Slug
              <input
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value);
                }}
                required
              />
            </label>
            <small>Suggested: {slugSuggestion || "n/a"}</small>

            <label>
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
              />
            </label>

            <label>
              Product Type
              <select
                value={productType}
                onChange={(event) => setProductType(event.target.value as "print" | "merchandise")}
              >
                <option value="print">print</option>
                <option value="merchandise">merchandise</option>
              </select>
            </label>

            <label>
              Location Tag
              <select value={locationTag} onChange={(event) => setLocationTag(event.target.value)}>
                <option value="">none</option>
                <option value="Calgardup Bay">Calgardup Bay</option>
                <option value="Redgate Beach">Redgate Beach</option>
                <option value="Isaac Rock">Isaac Rock</option>
                <option value="SS Georgette Wreck">SS Georgette Wreck</option>
              </select>
            </label>

            <label>
              Photo Type Tag
              <select value={photoTypeTag} onChange={(event) => setPhotoTypeTag(event.target.value)}>
                <option value="">none</option>
                <option value="Still camera">Still camera</option>
                <option value="Drone">Drone</option>
                <option value="Underwater">Underwater</option>
              </select>
            </label>

            <label>
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(event) => setIsAvailable(event.target.checked)}
              />
              {" "}Is Available
            </label>

            <label>
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(event) => setIsFeatured(event.target.checked)}
              />
              {" "}Is Featured
            </label>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.rowTop}>
            <h2>Variants</h2>
            <button
              className={styles.btnSecondary}
              type="button"
              onClick={() => setVariants((current) => [...current, createBlankVariant()])}
            >
              Add Variant
            </button>
          </div>

          {variants.map((variant, index) => (
            <div key={`${variant.id ?? "new"}-${index}`} className={styles.row}>
              <div className={styles.rowTop}>
                <strong>Variant {index + 1}</strong>
                <button
                  className={styles.btnSecondary}
                  type="button"
                  onClick={() => setVariants((current) => current.filter((_, i) => i !== index))}
                  disabled={variants.length === 1 || Boolean(variant.has_order_items)}
                >
                  {variant.has_order_items ? "Used in Orders" : "Delete"}
                </button>
              </div>
              {mode === "edit" ? (
                <div className={styles.inlineActions}>
                  <button
                    className={styles.btnSecondary}
                    type="button"
                    onClick={() => createTestOrder(variant)}
                    disabled={
                      !variant.id ||
                      !variant.is_active ||
                      creatingTestOrderVariantId === variant.id
                    }
                  >
                    {creatingTestOrderVariantId === variant.id
                      ? "Creating test order..."
                      : "Create Test Order (No Stripe)"}
                  </button>
                </div>
              ) : null}
              <div className={styles.grid}>
                <label>
                  Label
                  <input
                    value={variant.variant_label}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, variant_label: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Print Template
                  <select
                    value={variant.template_id}
                    onChange={(event) => {
                      const template = activeVariantTemplates.find((item) => item.id === event.target.value);
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index && template
                            ? applyTemplateToVariant(row, template)
                            : i === index
                              ? { ...row, template_id: event.target.value }
                              : row,
                        ),
                      );
                    }}
                  >
                    <option value="">none</option>
                    {activeVariantTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.variant_label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Price AUD (dollars)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={variant.price_dollars}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, price_dollars: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Edition Size
                  <input
                    type="number"
                    min="1"
                    value={variant.edition_size}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, edition_size: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Stock Quantity
                  <input
                    type="number"
                    min="0"
                    value={variant.stock_quantity}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, stock_quantity: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Stripe Price ID
                  <input
                    value={variant.stripe_price_id}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, stripe_price_id: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Width (mm)
                  <input
                    type="number"
                    min="1"
                    value={variant.width_mm}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, width_mm: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Height (mm)
                  <input
                    type="number"
                    min="1"
                    value={variant.height_mm}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, height_mm: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Border (mm)
                  <input
                    type="number"
                    min="0"
                    value={variant.border_mm}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, border_mm: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Print DPI
                  <input
                    type="number"
                    min="1"
                    value={variant.print_dpi}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, print_dpi: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Paper Type
                  <input
                    value={variant.paper_type}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, paper_type: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Print Type
                  <input
                    value={variant.print_type}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, print_type: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={variant.is_framed}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, is_framed: event.target.checked } : row,
                        ),
                      )
                    }
                  />
                  {" "}Framed
                </label>
                <label>
                  Frame Type
                  <input
                    value={variant.frame_type}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, frame_type: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Source Print Profile ID
                  <input
                    value={variant.source_print_profile_id}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, source_print_profile_id: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Destination Print Profile ID
                  <input
                    value={variant.destination_print_profile_id}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, destination_print_profile_id: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Tier Label
                  <input
                    value={variant.tier_label}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, tier_label: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Finish
                  <input
                    value={variant.finish}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, finish: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Lab Cost AUD (dollars)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={variant.lab_cost_dollars}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, lab_cost_dollars: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Suggested Retail Min AUD
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={variant.suggested_retail_min_dollars}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, suggested_retail_min_dollars: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Suggested Retail Max AUD
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={variant.suggested_retail_max_dollars}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, suggested_retail_max_dollars: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Turnaround Days Min
                  <input
                    type="number"
                    min="1"
                    value={variant.turnaround_days_min}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, turnaround_days_min: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Turnaround Days Max
                  <input
                    type="number"
                    min="1"
                    value={variant.turnaround_days_max}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, turnaround_days_max: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Shipping Class
                  <input
                    value={variant.shipping_class}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, shipping_class: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Aspect Ratio
                  <input
                    value={variant.aspect_ratio}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, aspect_ratio: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Canvas Wrap (mm)
                  <input
                    type="number"
                    min="0"
                    value={variant.canvas_wrap_mm}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, canvas_wrap_mm: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Wrap Style
                  <input
                    value={variant.wrap_style}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, wrap_style: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Front Face Width (mm)
                  <input
                    type="number"
                    min="1"
                    value={variant.front_face_width_mm}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, front_face_width_mm: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Front Face Height (mm)
                  <input
                    type="number"
                    min="1"
                    value={variant.front_face_height_mm}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, front_face_height_mm: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Fulfilment Notes
                  <textarea
                    rows={3}
                    value={variant.fulfilment_notes}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, fulfilment_notes: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={variant.is_active}
                    onChange={(event) =>
                      setVariants((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, is_active: event.target.checked } : row,
                        ),
                      )
                    }
                  />
                  {" "}Active
                </label>
              </div>
            </div>
          ))}
        </section>

        <section className={styles.panel}>
          <div className={styles.rowTop}>
            <h2>Images</h2>
            <button
              className={styles.btnSecondary}
              type="button"
              onClick={() => setImages((current) => [...current, createBlankImage()])}
            >
              Add Image
            </button>
          </div>
          <p>Image upload is out of scope for now. Enter image URLs directly.</p>

          {images.map((image, index) => (
            <div key={`${image.id ?? "img-new"}-${index}`} className={styles.row}>
              <div className={styles.rowTop}>
                <strong>Image {index + 1}</strong>
                <button
                  className={styles.btnSecondary}
                  type="button"
                  onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                >
                  Delete
                </button>
              </div>
              <div className={styles.grid}>
                <label>
                  Image URL
                  <input
                    value={image.image_url}
                    onChange={(event) =>
                      setImages((current) =>
                        current.map((row, i) => (i === index ? { ...row, image_url: event.target.value } : row)),
                      )
                    }
                  />
                </label>
                <label>
                  Alt text
                  <input
                    value={image.alt_text}
                    onChange={(event) =>
                      setImages((current) =>
                        current.map((row, i) => (i === index ? { ...row, alt_text: event.target.value } : row)),
                      )
                    }
                  />
                </label>
                <label>
                  Sort order
                  <input
                    type="number"
                    value={image.sort_order}
                    onChange={(event) =>
                      setImages((current) =>
                        current.map((row, i) => (i === index ? { ...row, sort_order: event.target.value } : row)),
                      )
                    }
                  />
                </label>
                <label>
                  <input
                    type="radio"
                    checked={image.is_primary}
                    onChange={() => setPrimaryImage(index)}
                  />
                  {" "}Primary image
                </label>
              </div>
            </div>
          ))}
        </section>

        {error ? <p className={styles.error}>{error}</p> : null}
        {testOrderMessage ? <p className={styles.success}>{testOrderMessage}</p> : null}

        <div className={styles.footerActions}>
          <button className={styles.btn} type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Product"}
          </button>
          {mode === "edit" ? (
            <button className={styles.btnDanger} type="button" onClick={handleDeleteOrArchive} disabled={deleting || saving}>
              {deleting ? "Archiving..." : "Archive / Delete Product"}
            </button>
          ) : null}
          <Link className={styles.btnSecondary} href="/admin/products">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
