"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  PIXEL_PERFECT_PRICELIST_NOTE,
  PIXEL_PERFECT_SQ_IN_RATES_AUD,
} from "../../lib/print-catalogue";
import { DEFAULT_PRINT_PRICE_MARKUP_FACTOR } from "../../lib/print-markup";
import type { PrintProfile, VariantTemplate } from "../../lib/supabase/types";
import { formatDateTime } from "../../lib/utils/dates";
import styles from "./PrintProfilesClient.module.css";

type PrintProfilesClientProps = {
  initialProfiles: PrintProfile[];
  initialVariantTemplates: VariantTemplate[];
  initialMarkupFactor?: number;
};

type TemplateDraft = {
  variant_label: string;
  width_mm: string;
  height_mm: string;
  border_mm: string;
  print_dpi: string;
  paper_type: string;
  print_type: string;
  base_price_dollars: string;
  sort_order: string;
  is_active: boolean;
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
  edition_size: string;
};

const printTypes = [
  { value: "", label: "Any" },
  { value: "fine_art", label: "Fine art" },
  { value: "photo", label: "Photo" },
  { value: "canvas", label: "Canvas" },
  { value: "metal", label: "Metal" },
];

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const nullableText = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const dollarsToCentsOrNull = (value: string): number | null => {
  if (!value.trim()) return null;
  return Math.round((Number.parseFloat(value) || 0) * 100);
};

const intOrNull = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const centsInputValue = (value: number | null): string => (value === null ? "" : (value / 100).toFixed(2));
const mmToCmInputValue = (value: number | null): string => (value === null ? "" : (value / 10).toFixed(1));
const cmToMm = (value: string): number => Math.round((Number.parseFloat(value || "0") || 0) * 10);
const printPixels = (mm: number, dpi: number): number => Math.round((mm / 25.4) * dpi);

const parseAspectRatio = (value: string | null): number | null => {
  if (!value?.trim()) return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");
  const parts = normalized.split(/[:/x]/);

  if (parts.length === 2) {
    const width = Number.parseFloat(parts[0]);
    const height = Number.parseFloat(parts[1]);
    return width > 0 && height > 0 ? width / height : null;
  }

  const decimal = Number.parseFloat(normalized);
  return decimal > 0 ? decimal : null;
};

const calculatedHeight = (width: number, aspectRatio: string | null): number | null => {
  const ratio = parseAspectRatio(aspectRatio);
  return ratio && width > 0 ? Math.max(1, Math.round(width / ratio)) : null;
};

const calculatedWidth = (height: number, aspectRatio: string | null): number | null => {
  const ratio = parseAspectRatio(aspectRatio);
  return ratio && height > 0 ? Math.max(1, Math.round(height * ratio)) : null;
};

const createBlankTemplate = (): TemplateDraft => ({
  variant_label: "",
  width_mm: "",
  height_mm: "",
  border_mm: "0",
  print_dpi: "300",
  paper_type: "",
  print_type: "fine_art",
  base_price_dollars: "",
  sort_order: "0",
  is_active: true,
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
  edition_size: "",
});

const templateToDraft = (template: VariantTemplate): TemplateDraft => ({
  variant_label: `${template.variant_label} (copy)`,
  width_mm: mmToCmInputValue(template.width_mm),
  height_mm: mmToCmInputValue(template.height_mm),
  border_mm: mmToCmInputValue(template.border_mm),
  print_dpi: String(template.print_dpi ?? 300),
  paper_type: template.paper_type,
  print_type: template.print_type,
  base_price_dollars: (template.base_price_aud / 100).toFixed(2),
  sort_order: String(template.sort_order),
  is_active: template.is_active,
  source_print_profile_id: "",
  destination_print_profile_id: "",
  tier_label: template.tier_label ?? "",
  finish: template.finish ?? "",
  is_framed: template.is_framed,
  frame_type: template.frame_type ?? "",
  lab_cost_dollars: centsInputValue(template.lab_cost_aud),
  suggested_retail_min_dollars: centsInputValue(template.suggested_retail_min_aud),
  suggested_retail_max_dollars: centsInputValue(template.suggested_retail_max_aud),
  turnaround_days_min: template.turnaround_days_min?.toString() ?? "",
  turnaround_days_max: template.turnaround_days_max?.toString() ?? "",
  shipping_class: template.shipping_class ?? "",
  fulfilment_notes: template.fulfilment_notes ?? "",
  aspect_ratio: template.aspect_ratio ?? "",
  canvas_wrap_mm: template.canvas_wrap_mm?.toString() ?? "",
  wrap_style: template.wrap_style ?? "",
  front_face_width_mm: template.front_face_width_mm?.toString() ?? "",
  front_face_height_mm: template.front_face_height_mm?.toString() ?? "",
  edition_size: template.edition_size?.toString() ?? "",
});

const templatePayload = (template: VariantTemplate) => ({
  variant_label: template.variant_label,
  width_mm: template.width_mm,
  height_mm: template.height_mm,
  border_mm: template.border_mm,
  print_dpi: template.print_dpi,
  paper_type: template.paper_type,
  print_type: template.print_type,
  base_price_aud: template.base_price_aud,
  sort_order: template.sort_order,
  is_active: template.is_active,
  source_print_profile_id: null,
  destination_print_profile_id: null,
  tier_label: template.tier_label,
  finish: template.finish,
  is_framed: template.is_framed,
  frame_type: template.frame_type,
  lab_cost_aud: template.lab_cost_aud,
  suggested_retail_min_aud: template.suggested_retail_min_aud,
  suggested_retail_max_aud: template.suggested_retail_max_aud,
  turnaround_days_min: template.turnaround_days_min,
  turnaround_days_max: template.turnaround_days_max,
  shipping_class: template.shipping_class,
  fulfilment_notes: template.fulfilment_notes,
  aspect_ratio: template.aspect_ratio,
  canvas_wrap_mm: template.canvas_wrap_mm,
  wrap_style: template.wrap_style,
  front_face_width_mm: template.front_face_width_mm,
  front_face_height_mm: template.front_face_height_mm,
  edition_size: template.edition_size,
});

