"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminClientFetch, adminClientFetchError } from "../../lib/admin-client-fetch";
import {
  defaultPrintTypeForPaper,
  formatCustomSizeVariantLabel,
  LONG_EDGE_PRESETS,
  PAPER_OPTIONS,
  PIXEL_PERFECT_PRICELIST_NOTE,
  type PaperOption,
  type PrintTypeCode,
} from "../../lib/print-catalogue";
import { DEFAULT_PRINT_PRICE_MARKUP_FACTOR } from "../../lib/print-markup";
import { computeVariantPricing, deriveAspectPreservingSizeMm, formatDualSize } from "../../lib/print-size";
import type { Theme } from "../../lib/supabase/types";
import { slugify } from "../../lib/utils/slugify";
import styles from "./ImportPhotoWizardClient.module.css";
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
  masterFilesDirPath: string;
  initialMarkupFactor?: number;
  loadErrors?: string[];
};

type WebImageMode = "generate" | "upload";

type VariantCombo = {
  key: string;
  paper: PaperOption;
  longEdgeMm: number;
  widthMm: number;
  heightMm: number;
  labCostAud: number | null;
  formulaRetailAud: number | null;
  formulaRetailCents: number | null;
  note: string | null;
};

const STEP_LABELS = [
  "Before you start",
  "Master TIFF",
  "Product details",
  "Print sizes",
  "Web image",
  "Review & publish",
  "Ready for order",
] as const;

const photoTypeOptions = ["", "Still camera", "Drone", "Underwater"];

const DEFAULT_PAPER_IDS = ["hm-photo-rag"];
const DEFAULT_LONG_EDGE_MMS = [420, 594];

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatMoney = (value: number): string =>
  value.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

const formatResolution = (file: MasterFileCandidate): string =>
  file.pixel_width && file.pixel_height
    ? `${file.pixel_width} x ${file.pixel_height} px`
    : "Resolution unavailable";

const masterThumbnailUrl = (filename: string): string =>
  `/api/admin/master-files/thumbnail?filename=${encodeURIComponent(filename)}`;

