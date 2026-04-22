"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { slugify } from "../../lib/utils/slugify";
import styles from "./ProductEditorForm.module.css";

type VariantInput = {
  id?: string;
  has_order_items?: boolean;
  variant_label: string;
  price_dollars: string;
  edition_size: string;
  stock_quantity: string;
  stripe_price_id: string;
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
  is_available: boolean;
  is_featured: boolean;
  variants: VariantInput[];
  images: ImageInput[];
};

type ProductEditorFormProps = {
  mode: "new" | "edit";
  initialData?: ProductEditorInitialData;
};

const createBlankVariant = (): VariantInput => ({
  variant_label: "",
  price_dollars: "",
  edition_size: "",
  stock_quantity: "",
  stripe_price_id: "",
  is_active: true,
});

const createBlankImage = (): ImageInput => ({
  image_url: "",
  alt_text: "",
  sort_order: "0",
  is_primary: false,
});

export function ProductEditorForm({ mode, initialData }: ProductEditorFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialData?.slug));
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [productType, setProductType] = useState<"print" | "merchandise">(initialData?.product_type ?? "print");
  const [locationTag, setLocationTag] = useState(initialData?.location_tag ?? "");
  const [installationTag, setInstallationTag] = useState(initialData?.installation_tag ?? "");
  const [isAvailable, setIsAvailable] = useState(initialData?.is_available ?? true);
  const [isFeatured, setIsFeatured] = useState(initialData?.is_featured ?? false);
  const [variants, setVariants] = useState<VariantInput[]>(
    initialData?.variants.length ? initialData.variants : [createBlankVariant()],
  );
  const [images, setImages] = useState<ImageInput[]>(initialData?.images ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      is_active: variant.is_active,
    }));

    if (normalizedVariants.some((variant) => !variant.variant_label || variant.price_aud < 0)) {
      setError("Each variant needs a label and valid price.");
      return;
    }

    const normalizedImages = images.map((image) => ({
      id: image.id,
      image_url: image.image_url.trim(),
      alt_text: image.alt_text.trim() || null,
      sort_order: Number.parseInt(image.sort_order || "0", 10) || 0,
      is_primary: image.is_primary,
    }));

    if (normalizedImages.some((image) => image.image_url.length > 0 && !image.image_url.startsWith("http"))) {
      setError("Image URLs must be absolute URLs.");
      return;
    }

    const payload = {
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      product_type: productType,
      location_tag: locationTag ? locationTag : null,
      installation_tag: installationTag ? installationTag : null,
      is_available: isAvailable,
      is_featured: isFeatured,
      variants: normalizedVariants,
      images: normalizedImages.filter((image) => image.image_url),
    };

    setSaving(true);
    setError(null);

    const endpoint = mode === "new" ? "/api/admin/products" : `/api/admin/products/${initialData?.id}`;
    const method = mode === "new" ? "POST" : "PATCH";

    const response = await fetch(endpoint, {
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
              Installation Tag
              <select value={installationTag} onChange={(event) => setInstallationTag(event.target.value)}>
                <option value="">none</option>
                <option value="Cubarama">Cubarama</option>
                <option value="Captain Godfrey AI">Captain Godfrey AI</option>
                <option value="Drift">Drift</option>
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

        <div className={styles.footerActions}>
          <button className={styles.btn} type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Product"}
          </button>
          <Link className={styles.btnSecondary} href="/admin/products">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