const draftPayload = (draft: TemplateDraft) => ({
  variant_label: draft.variant_label.trim(),
  width_mm: cmToMm(draft.width_mm),
  height_mm: cmToMm(draft.height_mm),
  border_mm: cmToMm(draft.border_mm),
  print_dpi: Number.parseInt(draft.print_dpi || "300", 10) || 300,
  paper_type: draft.paper_type.trim(),
  print_type: draft.print_type,
  base_price_aud: Math.round((Number.parseFloat(draft.base_price_dollars || "0") || 0) * 100),
  sort_order: Number.parseInt(draft.sort_order || "0", 10) || 0,
  is_active: draft.is_active,
  source_print_profile_id: null,
  destination_print_profile_id: null,
  tier_label: nullableText(draft.tier_label),
  finish: nullableText(draft.finish),
  is_framed: draft.is_framed,
  frame_type: nullableText(draft.frame_type),
  lab_cost_aud: dollarsToCentsOrNull(draft.lab_cost_dollars),
  suggested_retail_min_aud: dollarsToCentsOrNull(draft.suggested_retail_min_dollars),
  suggested_retail_max_aud: dollarsToCentsOrNull(draft.suggested_retail_max_dollars),
  turnaround_days_min: intOrNull(draft.turnaround_days_min),
  turnaround_days_max: intOrNull(draft.turnaround_days_max),
  shipping_class: nullableText(draft.shipping_class),
  fulfilment_notes: nullableText(draft.fulfilment_notes),
  aspect_ratio: nullableText(draft.aspect_ratio),
  canvas_wrap_mm: intOrNull(draft.canvas_wrap_mm),
  wrap_style: nullableText(draft.wrap_style),
  front_face_width_mm: intOrNull(draft.front_face_width_mm),
  front_face_height_mm: intOrNull(draft.front_face_height_mm),
  edition_size: intOrNull(draft.edition_size),
});

