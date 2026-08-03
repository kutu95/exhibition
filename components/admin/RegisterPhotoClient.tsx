"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { Theme, VariantTemplate } from "../../lib/supabase/types";
import { slugify } from "../../lib/utils/slugify";
import styles from "./RegisterPhotoClient.module.css";
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

type RegisterPhotoClientProps = {
  masterFiles: MasterFileCandidate[];
  variantTemplates: VariantTemplate[];
  themes: Theme[];
};

const photoTypeOptions = ["", "Still camera", "Drone", "Underwater"];

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatDollars = (cents: number | null): string | null => (cents === null ? null : `$${(cents / 100).toFixed(2)}`);

const formatResolution = (file: MasterFileCandidate): string =>
  file.pixel_width && file.pixel_height ? `${file.pixel_width} x ${file.pixel_height} px` : "Resolution unavailable";

const masterThumbnailUrl = (filename: string): string =>
  `/api/admin/master-files/thumbnail?filename=${encodeURIComponent(filename)}`;

function MasterThumbnail({ filename }: { filename: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [filename]);

  if (failed) {
    return <div className={styles.thumbPlaceholder}>Preview unavailable</div>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- admin preview from authenticated API
    <img
      className={styles.thumb}
      src={masterThumbnailUrl(filename)}
      alt={`Preview of ${filename}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
export function RegisterPhotoClient({ masterFiles, variantTemplates, themes }: RegisterPhotoClientProps) {
  const router = useRouter();
  const [files, setFiles] = useState(masterFiles);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [locationTag, setLocationTag] = useState("");
  const [photoTypeTag, setPhotoTypeTag] = useState("");
  const [editionSize, setEditionSize] = useState("10");
  const [masterFilename, setMasterFilename] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "vault">("public");
  const [webImage, setWebImage] = useState<File | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
  const [themeOptions, setThemeOptions] = useState(themes);
  const [templatePrices, setTemplatePrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      variantTemplates
        .filter((template) => template.is_active)
        .map((template) => [template.id, (template.base_price_aud / 100).toFixed(2)]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeTemplates = useMemo(() => variantTemplates.filter((template) => template.is_active), [variantTemplates]);

  const updateTitle = (value: string) => {
    setTitle(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  };

  const submit = async () => {
    if (!title.trim() || !slug.trim() || !masterFilename.trim()) {
      setError("Title, slug, and master filename are required.");
      return;
    }
    if (selectedTemplateIds.length === 0) {
      setError("Select at least one print template.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set("title", title.trim());
    formData.set("slug", slug.trim());
    formData.set("description", description.trim());
    formData.set("location_tag", locationTag.trim());
    formData.set("photo_type_tag", photoTypeTag);
    formData.set("edition_size", editionSize);
    formData.set("master_filename", masterFilename.trim());
    formData.set("is_featured", String(isFeatured));
    formData.set("visibility", visibility);
    formData.set("variant_template_ids", JSON.stringify(selectedTemplateIds));
    formData.set("theme_ids", JSON.stringify(selectedThemeIds));
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
    if (webImage) {
      formData.set("web_image", webImage);
    }

    const response = await fetch("/api/admin/register-photo", {
      method: "POST",
      body: formData,
    });

    setSaving(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Failed to register photo.");
      return;
    }

    const body = (await response.json()) as { product_id: string; variants_created: number };
    setSuccess(`Registered photo and created ${body.variants_created} variants.`);
    router.push(`/admin/products/${body.product_id}/edit`);
    router.refresh();
  };

  const selectMasterFile = (file: MasterFileCandidate) => {
    setMasterFilename(file.filename);
    if (!title.trim()) {
      setTitle(file.suggested_title);
    }
    if (!slugTouched || !slug.trim()) {
      setSlug(file.suggested_slug);
      setSlugTouched(false);
    }
  };

  const deleteMasterFile = async (file: MasterFileCandidate) => {
    const confirmed = window.confirm(
      `Delete "${file.filename}" from the Masters folder?\n\nThis cannot be undone. Only unlinked masters can be deleted.`,
    );
    if (!confirmed) return;

    setDeletingFilename(file.filename);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/admin/master-files?filename=${encodeURIComponent(file.filename)}`,
        { method: "DELETE" },
      );
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Failed to delete master TIFF.");
        return;
      }

      setFiles((current) => current.filter((item) => item.filename !== file.filename));
      if (masterFilename === file.filename) {
        setMasterFilename("");
      }
      setSuccess(`Deleted ${file.filename} from the Masters folder.`);
    } catch (deleteError) {
      console.error(deleteError);
      setError("Failed to delete master TIFF.");
    } finally {
      setDeletingFilename(null);
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
      ...Object.fromEntries(activeTemplates.map((template) => [template.id, (template.base_price_aud / 100).toFixed(2)])),
      ...current,
    }));
  };

  const deselectAllTemplates = () => {
    setSelectedTemplateIds([]);
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.panel}>
        <h2>New Master TIFFs</h2>
        <p className={styles.muted}>
          These files are in `MASTER_FILES_DIR` and are not yet attached to a product. Thumbnails are generated on demand
          from the master TIFF (first load of a large file can take a few seconds). Delete only removes unlinked files
          from disk.
        </p>
        {error ? <p className={styles.error}>{error}</p> : null}
        {success ? <p className={styles.success}>{success}</p> : null}
        {files.length > 0 ? (
          <div className={styles.fileList}>
            {files.map((file) => (
              <div
                key={file.filename}
                className={file.filename === masterFilename ? styles.fileRowActive : styles.fileRow}
              >
                <button className={styles.fileSelect} type="button" onClick={() => selectMasterFile(file)}>
                  <MasterThumbnail filename={file.filename} />
                  <span className={styles.fileMeta}>
                    <strong>{file.filename}</strong>
                    <span>{formatBytes(file.size_bytes)}</span>
                    <span>{formatResolution(file)}</span>
                    <span>Aspect ratio {file.aspect_ratio ?? "unavailable"}</span>
                    <span>Modified {new Date(file.modified_at).toLocaleString("en-AU")}</span>
                  </span>
                </button>
                <button
                  className={styles.deleteButton}
                  type="button"
                  disabled={deletingFilename === file.filename}
                  onClick={() => deleteMasterFile(file)}
                >
                  {deletingFilename === file.filename ? "Deleting…" : "Delete"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.muted}>No unregistered TIFF files were found.</p>
        )}
      </section>

      <section className={styles.panel}>
        <h2>Register Photo</h2>
        <p className={styles.muted}>
          Choose a detected TIFF above, check the pre-filled fields, then register it. The app generates the public web
          JPEG from the master TIFF unless you provide an optional override image.
        </p>

        {activeTemplates.length === 0 ? (
          <p className={styles.error}>No active variant templates are configured.</p>
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
              Master TIFF filename
              <input
                placeholder="example-master.tif"
                value={masterFilename}
                onChange={(event) => setMasterFilename(event.target.value)}
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

          <label>
            Web image override
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setWebImage(event.target.files?.[0] ?? null)}
            />
            <span className={styles.muted}>Optional. Leave blank to auto-generate from the selected TIFF.</span>
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

          <label>
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(event) => setIsFeatured(event.target.checked)}
            />
            {" "}Feature on shop/home surfaces
          </label>

          {error ? <p className={styles.error}>{error}</p> : null}
          {success ? <p className={styles.success}>{success}</p> : null}

          <button className={styles.button} type="button" disabled={saving} onClick={submit}>
            {saving ? "Registering..." : "Register Photo"}
          </button>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>Print Templates</h2>
        <p className={styles.muted}>
          Select the print versions to create for this photo. Manage templates and profiles on{" "}
          <Link href="/admin/print-profiles">Print Profiles</Link>.
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
                  {template.front_face_width_mm && template.front_face_height_mm
                    ? `, front face ${template.front_face_width_mm} x ${template.front_face_height_mm} mm`
                    : ""}
                  {template.canvas_wrap_mm ? `, ${template.canvas_wrap_mm} mm canvas wrap` : ""}
                  {template.edition_size ? `, edition ${template.edition_size}` : ""}
                </span>
                <span className={styles.muted}>
                  Default ${(template.base_price_aud / 100).toFixed(2)}
                  {formatDollars(template.lab_cost_aud) ? `, lab cost ${formatDollars(template.lab_cost_aud)}` : ""}
                  {formatDollars(template.suggested_retail_min_aud) && formatDollars(template.suggested_retail_max_aud)
                    ? `, suggested ${formatDollars(template.suggested_retail_min_aud)}-${formatDollars(template.suggested_retail_max_aud)}`
                    : ""}
                </span>
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
