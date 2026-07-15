"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminClientFetch, adminClientFetchError } from "../../lib/admin-client-fetch";
import type { VariantTemplate } from "../../lib/supabase/types";
import { slugify } from "../../lib/utils/slugify";
import styles from "./ImportPhotoWizardClient.module.css";

type MasterFileCandidate = {
  filename: string;
  size_bytes: number;
  modified_at: string;
  pixel_width: number | null;
  pixel_height: number | null;
  aspect_ratio: string | null;
  suggested_title: string;
  suggested_slug: string;
};

type ImportPhotoWizardClientProps = {
  initialMasterFiles: MasterFileCandidate[];
  variantTemplates: VariantTemplate[];
  masterFilesDirPath: string;
};

type WebImageMode = "generate" | "upload";

const STEP_LABELS = [
  "Before you start",
  "Master TIFF",
  "Product details",
  "Print templates",
  "Web image",
  "Review & publish",
  "Ready for order",
] as const;

const photoTypeOptions = ["", "Still camera", "Drone", "Underwater"];

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatDollars = (cents: number | null): string | null =>
  cents === null ? null : `$${(cents / 100).toFixed(2)}`;

const formatResolution = (file: MasterFileCandidate): string =>
  file.pixel_width && file.pixel_height
    ? `${file.pixel_width} x ${file.pixel_height} px`
    : "Resolution unavailable";

const masterThumbnailUrl = (filename: string): string =>
  `/api/admin/master-files/thumbnail?filename=${encodeURIComponent(filename)}`;

