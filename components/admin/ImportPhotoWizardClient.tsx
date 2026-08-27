"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminClientFetch, adminClientFetchError, ADMIN_CLIENT_FETCH_LONG_TIMEOUT_MS } from "../../lib/admin-client-fetch";
import {
  buildOfferVariantsForProduct,
  type OfferVariantDraft,
} from "../../lib/print-offer";
import { DEFAULT_PRINT_PRICE_BASE_AUD, DEFAULT_PRINT_PRICE_MARKUP_FACTOR } from "../../lib/print-markup";
import {
  DEFAULT_PRINT_FRAME_BASE_AUD,
  DEFAULT_PRINT_FRAME_MARKUP_FACTOR,
  type FrameRateBand,
  type RthCanvasRateBand,
} from "../../lib/print-frame-pricing";
import type { PosterFactoryCatalogue } from "../../lib/posterfactory";
import type { Gallery } from "../../lib/galleries";
import type { Theme } from "../../lib/supabase/types";
import { slugify } from "../../lib/utils/slugify";
import styles from "./ImportPhotoWizardClient.module.css";
import { GalleryPicker } from "./GalleryPicker";
import { OfferVariantMatrix, useOfferSelection } from "./OfferVariantMatrix";
import { ThemeSelector } from "./ThemeSelector";

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
  themes: Theme[];
  galleries: Gallery[];
  masterFilesDirPath: string;
  initialMarkupFactor?: number;
  initialBasePriceAud?: number;
  initialFrameMarkupFactor?: number;
  initialFrameBasePriceAud?: number;
  loadErrors?: string[];
};

type WebImageMode = "generate" | "upload";