const comboKey = (paperId: string, longEdgeMm: number): string => `${paperId}|${longEdgeMm}`;

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
  masterFilesDirPath,
  initialMarkupFactor = DEFAULT_PRINT_PRICE_MARKUP_FACTOR,
  loadErrors = [],
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
  const [visibility, setVisibility] = useState<"public" | "vault">("public");
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>(DEFAULT_PAPER_IDS);
  const [selectedLongEdges, setSelectedLongEdges] = useState<number[]>(DEFAULT_LONG_EDGE_MMS);
  const [priceOverrides, setPriceOverrides] = useState<Record<string, string>>({});
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
  const [themeOptions, setThemeOptions] = useState(themes);
  const [markupFactor, setMarkupFactor] = useState(initialMarkupFactor);
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

  const sellablePapers = useMemo(
    () => PAPER_OPTIONS.filter((paper) => paper.rateTier !== null),
    [],
  );

  const variantCombos = useMemo((): VariantCombo[] => {
    if (!hasMasterPixels || !selectedMaster) return [];

    const combos: VariantCombo[] = [];
    for (const paperId of selectedPaperIds) {
      const paper = sellablePapers.find((item) => item.id === paperId);
      if (!paper) continue;
      for (const longEdgeMm of selectedLongEdges) {
        const size = deriveAspectPreservingSizeMm(
          longEdgeMm,
          selectedMaster.pixel_width!,
          selectedMaster.pixel_height!,
        );
        const pricing = computeVariantPricing({
          widthMm: size.width_mm,
          heightMm: size.height_mm,
          paperLabel: paper.label,
          markupFactor,
        });
        combos.push({
          key: comboKey(paper.id, longEdgeMm),
          paper,
          longEdgeMm,
          widthMm: size.width_mm,
          heightMm: size.height_mm,
          labCostAud: pricing?.labCostAud ?? null,
          formulaRetailAud: pricing?.retailAud ?? null,
          formulaRetailCents: pricing?.retailCents ?? null,
          note: pricing?.note ?? null,
        });
      }
    }
    return combos;
  }, [hasMasterPixels, markupFactor, selectedLongEdges, selectedMaster, selectedPaperIds, sellablePapers]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await adminClientFetch("/api/admin/print-pricing/markup");
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { markup_factor?: number };
        if (typeof body.markup_factor === "number" && !cancelled) {
          setMarkupFactor(body.markup_factor);
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
      setPriceOverrides({});
      setWebImageMode("generate");
      setWebImage(null);
      setCreatedProductId(null);
      setVariantsCreated(0);
      setError(null);
    }
  };

  const togglePaper = (paperId: string) => {
    setSelectedPaperIds((current) =>
      current.includes(paperId) ? current.filter((id) => id !== paperId) : [...current, paperId],
    );
  };

  const toggleLongEdge = (mm: number) => {
    setSelectedLongEdges((current) =>
      current.includes(mm) ? current.filter((value) => value !== mm) : [...current, mm].sort((a, b) => a - b),
    );
  };

  const retailDollarsForCombo = (combo: VariantCombo): string => {
    if (priceOverrides[combo.key] !== undefined) return priceOverrides[combo.key];
    return combo.formulaRetailAud !== null ? combo.formulaRetailAud.toFixed(2) : "";
  };

  const editionNumber = Number.parseInt(editionSize, 10);
  const detailsValid = Boolean(title.trim() && slug.trim() && Number.isInteger(editionNumber) && editionNumber >= 1);
  const sizesValid =
    hasMasterPixels &&
    variantCombos.length > 0 &&
    variantCombos.every((combo) => {
      const value = Number.parseFloat(retailDollarsForCombo(combo) || "");
      return Number.isFinite(value) && value >= 0;
    });
  const webImageValid = webImageMode === "generate" || webImage instanceof File;

  const stepComplete = (index: number): boolean => {
    switch (index) {
      case 0:
        return understood;
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
    if (step === 0 && !understood) {
      return "Confirm that you understand the pipeline before continuing.";
    }
    if (step === 1 && !masterFilename) {
      return `Place a TIFF in ${masterFilesDirPath}, refresh, then select it.`;
    }
    if (step === 2 && !detailsValid) {
      return "Title, slug, and edition size (1 or more) are required.";
    }
    if (step === 3 && !hasMasterPixels) {
      return "Master TIFF pixel dimensions are required to compute custom sizes.";
    }
    if (step === 3 && !sizesValid) {
      return "Select at least one paper and long-edge size with a valid retail price.";
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
    setVisibility("public");
    setSelectedPaperIds(DEFAULT_PAPER_IDS);
    setSelectedLongEdges(DEFAULT_LONG_EDGE_MMS);
    setPriceOverrides({});
    setSelectedThemeIds([]);
    setThemeOptions(themes);
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
    if (selectedMaster?.pixel_width) {
      formData.set("master_pixel_width", String(selectedMaster.pixel_width));
    }
    if (selectedMaster?.pixel_height) {
      formData.set("master_pixel_height", String(selectedMaster.pixel_height));
    }
    formData.set("is_featured", String(isFeatured));
    formData.set("visibility", visibility);
    formData.set("theme_ids", JSON.stringify(selectedThemeIds));
    formData.set(
      "custom_size_variants",
      JSON.stringify(
        variantCombos.map((combo) => {
          const dollars = Number.parseFloat(retailDollarsForCombo(combo) || "0") || 0;
          const formulaCents = combo.formulaRetailCents;
          const overrideCents = Math.round(dollars * 100);
          const priceAud =
            formulaCents !== null && overrideCents === formulaCents ? null : overrideCents;
          return {
            paper_type: combo.paper.label,
            print_type: combo.paper.printType as PrintTypeCode,
            long_edge_mm: combo.longEdgeMm,
            price_aud: priceAud,
          };
        }),
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
                You add title, slug, edition size, then choose papers and long-edge sizes. Each combo becomes an
                aspect-true custom-size variant priced from Pixel Perfect sq-in cost × markup (
                {markupFactor}× — editable on{" "}
                <Link href="/admin/print-profiles">Print Templates</Link>).
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

          <div className={styles.checklist}>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={understood}
                onChange={(event) => setUnderstood(event.target.checked)}
              />
              <span>
                I understand: masters go on the server share (not browser upload), print sizes are custom paper from
                long edge + sq-in pricing, and registering publishes the product for ordering.
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
            <label>
              Visibility
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as "public" | "vault")}
              >
                <option value="public">Public gallery</option>
                <option value="vault">Private collections only</option>
              </select>
            </label>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className={styles.panel}>
          <h2>4. Print sizes</h2>
          <p className={styles.explain}>
            Pick papers and long-edge presets. Each combination becomes a shop variant at the master photo&apos;s
            aspect ratio (<code>custom_size</code>), priced as lab cost × {markupFactor}× markup. Adjust retail per row
            if needed. Markup and rates: <Link href="/admin/print-profiles">Print Templates</Link>.
          </p>
          <p className={styles.muted}>{PIXEL_PERFECT_PRICELIST_NOTE}.</p>

          {!hasMasterPixels ? (
            <p className={styles.blocker}>
              This master has no readable pixel dimensions. Re-scan masters or pick another file — custom sizes cannot
              be computed without them.
            </p>
          ) : null}

          <div className={styles.matrixPickers}>
            <div>
              <h3>Papers</h3>
              <div className={styles.chipList}>
                {sellablePapers.map((paper) => (
                  <label key={paper.id} className={styles.chip}>
                    <input
                      type="checkbox"
                      checked={selectedPaperIds.includes(paper.id)}
                      onChange={() => togglePaper(paper.id)}
                    />
                    <span>
                      {paper.label}
                      <span className={styles.muted}> · {defaultPrintTypeForPaper(paper.label)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h3>Long-edge sizes</h3>
              <div className={styles.chipList}>
                {LONG_EDGE_PRESETS.map((preset) => (
                  <label key={preset.mm} className={styles.chip}>
                    <input
                      type="checkbox"
                      checked={selectedLongEdges.includes(preset.mm)}
                      onChange={() => toggleLongEdge(preset.mm)}
                    />
                    <span>{preset.labelMm}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {variantCombos.length > 0 ? (
            <div className={styles.variantMatrix}>
              <h3>
                Variants to create ({variantCombos.length})
              </h3>
              <table className={styles.matrixTable}>
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Size</th>
                    <th>Lab cost</th>
                    <th>Formula retail</th>
                    <th>Retail AUD</th>
                  </tr>
                </thead>
                <tbody>
                  {variantCombos.map((combo) => (
                    <tr key={combo.key}>
                      <td>
                        {formatCustomSizeVariantLabel({
                          paperLabel: combo.paper.label,
                          widthMm: combo.widthMm,
                          heightMm: combo.heightMm,
                          longEdgeMm: combo.longEdgeMm,
                        })}
                      </td>
                      <td>{formatDualSize(combo.widthMm, combo.heightMm)}</td>
                      <td>{combo.labCostAud !== null ? formatMoney(combo.labCostAud) : "—"}</td>
                      <td>
                        {combo.formulaRetailAud !== null ? formatMoney(combo.formulaRetailAud) : "—"}
                        <span className={styles.muted}> ({markupFactor}×)</span>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={styles.priceInput}
                          value={retailDollarsForCombo(combo)}
                          onChange={(event) =>
                            setPriceOverrides((current) => ({ ...current, [combo.key]: event.target.value }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : hasMasterPixels ? (
            <p className={styles.blocker}>Select at least one paper and one long-edge size.</p>
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
                <th>Visibility</th>
                <td>{visibility === "vault" ? "Private collections" : "Public gallery"}</td>
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
                    {variantCombos.map((combo) => (
                      <li key={combo.key}>
                        {formatCustomSizeVariantLabel({
                          paperLabel: combo.paper.label,
                          widthMm: combo.widthMm,
                          heightMm: combo.heightMm,
                          longEdgeMm: combo.longEdgeMm,
                        })}{" "}
                        — ${retailDollarsForCombo(combo) || "0.00"} AUD
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