function MasterThumbnail({
  filename,
  className,
  large = false,
}: {
  filename: string;
  className?: string;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [filename]);

  if (failed) {
    return (
      <div className={`${styles.thumbPlaceholder} ${large ? styles.thumbLarge : ""} ${className ?? ""}`}>
        Preview unavailable
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`${large ? styles.thumbLarge : styles.thumb} ${className ?? ""}`}
      src={masterThumbnailUrl(filename)}
      alt={`Preview of ${filename}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function ImportPhotoWizardClient({
  initialMasterFiles,
  variantTemplates,
  masterFilesDirPath,
}: ImportPhotoWizardClientProps) {
  const [step, setStep] = useState(0);
  const [understood, setUnderstood] = useState(false);
  const [masterFiles, setMasterFiles] = useState(initialMasterFiles);
  const [refreshingMasters, setRefreshingMasters] = useState(false);
  const [masterError, setMasterError] = useState<string | null>(null);
  const [masterFilename, setMasterFilename] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [locationTag, setLocationTag] = useState("");
  const [photoTypeTag, setPhotoTypeTag] = useState("");
  const [editionSize, setEditionSize] = useState("10");
  const [isFeatured, setIsFeatured] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [templatePrices, setTemplatePrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      variantTemplates
        .filter((template) => template.is_active)
        .map((template) => [template.id, (template.base_price_aud / 100).toFixed(2)]),
    ),
  );
  const [webImageMode, setWebImageMode] = useState<WebImageMode>("generate");
  const [webImage, setWebImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [variantsCreated, setVariantsCreated] = useState(0);

  const activeTemplates = useMemo(
    () => variantTemplates.filter((template) => template.is_active),
    [variantTemplates],
  );

  const selectedMaster = useMemo(
    () => masterFiles.find((file) => file.filename === masterFilename) ?? null,
    [masterFiles, masterFilename],
  );

  const selectedTemplates = useMemo(
    () => activeTemplates.filter((template) => selectedTemplateIds.includes(template.id)),
    [activeTemplates, selectedTemplateIds],
  );

  const refreshMasterFiles = useCallback(async () => {
    setRefreshingMasters(true);
    setMasterError(null);
    try {
      const response = await adminClientFetch("/api/admin/master-files");
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to refresh master files.");
      }
      const body = (await response.json()) as { files: MasterFileCandidate[] };
      setMasterFiles(body.files);
      if (masterFilename && !body.files.some((file) => file.filename === masterFilename)) {
        setMasterFilename("");
      }
    } catch (refreshError) {
      setMasterError(adminClientFetchError(refreshError));
    } finally {
      setRefreshingMasters(false);
    }
  }, [masterFilename]);

  useEffect(() => {
    if (step !== 1) return;
    const intervalId = window.setInterval(() => {
      void refreshMasterFiles();
    }, 12_000);
    return () => window.clearInterval(intervalId);
  }, [step, refreshMasterFiles]);

  const updateTitle = (value: string) => {
    setTitle(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  };

  const selectMasterFile = (file: MasterFileCandidate) => {
    const masterChanged = file.filename !== masterFilename;
    setMasterFilename(file.filename);
    if (!title.trim() || masterChanged) {
      setTitle(file.suggested_title);
    }
    if (!slugTouched || !slug.trim() || masterChanged) {
      setSlug(file.suggested_slug);
      setSlugTouched(false);
    }
    if (masterChanged) {
      setSelectedTemplateIds([]);
      setWebImageMode("generate");
      setWebImage(null);
      setCreatedProductId(null);
      setVariantsCreated(0);
      setError(null);
    }
  };

  const toggleTemplate = (templateId: string) => {
    const template = activeTemplates.find((item) => item.id === templateId);
    setSelectedTemplateIds((current) =>
      current.includes(templateId)
        ? current.filter((id) => id !== templateId)
        : [...current, templateId],
    );
    if (template && !templatePrices[templateId]) {
      setTemplatePrices((current) => ({
        ...current,
        [templateId]: (template.base_price_aud / 100).toFixed(2),
      }));
    }
  };

  const selectAllTemplates = () => {
    setSelectedTemplateIds(activeTemplates.map((template) => template.id));
    setTemplatePrices((current) => ({
      ...Object.fromEntries(
        activeTemplates.map((template) => [template.id, (template.base_price_aud / 100).toFixed(2)]),
      ),
      ...current,
    }));
  };

  const deselectAllTemplates = () => {
    setSelectedTemplateIds([]);
  };

  const editionNumber = Number.parseInt(editionSize, 10);
  const detailsValid = Boolean(title.trim() && slug.trim() && Number.isInteger(editionNumber) && editionNumber >= 1);
  const templatesValid =
    selectedTemplateIds.length > 0 &&
    selectedTemplateIds.every((id) => {
      const value = Number.parseFloat(templatePrices[id] || "");
      return Number.isFinite(value) && value >= 0;
    });
  const webImageValid = webImageMode === "generate" || webImage instanceof File;

  const stepComplete = (index: number): boolean => {
    switch (index) {
      case 0:
        return understood && activeTemplates.length > 0;
      case 1:
        return Boolean(masterFilename && selectedMaster);
      case 2:
        return detailsValid;
      case 3:
        return templatesValid;
      case 4:
        return webImageValid;
      case 5:
        return Boolean(createdProductId);
      case 6:
        return Boolean(createdProductId);
      default:
        return false;
    }
  };

  const canGoNext = step < 5 ? stepComplete(step) : false;
  const nextBlockedReason = (() => {
    if (step === 0 && activeTemplates.length === 0) {
      return "Configure at least one active print template before importing.";
    }
    if (step === 0 && !understood) {
      return "Confirm that you understand the pipeline before continuing.";
    }
    if (step === 1 && !masterFilename) {
      return `Place a TIFF in ${masterFilesDirPath}, refresh, then select it.`;
    }
    if (step === 2 && !detailsValid) {
      return "Title, slug, and edition size (1 or more) are required.";
    }
    if (step === 3 && !templatesValid) {
      return "Select at least one print template with a valid price.";
    }
    if (step === 4 && !webImageValid) {
      return "Choose auto-generate, or upload a JPEG/PNG/WebP override.";
    }
    return null;
  })();

  const goNext = () => {
    if (!canGoNext) return;
    setError(null);
    setStep((current) => Math.min(current + 1, STEP_LABELS.length - 1));
  };

  const goBack = () => {
    setError(null);
    setStep((current) => Math.max(current - 1, 0));
  };

  const resetWizard = () => {
    setStep(0);
    setUnderstood(false);
    setMasterFilename("");
    setTitle("");
    setSlug("");
    setSlugTouched(false);
    setDescription("");
    setLocationTag("");
    setPhotoTypeTag("");
    setEditionSize("10");
    setIsFeatured(false);
    setSelectedTemplateIds([]);
    setWebImageMode("generate");
    setWebImage(null);
    setSaving(false);
    setError(null);
    setCreatedProductId(null);
    setVariantsCreated(0);
    void refreshMasterFiles();
  };

  const publish = async () => {
    if (!stepComplete(0) || !stepComplete(1) || !stepComplete(2) || !stepComplete(3) || !stepComplete(4)) {
      setError("Complete earlier steps before publishing.");
      return;
    }

    setSaving(true);
    setError(null);

    const formData = new FormData();
    formData.set("title", title.trim());
    formData.set("slug", slug.trim());
    formData.set("description", description.trim());
    formData.set("location_tag", locationTag.trim());
    formData.set("photo_type_tag", photoTypeTag);
    formData.set("edition_size", editionSize);
    formData.set("master_filename", masterFilename.trim());
    formData.set("is_featured", String(isFeatured));
    formData.set("variant_template_ids", JSON.stringify(selectedTemplateIds));
    formData.set(
      "variant_template_prices",
      JSON.stringify(
        Object.fromEntries(
          selectedTemplateIds.map((templateId) => [
            templateId,
            Math.round((Number.parseFloat(templatePrices[templateId] || "0") || 0) * 100),
          ]),
        ),
      ),
    );
    if (webImageMode === "upload" && webImage) {
      formData.set("web_image", webImage);
    }

    try {
      const response = await adminClientFetch("/api/admin/register-photo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to register photo.");
      }

      const body = (await response.json()) as { product_id: string; variants_created: number };
      setCreatedProductId(body.product_id);
      setVariantsCreated(body.variants_created);
      setStep(6);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : adminClientFetchError(publishError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <ol className={styles.steps} aria-label="Import steps">
        {STEP_LABELS.map((label, index) => {
          const done = index < step || (index === 6 && Boolean(createdProductId));
          const current = index === step;
          return (
            <li
              key={label}
              className={`${styles.stepItem} ${current ? styles.stepItemCurrent : ""} ${done ? styles.stepItemDone : ""}`}
            >
              {index + 1}. {label}
            </li>
          );
        })}
      </ol>

      {step === 0 ? (
        <section className={styles.panel}>
          <h2>1. Before you start</h2>
          <div className={styles.explain}>
            <p>
              This wizard takes one unfinished master TIFF through to a live shop product customers can order. It does
              not upload TIFFs — masters stay on the server share.
            </p>
            <p>
              <Link href="/admin/help/master-tiff">How to prepare a master TIFF in Lightroom and Photoshop →</Link>
            </p>
            <h3>What happens</h3>
            <ul>
              <li>
                You place a master <code>.tif</code> / <code>.tiff</code> in <code>{masterFilesDirPath}</code>{" "}
                (with an embedded ICC profile).
              </li>
              <li>You add title, slug, edition size, and choose print sizes (templates).</li>
              <li>The app creates a public web JPEG (or uses your override), product, variants, and Stripe prices.</li>
              <li>The product is marked available and appears on <code>/shop</code>.</li>
              <li>After a sale, a separate fulfilment worker builds the lab JPEG from the same master.</li>
            </ul>
            <h3>You will need</h3>
            <ul>
              <li>At least one active print template under{" "}
                <Link href="/admin/print-profiles">Print Templates</Link>.
              </li>
              <li>Access to the master files share on the server (not the public website folder).</li>
              <li>
                A master TIFF prepared in Photoshop with an embedded ICC profile — see{" "}
                <Link href="/admin/help/master-tiff">Preparing a master TIFF</Link> (Lightroom → Photoshop → Convert
                to Adobe RGB → Save As TIFF).
              </li>
            </ul>
          </div>

          {activeTemplates.length === 0 ? (
            <p className={styles.blocker}>
              No active print templates are configured. Create and activate templates before importing a photo.
            </p>
          ) : (
            <p className={styles.success}>{activeTemplates.length} active print template(s) available.</p>
          )}

          <div className={styles.checklist}>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={understood}
                onChange={(event) => setUnderstood(event.target.checked)}
                disabled={activeTemplates.length === 0}
              />
              <span>
                I understand: masters go on the server share (not browser upload), print sizes come from templates, and
                registering publishes the product for ordering.
              </span>
            </label>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className={styles.panel}>
          <h2>2. Place and select the master TIFF</h2>
          <div className={styles.explain}>
            <p>
              Copy the finished master into <code>{masterFilesDirPath}</code>. Use filename only later — no folder path.
              The file must include an embedded ICC colour profile.
            </p>
            <p>
              Large masters are not uploaded through the browser. When the copy finishes, refresh the list below and
              select the file. This step auto-refreshes every 12 seconds while open.
            </p>
          </div>

          <div className={styles.toolbar}>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={refreshingMasters}
              onClick={() => void refreshMasterFiles()}
            >
              {refreshingMasters ? "Refreshing…" : "Refresh files"}
            </button>
            <span className={styles.muted}>{masterFiles.length} unregistered master(s) detected</span>
          </div>

          {masterError ? <p className={styles.error}>{masterError}</p> : null}

          {masterFiles.length === 0 ? (
            <p className={styles.blocker}>
              No unregistered TIFF files found. Place a <code>.tif</code> / <code>.tiff</code> in{" "}
              <code>{masterFilesDirPath}</code>, wait for the copy to finish, then refresh.
            </p>
          ) : (
            <div className={styles.fileList}>
              {masterFiles.map((file) => (
                <button
                  key={file.filename}
                  className={file.filename === masterFilename ? styles.fileButtonActive : styles.fileButton}
                  type="button"
                  onClick={() => selectMasterFile(file)}
                >
                  <MasterThumbnail filename={file.filename} />
                  <span className={styles.fileMeta}>
                    <strong>{file.filename}</strong>
                    <span>{formatBytes(file.size_bytes)}</span>
                    <span>{formatResolution(file)}</span>
                    <span>Aspect ratio {file.aspect_ratio ?? "unavailable"}</span>
                    <span>Modified {new Date(file.modified_at).toLocaleString("en-AU")}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {step === 2 ? (
        <section className={styles.panel}>
          <h2>3. Product details</h2>
          <p className={styles.explain}>
            These fields appear on the shop and product page. The slug becomes the URL under <code>/shop/</code>.
            Master selected: <strong>{masterFilename}</strong>
          </p>
          {masterFilename ? (
            <div className={styles.selectedPreview}>
              <MasterThumbnail filename={masterFilename} large />
            </div>
          ) : null}
          <div className={styles.form}>
            <div className={styles.grid}>
              <label>
                Title
                <input value={title} onChange={(event) => updateTitle(event.target.value)} />
              </label>
              <label>
                Slug
                <input
                  value={slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setSlug(event.target.value);
                  }}
                />
              </label>
              <label>
                Edition size
                <input
                  type="number"
                  min="1"
                  value={editionSize}
                  onChange={(event) => setEditionSize(event.target.value)}
                />
              </label>
              <label>
                Location tag
                <input value={locationTag} onChange={(event) => setLocationTag(event.target.value)} />
              </label>
              <label>
                Photo type tag
                <select value={photoTypeTag} onChange={(event) => setPhotoTypeTag(event.target.value)}>
                  {photoTypeOptions.map((option) => (
                    <option key={option || "none"} value={option}>
                      {option || "none"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Description
              <textarea rows={5} value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(event) => setIsFeatured(event.target.checked)}
              />
              <span>Feature on shop / home surfaces</span>
            </label>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className={styles.panel}>
          <h2>4. Print templates</h2>
          <p className={styles.explain}>
            Choose which sellable sizes to create. Dimensions, paper, and DPI are copied onto each variant with this
            master filename. Manage templates on{" "}
            <Link href="/admin/print-profiles">Print Templates</Link>.
          </p>
          <div className={styles.templateActions}>
            <button className={styles.secondaryButton} type="button" onClick={selectAllTemplates}>
              Select all
            </button>
            <button className={styles.secondaryButton} type="button" onClick={deselectAllTemplates}>
              Deselect all
            </button>
            <span className={styles.muted}>{selectedTemplateIds.length} selected</span>
          </div>
          <div className={styles.templateList}>
            {activeTemplates.map((template) => (
              <details className={styles.templateOption} key={template.id}>
                <summary className={styles.templateSummary}>
                  <input
                    type="checkbox"
                    checked={selectedTemplateIds.includes(template.id)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => toggleTemplate(template.id)}
                  />
                  <span>
                    <strong>{template.variant_label}</strong>
                    <span className={styles.muted}>
                      {[
                        template.tier_label,
                        template.paper_type,
                        template.finish,
                        template.is_framed ? template.frame_type ?? "framed" : null,
                      ]
                        .filter(Boolean)
                        .join(" / ")}
                    </span>
                  </span>
                  <span className={styles.priceField} onClick={(event) => event.stopPropagation()}>
                    Price AUD
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={templatePrices[template.id] ?? ""}
                      disabled={!selectedTemplateIds.includes(template.id)}
                      onChange={(event) =>
                        setTemplatePrices((current) => ({ ...current, [template.id]: event.target.value }))
                      }
                    />
                  </span>
                </summary>
                <div className={styles.templateDetails}>
                  <span className={styles.muted}>
                    {template.width_mm} x {template.height_mm} mm
                    {template.edition_size ? `, edition ${template.edition_size}` : ""}
                    {`, ${template.print_dpi} DPI`}
                  </span>
                  <span className={styles.muted}>
                    Default ${(template.base_price_aud / 100).toFixed(2)}
                    {formatDollars(template.lab_cost_aud) ? `, lab cost ${formatDollars(template.lab_cost_aud)}` : ""}
                  </span>
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className={styles.panel}>
          <h2>5. Web image</h2>
          <p className={styles.explain}>
            Customers see a web JPEG on the shop — never the master TIFF. Auto-generate from the master (sRGB, max
            edge ~2400px) unless you already have a prepared override.
          </p>
          <div className={styles.modeList}>
            <div className={`${styles.modeOption} ${webImageMode === "generate" ? styles.modeOptionActive : ""}`}>
              <label>
                <input
                  type="radio"
                  name="webImageMode"
                  checked={webImageMode === "generate"}
                  onChange={() => {
                    setWebImageMode("generate");
                    setWebImage(null);
                  }}
                />
                <span>
                  <strong>Auto-generate from master TIFF</strong>
                  <span className={styles.muted}>Recommended. Created during registration from {masterFilename || "the selected master"}.</span>
                </span>
              </label>
            </div>
            <div className={`${styles.modeOption} ${webImageMode === "upload" ? styles.modeOptionActive : ""}`}>
              <label>
                <input
                  type="radio"
                  name="webImageMode"
                  checked={webImageMode === "upload"}
                  onChange={() => setWebImageMode("upload")}
                />
                <span>
                  <strong>Upload a web image override</strong>
                  <span className={styles.muted}>JPEG, PNG, or WebP up to 8MB.</span>
                </span>
              </label>
              {webImageMode === "upload" ? (
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setWebImage(event.target.files?.[0] ?? null)}
                />
              ) : null}
            </div>
          </div>
          {webImageMode === "upload" && !webImage ? (
            <p className={styles.blocker}>Select an override image file to continue.</p>
          ) : null}
        </section>
      ) : null}

      {step === 5 ? (
        <section className={styles.panel}>
          <h2>6. Review &amp; publish</h2>
          <p className={styles.explain}>
            Publishing creates the product with <code>is_available = true</code>, selected variants, Stripe prices, and
            the web image. It will be ready to order on the shop immediately.
          </p>
          <table className={styles.summary}>
            <tbody>
              <tr>
                <th>Master</th>
                <td>{masterFilename}</td>
              </tr>
              <tr>
                <th>Title</th>
                <td>{title}</td>
              </tr>
              <tr>
                <th>Shop URL</th>
                <td>/shop/{slug}</td>
              </tr>
              <tr>
                <th>Edition size</th>
                <td>{editionSize}</td>
              </tr>
              <tr>
                <th>Photo type</th>
                <td>{photoTypeTag || "—"}</td>
              </tr>
              <tr>
                <th>Location</th>
                <td>{locationTag || "—"}</td>
              </tr>
              <tr>
                <th>Featured</th>
                <td>{isFeatured ? "Yes" : "No"}</td>
              </tr>
              <tr>
                <th>Web image</th>
                <td>
                  {webImageMode === "generate"
                    ? "Auto-generate from master"
                    : `Upload override: ${webImage?.name ?? "missing"}`}
                </td>
              </tr>
              <tr>
                <th>Variants</th>
                <td>
                  <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                    {selectedTemplates.map((template) => (
                      <li key={template.id}>
                        {template.variant_label} — ${templatePrices[template.id] || "0.00"} AUD
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            </tbody>
          </table>
          {error ? <p className={styles.error}>{error}</p> : null}
        </section>
      ) : null}

      {step === 6 ? (
        <section className={styles.panel}>
          <h2>7. Ready for order</h2>
          <p className={styles.success}>
            Registered successfully. Created {variantsCreated} variant(s). The product is available on the shop.
          </p>
          <div className={styles.explain}>
            <p>
              Customers can buy it now at <code>/shop/{slug}</code>. After payment, fulfilment waits for the print
              worker to prepare a lab JPEG from the same master TIFF.
            </p>
          </div>
          <div className={styles.doneLinks}>
            <a href={`/shop/${slug}`} target="_blank" rel="noreferrer">
              Open shop page
            </a>
            {createdProductId ? (
              <Link href={`/admin/products/${createdProductId}/edit`}>Edit product</Link>
            ) : null}
            <button className={styles.button} type="button" onClick={resetWizard}>
              Import another photo
            </button>
          </div>
        </section>
      ) : null}

      {step < 6 ? (
        <div className={styles.footer}>
          <p className={styles.footerHint}>
            {nextBlockedReason ?? (step === 5 ? "Review the summary, then publish." : "Complete this step to continue.")}
          </p>
          <div className={styles.footerActions}>
            <button className={styles.secondaryButton} type="button" onClick={goBack} disabled={step === 0 || saving}>
              Back
            </button>
            {step < 5 ? (
              <button className={styles.button} type="button" onClick={goNext} disabled={!canGoNext}>
                Next
              </button>
            ) : (
              <button className={styles.button} type="button" onClick={() => void publish()} disabled={saving}>
                {saving ? "Publishing…" : "Publish to shop"}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