const STEP_LABELS = [
  "Before you start",
  "Master TIFF",
  "Product details",
  "Print offer",
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

const formatMoney = (value: number): string =>
  value.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

const masterThumbnailUrl = (filename: string): string =>
  `/api/admin/master-files/thumbnail?filename=${encodeURIComponent(filename)}`;

const formatResolution = (file: MasterFileCandidate): string =>
  file.pixel_width && file.pixel_height
    ? `${file.pixel_width} x ${file.pixel_height} px`
    : "Resolution unavailable";

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
  themes,
  galleries,
  masterFilesDirPath,
  initialMarkupFactor = DEFAULT_PRINT_PRICE_MARKUP_FACTOR,
  initialBasePriceAud = DEFAULT_PRINT_PRICE_BASE_AUD,
  initialFrameMarkupFactor = DEFAULT_PRINT_FRAME_MARKUP_FACTOR,
  initialFrameBasePriceAud = DEFAULT_PRINT_FRAME_BASE_AUD,
  loadErrors = [],
}: ImportPhotoWizardClientProps) {
  const [step, setStep] = useState(0);
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
  const [galleryId, setGalleryId] = useState<string | null>(null);
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
  const [themeOptions, setThemeOptions] = useState(themes);
  const [markupFactor, setMarkupFactor] = useState(initialMarkupFactor);
  const [basePriceAud, setBasePriceAud] = useState(initialBasePriceAud);
  const [frameMarkupFactor, setFrameMarkupFactor] = useState(initialFrameMarkupFactor);
  const [frameBasePriceAud, setFrameBasePriceAud] = useState(initialFrameBasePriceAud);
  const [frameRates, setFrameRates] = useState<FrameRateBand[] | undefined>(undefined);
  const [rthCanvasRates, setRthCanvasRates] = useState<RthCanvasRateBand[] | undefined>(undefined);
  const [posterfactory, setPosterfactory] = useState<PosterFactoryCatalogue | undefined>(undefined);
  const [webImageMode, setWebImageMode] = useState<WebImageMode>("generate");
  const [webImage, setWebImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [variantsCreated, setVariantsCreated] = useState(0);

  const selectedMaster = useMemo(
    () => masterFiles.find((file) => file.filename === masterFilename) ?? null,
    [masterFiles, masterFilename],
  );

  const hasMasterPixels = Boolean(
    selectedMaster?.pixel_width &&
      selectedMaster?.pixel_height &&
      selectedMaster.pixel_width > 0 &&
      selectedMaster.pixel_height > 0,
  );

  const offerDrafts = useMemo((): OfferVariantDraft[] => {
    if (!hasMasterPixels || !selectedMaster) return [];
    try {
      return buildOfferVariantsForProduct({
        pixelWidth: selectedMaster.pixel_width!,
        pixelHeight: selectedMaster.pixel_height!,
        editionSize: Number.parseInt(editionSize, 10) || 10,
        mediaMarkupFactor: markupFactor,
        mediaBasePriceAud: basePriceAud,
        frameMarkupFactor,
        frameBasePriceAud,
        frameRates,
        rthCanvasRates,
        posterfactory,
      });
    } catch {
      return [];
    }
  }, [
    basePriceAud,
    editionSize,
    frameBasePriceAud,
    frameMarkupFactor,
    frameRates,
    hasMasterPixels,
    markupFactor,
    rthCanvasRates,
    posterfactory,
    selectedMaster,
  ]);

  const offerSelection = useOfferSelection(offerDrafts);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await adminClientFetch("/api/admin/print-pricing/offer");
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as {
          markup_factor?: number;
          base_price_aud?: number;
          frame_markup_factor?: number;
          frame_base_price_aud?: number;
          frame_rates?: FrameRateBand[];
          rth_canvas_rates?: RthCanvasRateBand[];
          posterfactory?: PosterFactoryCatalogue;
        };
        if (!cancelled) {
          if (typeof body.markup_factor === "number") setMarkupFactor(body.markup_factor);
          if (typeof body.base_price_aud === "number") setBasePriceAud(body.base_price_aud);
          if (typeof body.frame_markup_factor === "number") setFrameMarkupFactor(body.frame_markup_factor);
          if (typeof body.frame_base_price_aud === "number") setFrameBasePriceAud(body.frame_base_price_aud);
          if (Array.isArray(body.frame_rates)) setFrameRates(body.frame_rates);
          if (Array.isArray(body.rth_canvas_rates)) setRthCanvasRates(body.rth_canvas_rates);
          if (body.posterfactory) setPosterfactory(body.posterfactory);
        }
      } catch {
        // Keep server-provided default.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      setWebImageMode("generate");
      setWebImage(null);
      setCreatedProductId(null);
      setVariantsCreated(0);
      setError(null);
      offerSelection.reset();
    }
  };

  const editionNumber = Number.parseInt(editionSize, 10);
  const detailsValid = Boolean(title.trim() && slug.trim() && Number.isInteger(editionNumber) && editionNumber >= 1);
  const sizesValid = hasMasterPixels && offerSelection.selectedDrafts.length > 0 && offerSelection.pricesValid;
  const webImageValid = webImageMode === "generate" || webImage instanceof File;

  const stepComplete = (index: number): boolean => {
    switch (index) {
      case 0:
        return true;
      case 1:
        return Boolean(masterFilename && selectedMaster);
      case 2:
        return detailsValid;
      case 3:
        return sizesValid;
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
    if (step === 1 && !masterFilename) {
      return `Place a TIFF in ${masterFilesDirPath}, refresh, then select it.`;
    }
    if (step === 2 && !detailsValid) {
      return "Title, slug, and edition size (1 or more) are required.";
    }
    if (step === 3 && !hasMasterPixels) {
      return "Master TIFF pixel dimensions are required to build the print offer.";
    }
    if (step === 3 && offerDrafts.length === 0) {
      return "Could not price the standard Tier 1 / Tier 2 / Framed offer. Check Print Templates pricing.";
    }
    if (step === 3 && !sizesValid) {
      return "Select at least one print option, and check any price overrides.";
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
    setMasterFilename("");
    setTitle("");
    setSlug("");
    setSlugTouched(false);
    setDescription("");
    setLocationTag("");
    setPhotoTypeTag("");
    setEditionSize("10");
    setIsFeatured(false);
    setGalleryId(null);
    setSelectedThemeIds([]);
    setThemeOptions(themes);
    setWebImageMode("generate");
    setWebImage(null);
    setSaving(false);
    setError(null);
    setCreatedProductId(null);
    setVariantsCreated(0);
    offerSelection.reset();
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
    if (selectedMaster?.pixel_width) {
      formData.set("master_pixel_width", String(selectedMaster.pixel_width));
    }
    if (selectedMaster?.pixel_height) {
      formData.set("master_pixel_height", String(selectedMaster.pixel_height));
    }
    formData.set("is_featured", String(isFeatured));
    if (galleryId) {
      formData.set("gallery_id", galleryId);
    }
    formData.set("theme_ids", JSON.stringify(selectedThemeIds));
    formData.set("offer_selection", JSON.stringify(offerSelection.selectionPayload));
    if (webImageMode === "upload" && webImage) {
      formData.set("web_image", webImage);
    }

    try {
      const response = await adminClientFetch("/api/admin/register-photo", {
        method: "POST",
        body: formData,
        timeoutMs: ADMIN_CLIENT_FETCH_LONG_TIMEOUT_MS,
      });

      if (response.status === 401) {
        throw new Error(
          "Your admin session expired. Sign in again at /admin/login, then return here and publish.",
        );
      }

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
      {loadErrors.length > 0 ? (
        <div className={styles.blocker} role="alert">
          <strong>Could not load wizard data</strong>
          <ul>
            {loadErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          <p style={{ marginBottom: 0 }}>
            On production this usually means <code>MASTER_FILES_DIR</code> is missing or unreachable.
          </p>
        </div>
      ) : null}

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
              <li>
                You add title, slug, edition size, then choose which Tier 1 / Tier 2 / Framed options to offer. Each
                selected combo becomes an aspect-true custom-size variant priced as roundUp(base + markup × lab cost) —
                currently base ${basePriceAud.toFixed(2)} and {markupFactor}× markup (editable on{" "}
                <Link href="/admin/print-profiles">Print Templates</Link>). You can uncheck options or override retail
                before publish.
              </li>
              <li>The app creates a public web JPEG (or uses your override), product, variants, and Stripe prices.</li>
              <li>The product is marked available and appears on <code>/shop</code>.</li>
              <li>After a sale, fulfilment orders custom paper at the computed mm from the same master.</li>
            </ul>
            <h3>You will need</h3>
            <ul>
              <li>Access to the master files share on the server (not the public website folder).</li>
              <li>
                A master TIFF prepared in Photoshop with an embedded ICC profile — see{" "}
                <Link href="/admin/help/master-tiff">Preparing a master TIFF</Link>.
              </li>
            </ul>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className={styles.panel}>
          <h2>2. Place and select the master TIFF</h2>
          <div className={styles.explain}>
            <p>
              Copy the finished master into <code>{masterFilesDirPath}</code>. Use filename only later — no folder path.
              The file must include an embedded ICC colour profile. Pixel dimensions are required for custom sizes.
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
            <div>
              <h3>Themes</h3>
              <ThemeSelector
                themes={themeOptions}
                selectedThemeIds={selectedThemeIds}
                onChange={setSelectedThemeIds}
                onThemesChange={setThemeOptions}
              />
            </div>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(event) => setIsFeatured(event.target.checked)}
              />
              <span>Feature on shop / home surfaces</span>
            </label>
            <GalleryPicker galleries={galleries} value={galleryId} onChange={setGalleryId} />
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className={styles.panel}>
          <h2>4. Print offer</h2>
          <p className={styles.explain}>
            Defaults are A4 / A3 / A2 / A0 × Tier 1/2 print & mount, Tier 1 framed, Canvas sheet & wrap. Uncheck
            anything this print should not offer, and override retail if you need a different price. Framed uses Pixel
            Perfect Standard moulding (20–42mm face) + Perspex for shipping. Formula pricing uses current media and
            frame markups from <Link href="/admin/print-profiles">Print Templates</Link>.
          </p>
          <p className={styles.muted}>
            Media: base ${basePriceAud.toFixed(2)} + {markupFactor}× lab · Frame: base $
            {frameBasePriceAud.toFixed(2)} + {frameMarkupFactor}× lab · Retail rounds up to $5 / $10 bands.
          </p>

          {!hasMasterPixels ? (
            <p className={styles.blocker}>
              This master has no readable pixel dimensions. Re-scan masters or pick another file.
            </p>
          ) : null}

          {offerDrafts.length > 0 ? (
            <OfferVariantMatrix drafts={offerDrafts} selection={offerSelection} />
          ) : null}
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
                  <span className={styles.muted}>
                    Recommended. Created during registration from {masterFilename || "the selected master"}.
                  </span>
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
                <th>Themes</th>
                <td>
                  {themeOptions
                    .filter((theme) => selectedThemeIds.includes(theme.id))
                    .map((theme) => theme.name)
                    .join(", ") || "—"}
                </td>
              </tr>
              <tr>
                <th>Featured</th>
                <td>{isFeatured ? "Yes" : "No"}</td>
              </tr>
              <tr>
                <th>Gallery</th>
                <td>
                  {galleryId
                    ? galleries.find((gallery) => gallery.id === galleryId)?.name ?? "Private gallery"
                    : "Public gallery"}
                </td>
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
                    {offerSelection.selectedDrafts.map((draft) => (
                      <li key={draft.variant_label}>
                        {draft.variant_label} — {formatMoney(draft.price_aud / 100)}
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
              worker to prepare a lab TIFF from the same master TIFF (custom paper at the stored mm).
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