export function PrintProfilesClient({
  initialProfiles,
  initialVariantTemplates,
  initialMarkupFactor = DEFAULT_PRINT_PRICE_MARKUP_FACTOR,
}: PrintProfilesClientProps) {
  const router = useRouter();
  const [profiles, setProfiles] = useState(initialProfiles);
  const [variantTemplates, setVariantTemplates] = useState(initialVariantTemplates);
  const [newTemplate, setNewTemplate] = useState<TemplateDraft>(createBlankTemplate());
  const [displayName, setDisplayName] = useState("");
  const [profileRole, setProfileRole] = useState<"source" | "destination">("destination");
  const [colourSpace, setColourSpace] = useState("");
  const [paperType, setPaperType] = useState("");
  const [printType, setPrintType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTemplateFormOpen, setNewTemplateFormOpen] = useState(false);
  const [markupFactor, setMarkupFactor] = useState(String(initialMarkupFactor));
  const [savingMarkup, setSavingMarkup] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/print-pricing/markup");
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { markup_factor?: number };
        if (typeof body.markup_factor === "number" && !cancelled) {
          setMarkupFactor(String(body.markup_factor));
        }
      } catch {
        // Keep server-rendered / default value.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveMarkupFactor = async () => {
    const parsed = Number.parseFloat(markupFactor);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 20) {
      setError("Markup factor must be a number between 1 and 20.");
      return;
    }

    setSavingMarkup(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/admin/print-pricing/markup", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markup_factor: parsed }),
    });

    setSavingMarkup(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Failed to save markup factor.");
      return;
    }

    const body = (await response.json()) as { markup_factor: number };
    setMarkupFactor(String(body.markup_factor));
    setMessage(`Retail markup set to ${body.markup_factor}× lab cost.`);
    router.refresh();
  };

  const uploadProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError("Choose an ICC or ICM file.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("display_name", displayName.trim() || file.name.replace(/\.[^.]+$/, ""));
    formData.set("profile_role", profileRole);
    formData.set("colour_space", colourSpace.trim());
    formData.set("paper_type", paperType.trim());
    formData.set("print_type", printType);
    formData.set("is_active", String(isActive));

    const response = await fetch("/api/admin/print-profiles", {
      method: "POST",
      body: formData,
    });

    setSaving(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Failed to upload print profile.");
      return;
    }

    const created = (await response.json()) as PrintProfile;
    setProfiles((rows) => [created, ...rows]);
    setDisplayName("");
    setColourSpace("");
    setPaperType("");
    setPrintType("");
    setFile(null);
    setMessage(`Uploaded ${created.display_name}.`);
    router.refresh();
  };

  const saveVariantTemplate = async (template: VariantTemplate) => {
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/admin/variant-templates/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(templatePayload(template)),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Failed to update variant template.");
      return;
    }

    const updated = (await response.json()) as VariantTemplate;
    setVariantTemplates((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
    setMessage(`Updated ${updated.variant_label}. New product registrations will inherit this template.`);
    router.refresh();
  };

  const createVariantTemplate = async () => {
    setError(null);
    setMessage(null);

    const payload = draftPayload(newTemplate);
    if (!payload.variant_label || !payload.paper_type || payload.width_mm <= 0 || payload.height_mm <= 0) {
      setError("Template label, paper, width, and height are required.");
      return;
    }

    const response = await fetch("/api/admin/variant-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Failed to create variant template.");
      return;
    }

    const created = (await response.json()) as VariantTemplate;
    setVariantTemplates((rows) => [...rows, created].sort((a, b) => a.sort_order - b.sort_order));
    setNewTemplate(createBlankTemplate());
    setNewTemplateFormOpen(false);
    setMessage(`Created ${created.variant_label}.`);
    router.refresh();
  };

  const copyTemplateToNewDraft = (template: VariantTemplate) => {
    setNewTemplate(templateToDraft(template));
    setNewTemplateFormOpen(true);
    setError(null);
    setMessage(`Copied ${template.variant_label} into the new template form.`);
  };

  const deleteVariantTemplate = async (template: VariantTemplate) => {
    if (!window.confirm(`Delete template "${template.variant_label}"? Existing products will not be changed.`)) return;

    setError(null);
    setMessage(null);

    const response = await fetch(`/api/admin/variant-templates/${template.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Failed to delete variant template.");
      return;
    }

    setVariantTemplates((rows) => rows.filter((row) => row.id !== template.id));
    setMessage(`Deleted ${template.variant_label}.`);
    router.refresh();
  };

  const updateTemplate = (id: string, updates: Partial<VariantTemplate>) => {
    setVariantTemplates((rows) => rows.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };

  const updateTemplateAspectRatio = (template: VariantTemplate, value: string) => {
    const aspectRatio = nullableText(value);
    const height = calculatedHeight(template.width_mm, aspectRatio);
    updateTemplate(template.id, {
      aspect_ratio: aspectRatio,
      ...(height ? { height_mm: height } : {}),
    });
  };

  const updateTemplateWidth = (template: VariantTemplate, value: string) => {
    const width = cmToMm(value);
    const height = calculatedHeight(width, template.aspect_ratio);
    updateTemplate(template.id, {
      width_mm: width,
      ...(height ? { height_mm: height } : {}),
    });
  };

  const updateTemplateHeight = (template: VariantTemplate, value: string) => {
    const height = cmToMm(value);
    const width = calculatedWidth(height, template.aspect_ratio);
    updateTemplate(template.id, {
      height_mm: height,
      ...(width ? { width_mm: width } : {}),
    });
  };

  const updateNewTemplateAspectRatio = (value: string) => {
    setNewTemplate((draft) => {
      const height = calculatedHeight(cmToMm(draft.width_mm), value);
      return {
        ...draft,
        aspect_ratio: value,
        ...(height ? { height_mm: mmToCmInputValue(height) } : {}),
      };
    });
  };

  const updateNewTemplateWidth = (value: string) => {
    setNewTemplate((draft) => {
      const height = calculatedHeight(cmToMm(value), draft.aspect_ratio);
      return {
        ...draft,
        width_mm: value,
        ...(height ? { height_mm: mmToCmInputValue(height) } : {}),
      };
    });
  };

  const updateNewTemplateHeight = (value: string) => {
    setNewTemplate((draft) => {
      const width = calculatedWidth(cmToMm(value), draft.aspect_ratio);
      return {
        ...draft,
        height_mm: value,
        ...(width ? { width_mm: mmToCmInputValue(width) } : {}),
      };
    });
  };

  const toggleActive = async (profile: PrintProfile) => {
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/admin/print-profiles/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !profile.is_active }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Failed to update profile.");
      return;
    }

    const updated = (await response.json()) as PrintProfile;
    setProfiles((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
    setMessage(`${updated.display_name} is now ${updated.is_active ? "active" : "inactive"}.`);
    router.refresh();
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.panel}>
        <h2>Square-inch retail pricing</h2>
        <p className={styles.muted}>
          Import Wizard and product editor use Pixel Perfect lab cost (area × rate) × this markup for suggested
          retail. Existing catalogue prices are unchanged until you re-save a variant.
        </p>
        <p className={styles.muted}>
          {PIXEL_PERFECT_PRICELIST_NOTE}: standard inkjet ${PIXEL_PERFECT_SQ_IN_RATES_AUD.standard_inkjet.toFixed(3)}
          /sq in · premium inkjet ${PIXEL_PERFECT_SQ_IN_RATES_AUD.premium_inkjet.toFixed(3)}/sq in (read-only).
        </p>
        <div className={styles.grid}>
          <label>
            Retail markup factor
            <input
              type="number"
              min="1"
              max="20"
              step="0.1"
              value={markupFactor}
              onChange={(event) => setMarkupFactor(event.target.value)}
            />
          </label>
        </div>
        <p className={styles.muted}>Default is {DEFAULT_PRINT_PRICE_MARKUP_FACTOR}×. Allowed range 1–20.</p>
        {message ? <p className={styles.success}>{message}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
        <button className={styles.button} type="button" disabled={savingMarkup} onClick={() => void saveMarkupFactor()}>
          {savingMarkup ? "Saving…" : "Save markup"}
        </button>
      </section>

      <section className={styles.panel}>
        <h2>Optional Reference ICC Profiles</h2>
        <p className={styles.muted}>
          Pixel Perfect print files are prepared in Adobe RGB 1998. Uploaded paper profiles are retained only as
          reference/proofing metadata, not as required output profiles.
        </p>
        <form className={styles.form} onSubmit={uploadProfile}>
          <div className={styles.grid}>
            <label>
              Display name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
            <label>
              Role
              <select value={profileRole} onChange={(event) => setProfileRole(event.target.value as "source" | "destination")}>
                <option value="destination">Proofing/reference</option>
                <option value="source">Source/input</option>
              </select>
            </label>
            <label>
              Colour space
              <input value={colourSpace} onChange={(event) => setColourSpace(event.target.value)} />
            </label>
            <label>
              Paper type
              <input value={paperType} onChange={(event) => setPaperType(event.target.value)} />
            </label>
            <label>
              Print type
              <select value={printType} onChange={(event) => setPrintType(event.target.value)}>
                {printTypes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Active
              <select value={String(isActive)} onChange={(event) => setIsActive(event.target.value === "true")}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
          </div>

          <label>
            ICC/ICM file
            <input
              key={file?.name ?? "empty"}
              type="file"
              accept=".icc,.icm,application/vnd.iccprofile"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>

          {message ? <p className={styles.success}>{message}</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}

          <button className={styles.button} type="submit" disabled={saving}>
            {saving ? "Uploading..." : "Upload Profile"}
          </button>
        </form>
      </section>

      <section className={styles.panel}>
        <h2>Print Templates For New Products</h2>
        <p className={styles.muted}>
          These templates are copied into product variants when a new photo is registered. Existing products are not
          changed when templates are edited here.
        </p>
        <div className={styles.templatePanelList}>
          {variantTemplates.map((template) => (
            <details className={styles.templatePanel} key={template.id}>
              <summary className={styles.templateSummary}>
                <span>
                  <strong>{template.variant_label}</strong>
                  <span className={styles.muted}>
                    {mmToCmInputValue(template.width_mm)} x {mmToCmInputValue(template.height_mm)} cm
                    {template.aspect_ratio ? `, ${template.aspect_ratio}` : ""} / {template.print_dpi ?? 300} dpi / {template.paper_type} / ${(template.base_price_aud / 100).toFixed(2)}
                  </span>
                </span>
                <span className={template.is_active ? styles.statusActive : styles.statusInactive}>
                  {template.is_active ? "Active" : "Inactive"}
                </span>
              </summary>
              <div className={styles.templateEditorGrid}>
                <section className={styles.templateEditorSection}>
                  <h3>Identity</h3>
                  <div className={styles.templateFieldGrid}>
                    <label className={styles.inlineLabel}>
                      Label
                      <input value={template.variant_label} onChange={(event) => updateTemplate(template.id, { variant_label: event.target.value })} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Sort
                      <input type="number" value={template.sort_order} onChange={(event) => updateTemplate(template.id, { sort_order: Number.parseInt(event.target.value || "0", 10) || 0 })} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Tier
                      <input value={template.tier_label ?? ""} onChange={(event) => updateTemplate(template.id, { tier_label: nullableText(event.target.value) })} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Edition size override
                      <input type="number" min="1" value={template.edition_size ?? ""} onChange={(event) => updateTemplate(template.id, { edition_size: intOrNull(event.target.value) })} />
                    </label>
                  </div>
                </section>

                <section className={styles.templateEditorSection}>
                  <h3>Size</h3>
                  <div className={styles.templateFieldGrid}>
                    <label className={styles.inlineLabel}>
                      Aspect ratio
                      <input placeholder="3:2, 16:9, 2.39:1" value={template.aspect_ratio ?? ""} onChange={(event) => updateTemplateAspectRatio(template, event.target.value)} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Width cm
                      <input type="number" min="0.1" step="0.1" value={mmToCmInputValue(template.width_mm)} onChange={(event) => updateTemplateWidth(template, event.target.value)} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Height cm
                      <input type="number" min="0.1" step="0.1" value={mmToCmInputValue(template.height_mm)} onChange={(event) => updateTemplateHeight(template, event.target.value)} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Print DPI
                      <input type="number" min="1" value={template.print_dpi ?? 300} onChange={(event) => updateTemplate(template.id, { print_dpi: Number.parseInt(event.target.value || "300", 10) || 300 })} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Border cm
                      <input type="number" min="0" step="0.1" value={mmToCmInputValue(template.border_mm)} onChange={(event) => updateTemplate(template.id, { border_mm: cmToMm(event.target.value) })} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Front W
                      <input type="number" min="1" value={template.front_face_width_mm ?? ""} onChange={(event) => updateTemplate(template.id, { front_face_width_mm: intOrNull(event.target.value) })} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Front H
                      <input type="number" min="1" value={template.front_face_height_mm ?? ""} onChange={(event) => updateTemplate(template.id, { front_face_height_mm: intOrNull(event.target.value) })} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Canvas wrap mm
                      <input type="number" min="0" value={template.canvas_wrap_mm ?? ""} onChange={(event) => updateTemplate(template.id, { canvas_wrap_mm: intOrNull(event.target.value) })} />
                    </label>
                    <p className={styles.calculatedPixels}>
                      Output pixels: {printPixels(template.width_mm + template.border_mm * 2, template.print_dpi ?? 300)} x {printPixels(template.height_mm + template.border_mm * 2, template.print_dpi ?? 300)}
                    </p>
                  </div>
                </section>

                <section className={styles.templateEditorSection}>
                  <h3>Paper / Medium</h3>
                  <div className={styles.templateFieldGrid}>
                    <label className={styles.inlineLabel}>
                      Paper type
                      <input value={template.paper_type} onChange={(event) => updateTemplate(template.id, { paper_type: event.target.value })} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Finish
                      <input value={template.finish ?? ""} onChange={(event) => updateTemplate(template.id, { finish: nullableText(event.target.value) })} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Print type
                      <input value={template.print_type} onChange={(event) => updateTemplate(template.id, { print_type: event.target.value })} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Framed
                      <select value={String(template.is_framed)} onChange={(event) => updateTemplate(template.id, { is_framed: event.target.value === "true" })}>
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </label>
                    <label className={styles.inlineLabel}>
                      Frame type
                      <input value={template.frame_type ?? ""} onChange={(event) => updateTemplate(template.id, { frame_type: nullableText(event.target.value) })} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Wrap style
                      <input value={template.wrap_style ?? ""} onChange={(event) => updateTemplate(template.id, { wrap_style: nullableText(event.target.value) })} />
                    </label>
                  </div>
                </section>

                <section className={styles.templateEditorSection}>
                  <h3>Price</h3>
                  <div className={styles.templateFieldGrid}>
                    <label className={styles.inlineLabel}>
                      Base price AUD
                      <input type="number" min="0" step="0.01" value={(template.base_price_aud / 100).toFixed(2)} onChange={(event) => updateTemplate(template.id, { base_price_aud: Math.round((Number.parseFloat(event.target.value || "0") || 0) * 100) })} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Lab cost AUD
                      <input type="number" min="0" step="0.01" value={centsInputValue(template.lab_cost_aud)} onChange={(event) => updateTemplate(template.id, { lab_cost_aud: dollarsToCentsOrNull(event.target.value) })} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Retail min AUD
                      <input type="number" min="0" step="0.01" value={centsInputValue(template.suggested_retail_min_aud)} onChange={(event) => updateTemplate(template.id, { suggested_retail_min_aud: dollarsToCentsOrNull(event.target.value) })} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Retail max AUD
                      <input type="number" min="0" step="0.01" value={centsInputValue(template.suggested_retail_max_aud)} onChange={(event) => updateTemplate(template.id, { suggested_retail_max_aud: dollarsToCentsOrNull(event.target.value) })} />
                    </label>
                  </div>
                </section>

                <section className={styles.templateEditorSection}>
                  <h3>Fulfilment</h3>
                  <div className={styles.templateFieldGrid}>
                    <label className={styles.inlineLabel}>
                      Turnaround min
                      <input type="number" min="1" value={template.turnaround_days_min ?? ""} onChange={(event) => updateTemplate(template.id, { turnaround_days_min: intOrNull(event.target.value) })} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Turnaround max
                      <input type="number" min="1" value={template.turnaround_days_max ?? ""} onChange={(event) => updateTemplate(template.id, { turnaround_days_max: intOrNull(event.target.value) })} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Shipping class
                      <input value={template.shipping_class ?? ""} onChange={(event) => updateTemplate(template.id, { shipping_class: nullableText(event.target.value) })} />
                    </label>
                    <label className={styles.inlineLabel}>
                      Fulfilment notes
                      <textarea value={template.fulfilment_notes ?? ""} onChange={(event) => updateTemplate(template.id, { fulfilment_notes: nullableText(event.target.value) })} />
                    </label>
                  </div>
                </section>

                <section className={styles.templateEditorSection}>
                  <h3>Status</h3>
                  <div className={styles.templateFieldGrid}>
                    <select value={String(template.is_active)} onChange={(event) => updateTemplate(template.id, { is_active: event.target.value === "true" })}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                    <div className={styles.actionStack}>
                      <button className={styles.button} type="button" onClick={() => saveVariantTemplate(template)}>Save</button>
                      <button className={styles.secondaryButton} type="button" onClick={() => copyTemplateToNewDraft(template)}>Copy template</button>
                      <button className={styles.secondaryButton} type="button" onClick={() => deleteVariantTemplate(template)}>Delete</button>
                    </div>
                  </div>
                </section>
              </div>
            </details>
          ))}
        </div>

        <details className={styles.templatePanel} open={newTemplateFormOpen} onToggle={(event) => setNewTemplateFormOpen(event.currentTarget.open)}>
          <summary className={styles.templateSummary}>
            <span>
              <strong>Add New Print Template</strong>
              <span className={styles.muted}>Create a template for future product registrations.</span>
            </span>
          </summary>
          <div className={styles.templateEditorGrid}>
            <section className={styles.templateEditorSection}>
              <h3>Identity</h3>
              <div className={styles.templateFieldGrid}>
                <label className={styles.inlineLabel}>Label<input placeholder="A2 / Hahnemühle Photo Rag" value={newTemplate.variant_label} onChange={(event) => setNewTemplate((draft) => ({ ...draft, variant_label: event.target.value }))} /></label>
                <label className={styles.inlineLabel}>Sort<input type="number" value={newTemplate.sort_order} onChange={(event) => setNewTemplate((draft) => ({ ...draft, sort_order: event.target.value }))} /></label>
                <label className={styles.inlineLabel}>Tier<input value={newTemplate.tier_label} onChange={(event) => setNewTemplate((draft) => ({ ...draft, tier_label: event.target.value }))} /></label>
                <label className={styles.inlineLabel}>Edition size override<input type="number" min="1" value={newTemplate.edition_size} onChange={(event) => setNewTemplate((draft) => ({ ...draft, edition_size: event.target.value }))} /></label>
              </div>
            </section>
            <section className={styles.templateEditorSection}>
              <h3>Size</h3>
              <div className={styles.templateFieldGrid}>
                <label className={styles.inlineLabel}>Aspect ratio<input placeholder="3:2, 16:9, 2.39:1" value={newTemplate.aspect_ratio} onChange={(event) => updateNewTemplateAspectRatio(event.target.value)} /></label>
                <label className={styles.inlineLabel}>Width cm<input type="number" min="0.1" step="0.1" value={newTemplate.width_mm} onChange={(event) => updateNewTemplateWidth(event.target.value)} /></label>
                <label className={styles.inlineLabel}>Height cm<input type="number" min="0.1" step="0.1" value={newTemplate.height_mm} onChange={(event) => updateNewTemplateHeight(event.target.value)} /></label>
                <label className={styles.inlineLabel}>Print DPI<input type="number" min="1" value={newTemplate.print_dpi} onChange={(event) => setNewTemplate((draft) => ({ ...draft, print_dpi: event.target.value }))} /></label>
                <label className={styles.inlineLabel}>Border cm<input type="number" min="0" step="0.1" value={newTemplate.border_mm} onChange={(event) => setNewTemplate((draft) => ({ ...draft, border_mm: event.target.value }))} /></label>
                <label className={styles.inlineLabel}>Front W<input type="number" min="1" value={newTemplate.front_face_width_mm} onChange={(event) => setNewTemplate((draft) => ({ ...draft, front_face_width_mm: event.target.value }))} /></label>
                <label className={styles.inlineLabel}>Front H<input type="number" min="1" value={newTemplate.front_face_height_mm} onChange={(event) => setNewTemplate((draft) => ({ ...draft, front_face_height_mm: event.target.value }))} /></label>
                <label className={styles.inlineLabel}>Canvas wrap mm<input type="number" min="0" value={newTemplate.canvas_wrap_mm} onChange={(event) => setNewTemplate((draft) => ({ ...draft, canvas_wrap_mm: event.target.value }))} /></label>
                <p className={styles.calculatedPixels}>
                  Output pixels: {printPixels(cmToMm(newTemplate.width_mm) + cmToMm(newTemplate.border_mm) * 2, Number.parseInt(newTemplate.print_dpi || "300", 10) || 300)} x {printPixels(cmToMm(newTemplate.height_mm) + cmToMm(newTemplate.border_mm) * 2, Number.parseInt(newTemplate.print_dpi || "300", 10) || 300)}
                </p>
              </div>
            </section>
            <section className={styles.templateEditorSection}>
              <h3>Paper / Medium</h3>
              <div className={styles.templateFieldGrid}>
                <label className={styles.inlineLabel}>Paper type<input value={newTemplate.paper_type} onChange={(event) => setNewTemplate((draft) => ({ ...draft, paper_type: event.target.value }))} /></label>
                <label className={styles.inlineLabel}>Finish<input value={newTemplate.finish} onChange={(event) => setNewTemplate((draft) => ({ ...draft, finish: event.target.value }))} /></label>
                <label className={styles.inlineLabel}>Print type<input value={newTemplate.print_type} onChange={(event) => setNewTemplate((draft) => ({ ...draft, print_type: event.target.value }))} /></label>
                <label className={styles.inlineLabel}>Framed<select value={String(newTemplate.is_framed)} onChange={(event) => setNewTemplate((draft) => ({ ...draft, is_framed: event.target.value === "true" }))}><option value="false">No</option><option value="true">Yes</option></select></label>
                <label className={styles.inlineLabel}>Frame type<input value={newTemplate.frame_type} onChange={(event) => setNewTemplate((draft) => ({ ...draft, frame_type: event.target.value }))} /></label>
                <label className={styles.inlineLabel}>Wrap style<input value={newTemplate.wrap_style} onChange={(event) => setNewTemplate((draft) => ({ ...draft, wrap_style: event.target.value }))} /></label>
              </div>
            </section>
            <section className={styles.templateEditorSection}>
              <h3>Price</h3>
              <div className={styles.templateFieldGrid}>
                <label className={styles.inlineLabel}>Base price AUD<input type="number" min="0" step="0.01" value={newTemplate.base_price_dollars} onChange={(event) => setNewTemplate((draft) => ({ ...draft, base_price_dollars: event.target.value }))} /></label>
                <label className={styles.inlineLabel}>Lab cost AUD<input type="number" min="0" step="0.01" value={newTemplate.lab_cost_dollars} onChange={(event) => setNewTemplate((draft) => ({ ...draft, lab_cost_dollars: event.target.value }))} /></label>
                <label className={styles.inlineLabel}>Retail min AUD<input type="number" min="0" step="0.01" value={newTemplate.suggested_retail_min_dollars} onChange={(event) => setNewTemplate((draft) => ({ ...draft, suggested_retail_min_dollars: event.target.value }))} /></label>
                <label className={styles.inlineLabel}>Retail max AUD<input type="number" min="0" step="0.01" value={newTemplate.suggested_retail_max_dollars} onChange={(event) => setNewTemplate((draft) => ({ ...draft, suggested_retail_max_dollars: event.target.value }))} /></label>
              </div>
            </section>
            <section className={styles.templateEditorSection}>
              <h3>Fulfilment</h3>
              <div className={styles.templateFieldGrid}>
                <label className={styles.inlineLabel}>Turnaround min<input type="number" min="1" value={newTemplate.turnaround_days_min} onChange={(event) => setNewTemplate((draft) => ({ ...draft, turnaround_days_min: event.target.value }))} /></label>
                <label className={styles.inlineLabel}>Turnaround max<input type="number" min="1" value={newTemplate.turnaround_days_max} onChange={(event) => setNewTemplate((draft) => ({ ...draft, turnaround_days_max: event.target.value }))} /></label>
                <label className={styles.inlineLabel}>Shipping class<input value={newTemplate.shipping_class} onChange={(event) => setNewTemplate((draft) => ({ ...draft, shipping_class: event.target.value }))} /></label>
                <label className={styles.inlineLabel}>Fulfilment notes<textarea value={newTemplate.fulfilment_notes} onChange={(event) => setNewTemplate((draft) => ({ ...draft, fulfilment_notes: event.target.value }))} /></label>
              </div>
            </section>
            <section className={styles.templateEditorSection}>
              <h3>Status</h3>
              <div className={styles.templateFieldGrid}>
                <select value={String(newTemplate.is_active)} onChange={(event) => setNewTemplate((draft) => ({ ...draft, is_active: event.target.value === "true" }))}><option value="true">Active</option><option value="false">Inactive</option></select>
                <button className={styles.button} type="button" onClick={createVariantTemplate}>Add Template</button>
              </div>
            </section>
          </div>
        </details>

        <div className={styles.legacyTemplateTableWrap}>
          <table className={styles.templateTable}>
            <thead>
              <tr>
                <th>Label</th>
                <th>Size mm</th>
                <th>Paper / medium</th>
                <th>Price</th>
                <th>Fulfilment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {variantTemplates.map((template) => (
                <tr key={template.id}>
                  <td>
                    <input
                      value={template.variant_label}
                      onChange={(event) => updateTemplate(template.id, { variant_label: event.target.value })}
                    />
                    <label className={styles.inlineLabel}>
                      Sort
                      <input
                        type="number"
                        value={template.sort_order}
                        onChange={(event) =>
                          updateTemplate(template.id, { sort_order: Number.parseInt(event.target.value || "0", 10) || 0 })
                        }
                      />
                    </label>
                    <label className={styles.inlineLabel}>
                      Tier
                      <input
                        value={template.tier_label ?? ""}
                        onChange={(event) => updateTemplate(template.id, { tier_label: nullableText(event.target.value) })}
                      />
                    </label>
                    <label className={styles.inlineLabel}>
                      Edition size override
                      <input
                        type="number"
                        min="1"
                        value={template.edition_size ?? ""}
                        onChange={(event) => updateTemplate(template.id, { edition_size: intOrNull(event.target.value) })}
                      />
                    </label>
                  </td>
                  <td>
                    <label className={styles.inlineLabel}>
                      Aspect ratio
                      <input
                        placeholder="3:2, 16:9, 2.39:1"
                        value={template.aspect_ratio ?? ""}
                        onChange={(event) => updateTemplateAspectRatio(template, event.target.value)}
                      />
                    </label>
                    <label className={styles.inlineLabel}>
                      W
                      <input
                        type="number"
                        min="1"
                        value={template.width_mm}
                        onChange={(event) => updateTemplateWidth(template, event.target.value)}
                      />
                    </label>
                    <label className={styles.inlineLabel}>
                      H
                      <input
                        type="number"
                        min="1"
                        value={template.height_mm}
                        onChange={(event) => updateTemplateHeight(template, event.target.value)}
                      />
                    </label>
                    <label className={styles.inlineLabel}>
                      Border
                      <input
                        type="number"
                        min="0"
                        value={template.border_mm}
                        onChange={(event) =>
                          updateTemplate(template.id, { border_mm: Number.parseInt(event.target.value || "0", 10) || 0 })
                        }
                      />
                    </label>
                    <label className={styles.inlineLabel}>
                      Front W
                      <input
                        type="number"
                        min="1"
                        value={template.front_face_width_mm ?? ""}
                        onChange={(event) => updateTemplate(template.id, { front_face_width_mm: intOrNull(event.target.value) })}
                      />
                    </label>
                    <label className={styles.inlineLabel}>
                      Front H
                      <input
                        type="number"
                        min="1"
                        value={template.front_face_height_mm ?? ""}
                        onChange={(event) => updateTemplate(template.id, { front_face_height_mm: intOrNull(event.target.value) })}
                      />
                    </label>
                    <label className={styles.inlineLabel}>
                      Canvas wrap mm
                      <input
                        type="number"
                        min="0"
                        value={template.canvas_wrap_mm ?? ""}
                        onChange={(event) => updateTemplate(template.id, { canvas_wrap_mm: intOrNull(event.target.value) })}
                      />
                    </label>
                  </td>
                  <td>
                    <input
                      value={template.paper_type}
                      onChange={(event) => updateTemplate(template.id, { paper_type: event.target.value })}
                    />
                    <input
                      placeholder="Finish"
                      value={template.finish ?? ""}
                      onChange={(event) => updateTemplate(template.id, { finish: nullableText(event.target.value) })}
                    />
                    <input
                      placeholder="Print type"
                      value={template.print_type}
                      onChange={(event) => updateTemplate(template.id, { print_type: event.target.value })}
                    />
                    <label className={styles.inlineLabel}>
                      Framed
                      <select
                        value={String(template.is_framed)}
                        onChange={(event) => updateTemplate(template.id, { is_framed: event.target.value === "true" })}
                      >
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </label>
                    <input
                      placeholder="Frame type"
                      value={template.frame_type ?? ""}
                      onChange={(event) => updateTemplate(template.id, { frame_type: nullableText(event.target.value) })}
                    />
                    <input
                      placeholder="Wrap style"
                      value={template.wrap_style ?? ""}
                      onChange={(event) => updateTemplate(template.id, { wrap_style: nullableText(event.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={(template.base_price_aud / 100).toFixed(2)}
                      onChange={(event) =>
                        updateTemplate(template.id, {
                          base_price_aud: Math.round((Number.parseFloat(event.target.value || "0") || 0) * 100),
                        })
                      }
                    />
                    <label className={styles.inlineLabel}>
                      Lab cost AUD
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={centsInputValue(template.lab_cost_aud)}
                        onChange={(event) => updateTemplate(template.id, { lab_cost_aud: dollarsToCentsOrNull(event.target.value) })}
                      />
                    </label>
                    <label className={styles.inlineLabel}>
                      Retail min AUD
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={centsInputValue(template.suggested_retail_min_aud)}
                        onChange={(event) =>
                          updateTemplate(template.id, { suggested_retail_min_aud: dollarsToCentsOrNull(event.target.value) })
                        }
                      />
                    </label>
                    <label className={styles.inlineLabel}>
                      Retail max AUD
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={centsInputValue(template.suggested_retail_max_aud)}
                        onChange={(event) =>
                          updateTemplate(template.id, { suggested_retail_max_aud: dollarsToCentsOrNull(event.target.value) })
                        }
                      />
                    </label>
                  </td>
                  <td>
                    <label className={styles.inlineLabel}>
                      Turnaround min
                      <input
                        type="number"
                        min="1"
                        value={template.turnaround_days_min ?? ""}
                        onChange={(event) => updateTemplate(template.id, { turnaround_days_min: intOrNull(event.target.value) })}
                      />
                    </label>
                    <label className={styles.inlineLabel}>
                      Turnaround max
                      <input
                        type="number"
                        min="1"
                        value={template.turnaround_days_max ?? ""}
                        onChange={(event) => updateTemplate(template.id, { turnaround_days_max: intOrNull(event.target.value) })}
                      />
                    </label>
                    <input
                      placeholder="Shipping class"
                      value={template.shipping_class ?? ""}
                      onChange={(event) => updateTemplate(template.id, { shipping_class: nullableText(event.target.value) })}
                    />
                    <textarea
                      placeholder="Fulfilment notes"
                      value={template.fulfilment_notes ?? ""}
                      onChange={(event) => updateTemplate(template.id, { fulfilment_notes: nullableText(event.target.value) })}
                    />
                  </td>
                  <td>
                    <select
                      value={String(template.is_active)}
                      onChange={(event) => updateTemplate(template.id, { is_active: event.target.value === "true" })}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </td>
                  <td>
                    <div className={styles.actionStack}>
                      <button className={styles.button} type="button" onClick={() => saveVariantTemplate(template)}>
                        Save
                      </button>
                      <button className={styles.secondaryButton} type="button" onClick={() => copyTemplateToNewDraft(template)}>
                        Copy template
                      </button>
                      <button className={styles.secondaryButton} type="button" onClick={() => deleteVariantTemplate(template)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              <tr>
                <td>
                  <input
                    placeholder="A2 / Hahnemühle Photo Rag"
                    value={newTemplate.variant_label}
                    onChange={(event) => setNewTemplate((draft) => ({ ...draft, variant_label: event.target.value }))}
                  />
                  <label className={styles.inlineLabel}>
                    Sort
                    <input
                      type="number"
                      value={newTemplate.sort_order}
                      onChange={(event) => setNewTemplate((draft) => ({ ...draft, sort_order: event.target.value }))}
                    />
                  </label>
                  <label className={styles.inlineLabel}>
                    Tier
                    <input
                      value={newTemplate.tier_label}
                      onChange={(event) => setNewTemplate((draft) => ({ ...draft, tier_label: event.target.value }))}
                    />
                  </label>
                  <label className={styles.inlineLabel}>
                    Edition size override
                    <input
                      type="number"
                      min="1"
                      value={newTemplate.edition_size}
                      onChange={(event) => setNewTemplate((draft) => ({ ...draft, edition_size: event.target.value }))}
                    />
                  </label>
                </td>
                <td>
                  <label className={styles.inlineLabel}>
                    Aspect ratio
                    <input
                      placeholder="3:2, 16:9, 2.39:1"
                      value={newTemplate.aspect_ratio}
                      onChange={(event) => updateNewTemplateAspectRatio(event.target.value)}
                    />
                  </label>
                  <label className={styles.inlineLabel}>
                    W
                    <input
                      type="number"
                      min="1"
                      value={newTemplate.width_mm}
                      onChange={(event) => updateNewTemplateWidth(event.target.value)}
                    />
                  </label>
                  <label className={styles.inlineLabel}>
                    H
                    <input
                      type="number"
                      min="1"
                      value={newTemplate.height_mm}
                      onChange={(event) => updateNewTemplateHeight(event.target.value)}
                    />
                  </label>
                  <label className={styles.inlineLabel}>
                    Border
                    <input
                      type="number"
                      min="0"
                      value={newTemplate.border_mm}
                      onChange={(event) => setNewTemplate((draft) => ({ ...draft, border_mm: event.target.value }))}
                    />
                  </label>
                  <label className={styles.inlineLabel}>
                    Front W
                    <input
                      type="number"
                      min="1"
                      value={newTemplate.front_face_width_mm}
                      onChange={(event) => setNewTemplate((draft) => ({ ...draft, front_face_width_mm: event.target.value }))}
                    />
                  </label>
                  <label className={styles.inlineLabel}>
                    Front H
                    <input
                      type="number"
                      min="1"
                      value={newTemplate.front_face_height_mm}
                      onChange={(event) => setNewTemplate((draft) => ({ ...draft, front_face_height_mm: event.target.value }))}
                    />
                  </label>
                  <label className={styles.inlineLabel}>
                    Canvas wrap mm
                    <input
                      type="number"
                      min="0"
                      value={newTemplate.canvas_wrap_mm}
                      onChange={(event) => setNewTemplate((draft) => ({ ...draft, canvas_wrap_mm: event.target.value }))}
                    />
                  </label>
                </td>
                <td>
                  <input
                    placeholder="Paper type"
                    value={newTemplate.paper_type}
                    onChange={(event) => setNewTemplate((draft) => ({ ...draft, paper_type: event.target.value }))}
                  />
                  <input
                    placeholder="Finish"
                    value={newTemplate.finish}
                    onChange={(event) => setNewTemplate((draft) => ({ ...draft, finish: event.target.value }))}
                  />
                  <input
                    placeholder="fine_art"
                    value={newTemplate.print_type}
                    onChange={(event) => setNewTemplate((draft) => ({ ...draft, print_type: event.target.value }))}
                  />
                  <label className={styles.inlineLabel}>
                    Framed
                    <select
                      value={String(newTemplate.is_framed)}
                      onChange={(event) => setNewTemplate((draft) => ({ ...draft, is_framed: event.target.value === "true" }))}
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </label>
                  <input
                    placeholder="Frame type"
                    value={newTemplate.frame_type}
                    onChange={(event) => setNewTemplate((draft) => ({ ...draft, frame_type: event.target.value }))}
                  />
                  <input
                    placeholder="Wrap style"
                    value={newTemplate.wrap_style}
                    onChange={(event) => setNewTemplate((draft) => ({ ...draft, wrap_style: event.target.value }))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="450.00"
                    value={newTemplate.base_price_dollars}
                    onChange={(event) => setNewTemplate((draft) => ({ ...draft, base_price_dollars: event.target.value }))}
                  />
                  <label className={styles.inlineLabel}>
                    Lab cost AUD
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newTemplate.lab_cost_dollars}
                      onChange={(event) => setNewTemplate((draft) => ({ ...draft, lab_cost_dollars: event.target.value }))}
                    />
                  </label>
                  <label className={styles.inlineLabel}>
                    Retail min AUD
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newTemplate.suggested_retail_min_dollars}
                      onChange={(event) =>
                        setNewTemplate((draft) => ({ ...draft, suggested_retail_min_dollars: event.target.value }))
                      }
                    />
                  </label>
                  <label className={styles.inlineLabel}>
                    Retail max AUD
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newTemplate.suggested_retail_max_dollars}
                      onChange={(event) =>
                        setNewTemplate((draft) => ({ ...draft, suggested_retail_max_dollars: event.target.value }))
                      }
                    />
                  </label>
                </td>
                <td>
                  <label className={styles.inlineLabel}>
                    Turnaround min
                    <input
                      type="number"
                      min="1"
                      value={newTemplate.turnaround_days_min}
                      onChange={(event) => setNewTemplate((draft) => ({ ...draft, turnaround_days_min: event.target.value }))}
                    />
                  </label>
                  <label className={styles.inlineLabel}>
                    Turnaround max
                    <input
                      type="number"
                      min="1"
                      value={newTemplate.turnaround_days_max}
                      onChange={(event) => setNewTemplate((draft) => ({ ...draft, turnaround_days_max: event.target.value }))}
                    />
                  </label>
                  <input
                    placeholder="Shipping class"
                    value={newTemplate.shipping_class}
                    onChange={(event) => setNewTemplate((draft) => ({ ...draft, shipping_class: event.target.value }))}
                  />
                  <textarea
                    placeholder="Fulfilment notes"
                    value={newTemplate.fulfilment_notes}
                    onChange={(event) => setNewTemplate((draft) => ({ ...draft, fulfilment_notes: event.target.value }))}
                  />
                </td>
                <td>
                  <select
                    value={String(newTemplate.is_active)}
                    onChange={(event) => setNewTemplate((draft) => ({ ...draft, is_active: event.target.value === "true" }))}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </td>
                <td>
                  <button className={styles.button} type="button" onClick={createVariantTemplate}>
                    Add Template
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>Profiles</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Colour / paper</th>
                <th>File</th>
                <th>Checksum</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id}>
                  <td>{profile.display_name}</td>
                  <td>{profile.profile_role}</td>
                  <td>
                    <div>{profile.colour_space ?? "—"}</div>
                    <div className={styles.muted}>{profile.paper_type ?? "Any paper"} / {profile.print_type ?? "Any print"}</div>
                  </td>
                  <td>
                    <div>{profile.original_filename}</div>
                    <div className={styles.muted}>{formatBytes(profile.file_size_bytes)}</div>
                    <div className={styles.muted}>{profile.storage_path}</div>
                  </td>
                  <td className={styles.muted}>{profile.checksum_sha256.slice(0, 16)}...</td>
                  <td>{profile.is_active ? "Active" : "Inactive"}</td>
                  <td>{formatDateTime(profile.created_at)}</td>
                  <td>
                    <button className={styles.button} type="button" onClick={() => toggleActive(profile)}>
                      {profile.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={8}>No print profiles uploaded yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
