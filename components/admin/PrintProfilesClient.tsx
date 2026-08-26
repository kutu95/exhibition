"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import {
  DEFAULT_PRINT_FRAME_BASE_AUD,
  DEFAULT_PRINT_FRAME_MARKUP_FACTOR,
  SEED_FRAME_RATES,
  SEED_RTH_CANVAS_RATES,
  type FrameRateBand,
  type RthCanvasRateBand,
} from "../../lib/print-frame-pricing";
import { DEFAULT_PRINT_PRICE_BASE_AUD, DEFAULT_PRINT_PRICE_MARKUP_FACTOR } from "../../lib/print-markup";
import { OFFER_CLASSES, OFFER_COMBOS, OFFER_FINE_ART_PAPER_LABEL, OFFER_SIZES } from "../../lib/print-offer";
import {
  SEED_POSTERFACTORY_CATALOGUE,
  type PosterFactoryCatalogue,
  type PosterFactoryClassId,
  type PosterFactorySizeId,
} from "../../lib/posterfactory";
import {
  PIXEL_PERFECT_SQ_IN_RATES_AUD,
  PRINT_TYPES,
  seedManagedPapers,
  type ManagedPaper,
  type PrintTypeCode,
} from "../../lib/print-catalogue";
import type { PrintProfile } from "../../lib/supabase/types";
import styles from "./PrintProfilesClient.module.css";

type PrintProfilesClientProps = {
  initialProfiles: PrintProfile[];
  initialMarkupFactor?: number;
  initialBasePriceAud?: number;
  initialFrameMarkupFactor?: number;
  initialFrameBasePriceAud?: number;
  initialFrameRates?: FrameRateBand[];
  initialRthCanvasRates?: RthCanvasRateBand[];
  initialPapers?: ManagedPaper[];
  initialPosterFactory?: PosterFactoryCatalogue;
};

const printTypes = [
  { value: "", label: "Any / unspecified" },
  { value: "fine_art", label: "Fine art" },
  { value: "photo", label: "Photo / C-type" },
  { value: "canvas", label: "Canvas" },
  { value: "metal", label: "Metal" },
];

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDateTime = (value: string): string =>
  new Date(value).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });

export function PrintProfilesClient({
  initialProfiles,
  initialMarkupFactor = DEFAULT_PRINT_PRICE_MARKUP_FACTOR,
  initialBasePriceAud = DEFAULT_PRINT_PRICE_BASE_AUD,
  initialFrameMarkupFactor = DEFAULT_PRINT_FRAME_MARKUP_FACTOR,
  initialFrameBasePriceAud = DEFAULT_PRINT_FRAME_BASE_AUD,
  initialFrameRates = SEED_FRAME_RATES,
  initialRthCanvasRates = SEED_RTH_CANVAS_RATES,
  initialPapers = seedManagedPapers(),
  initialPosterFactory = SEED_POSTERFACTORY_CATALOGUE,
}: PrintProfilesClientProps) {
  const router = useRouter();
  const [profiles, setProfiles] = useState(initialProfiles);
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

  const [markupFactor, setMarkupFactor] = useState(String(initialMarkupFactor));
  const [basePriceAud, setBasePriceAud] = useState(
    Number.isFinite(initialBasePriceAud) ? initialBasePriceAud.toFixed(2) : "0.00",
  );
  const [frameMarkupFactor, setFrameMarkupFactor] = useState(String(initialFrameMarkupFactor));
  const [frameBasePriceAud, setFrameBasePriceAud] = useState(
    Number.isFinite(initialFrameBasePriceAud) ? initialFrameBasePriceAud.toFixed(2) : "0.00",
  );
  const [frameRates, setFrameRates] = useState<FrameRateBand[]>(initialFrameRates);
  const [rthRates, setRthRates] = useState<RthCanvasRateBand[]>(initialRthCanvasRates);
  const [posterfactory, setPosterfactory] = useState<PosterFactoryCatalogue>(initialPosterFactory);
  const [papers, setPapers] = useState<ManagedPaper[]>(initialPapers);
  const [savingPricing, setSavingPricing] = useState(false);
  const [savingPapers, setSavingPapers] = useState(false);
  const [repricing, setRepricing] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [offerResponse, papersResponse] = await Promise.all([
          fetch("/api/admin/print-pricing/offer"),
          fetch("/api/admin/print-pricing/papers"),
        ]);
        if (cancelled) return;

        if (offerResponse.ok) {
          const body = (await offerResponse.json()) as {
            markup_factor?: number;
            base_price_aud?: number;
            frame_markup_factor?: number;
            frame_base_price_aud?: number;
            frame_rates?: FrameRateBand[];
            rth_canvas_rates?: RthCanvasRateBand[];
            posterfactory?: PosterFactoryCatalogue;
          };
          if (typeof body.markup_factor === "number") setMarkupFactor(String(body.markup_factor));
          if (typeof body.base_price_aud === "number") setBasePriceAud(body.base_price_aud.toFixed(2));
          if (typeof body.frame_markup_factor === "number") setFrameMarkupFactor(String(body.frame_markup_factor));
          if (typeof body.frame_base_price_aud === "number") {
            setFrameBasePriceAud(body.frame_base_price_aud.toFixed(2));
          }
          if (Array.isArray(body.frame_rates) && body.frame_rates.length) setFrameRates(body.frame_rates);
          if (Array.isArray(body.rth_canvas_rates) && body.rth_canvas_rates.length) {
            setRthRates(body.rth_canvas_rates);
          }
          if (body.posterfactory) setPosterfactory(body.posterfactory);
        }

        if (papersResponse.ok) {
          const body = (await papersResponse.json()) as { papers?: ManagedPaper[] };
          if (Array.isArray(body.papers) && body.papers.length > 0) setPapers(body.papers);
        }
      } catch {
        // Keep SSR defaults.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const savePricing = async () => {
    const mediaMarkup = Number.parseFloat(markupFactor);
    const mediaBase = Number.parseFloat(basePriceAud);
    const frameMarkup = Number.parseFloat(frameMarkupFactor);
    const frameBase = Number.parseFloat(frameBasePriceAud);
    if (![mediaMarkup, frameMarkup].every((n) => Number.isFinite(n) && n >= 1 && n <= 20)) {
      setError("Markup factors must be between 1 and 20.");
      return;
    }
    if (![mediaBase, frameBase].every((n) => Number.isFinite(n) && n >= 0)) {
      setError("Base prices must be 0 or more.");
      return;
    }

    setSavingPricing(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/admin/print-pricing/offer", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markup_factor: mediaMarkup,
        base_price_aud: mediaBase,
        frame_markup_factor: frameMarkup,
        frame_base_price_aud: frameBase,
        frame_rates: frameRates,
        rth_canvas_rates: rthRates,
        posterfactory,
      }),
    });

    setSavingPricing(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Failed to save offer pricing.");
      return;
    }

    const body = (await response.json()) as {
      markup_factor: number;
      base_price_aud: number;
      frame_markup_factor: number;
      frame_base_price_aud: number;
      frame_rates: FrameRateBand[];
      rth_canvas_rates: RthCanvasRateBand[];
      posterfactory?: PosterFactoryCatalogue;
    };
    setMarkupFactor(String(body.markup_factor));
    setBasePriceAud(body.base_price_aud.toFixed(2));
    setFrameMarkupFactor(String(body.frame_markup_factor));
    setFrameBasePriceAud(body.frame_base_price_aud.toFixed(2));
    setFrameRates(body.frame_rates);
    setRthRates(body.rth_canvas_rates);
    if (body.posterfactory) setPosterfactory(body.posterfactory);
    setMessage("Saved media, PosterFactory, and frame pricing.");
    router.refresh();
  };

  const updatePaper = (id: string, updates: Partial<ManagedPaper>) => {
    setPapers((rows) => rows.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };

  const updatePosterFactorySize = (
    classId: PosterFactoryClassId,
    sizeId: PosterFactorySizeId,
    updates: Partial<PosterFactoryCatalogue[PosterFactoryClassId]["sizes"][PosterFactorySizeId]>,
  ) => {
    setPosterfactory((current) => ({
      ...current,
      [classId]: {
        ...current[classId],
        sizes: {
          ...current[classId].sizes,
          [sizeId]: { ...current[classId].sizes[sizeId], ...updates },
        },
      },
    }));
  };

  const addPaper = () => {
    const sortOrder = papers.reduce((max, paper) => Math.max(max, paper.sortOrder), -1) + 1;
    setPapers((rows) => [
      ...rows,
      {
        id: `paper-${Date.now()}`,
        label: "New paper",
        printType: "fine_art" as PrintTypeCode,
        ratePerSqInAud: PIXEL_PERFECT_SQ_IN_RATES_AUD.standard_inkjet,
        isActive: true,
        sortOrder,
      },
    ]);
  };

  const savePapers = async () => {
    if (papers.some((paper) => !paper.label.trim())) {
      setError("Every paper needs a label.");
      return;
    }

    setSavingPapers(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/admin/print-pricing/papers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        papers: papers.map((paper, index) => ({
          ...paper,
          label: paper.label.trim(),
          sortOrder: Number.isFinite(paper.sortOrder) ? paper.sortOrder : index,
        })),
      }),
    });

    setSavingPapers(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Failed to save papers.");
      return;
    }

    const body = (await response.json()) as { papers: ManagedPaper[] };
    setPapers(body.papers);
    setMessage(`Saved ${body.papers.length} paper(s) / media types.`);
    router.refresh();
  };

  const repriceAll = async () => {
    const confirmed = window.confirm(
      "Reprice all active offer variants using saved media/frame markups and rate tables?\n\nSave pricing first if you edited the form.",
    );
    if (!confirmed) return;

    setRepricing(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/print-pricing/reprice-all", { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        scanned?: number;
        updated?: number;
        unchanged?: number;
        skipped?: number;
      } | null;
      if (!response.ok) {
        setError(body?.error ?? "Failed to reprice.");
        return;
      }
      setMessage(
        `Repriced: ${body?.updated ?? 0} updated, ${body?.unchanged ?? 0} unchanged, ${body?.skipped ?? 0} skipped (${body?.scanned ?? 0} scanned).`,
      );
      router.refresh();
    } catch {
      setError("Failed to reprice catalogue.");
    } finally {
      setRepricing(false);
    }
  };

  const rebuildAll = async () => {
    const confirmed = window.confirm(
      `Rebuild ALL print products to the ${OFFER_COMBOS.length}-SKU offer (Photographic / Fine Art / Framed / Canvas)?\n\nThis deactivates existing variants and creates new ones. Past orders keep old variant rows. Save pricing first.`,
    );
    if (!confirmed) return;

    setRebuilding(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/print-pricing/rebuild-all", { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        productsScanned?: number;
        productsRebuilt?: number;
        productsSkipped?: number;
        variantsDeactivated?: number;
        variantsCreated?: number;
        skippedSampleTitles?: string[];
      } | null;
      if (!response.ok) {
        setError(body?.error ?? "Failed to rebuild catalogue.");
        return;
      }
      const skipped =
        body?.productsSkipped && body.productsSkipped > 0
          ? ` Skipped ${body.productsSkipped}${
              body.skippedSampleTitles?.length ? `: ${body.skippedSampleTitles.slice(0, 5).join("; ")}` : ""
            }.`
          : "";
      setMessage(
        `Rebuilt ${body?.productsRebuilt ?? 0}/${body?.productsScanned ?? 0} products · deactivated ${body?.variantsDeactivated ?? 0} · created ${body?.variantsCreated ?? 0}.${skipped}`,
      );
      router.refresh();
    } catch {
      setError("Failed to rebuild catalogue.");
    } finally {
      setRebuilding(false);
    }
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

  const toggleActive = async (profile: PrintProfile) => {
    const response = await fetch(`/api/admin/print-profiles/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !profile.is_active }),
    });
    if (!response.ok) {
      setError("Failed to update profile.");
      return;
    }
    const updated = (await response.json()) as PrintProfile;
    setProfiles((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.panel}>
        <h2>Buyer print offer</h2>
        <p className={styles.muted}>
          Fixed catalogue recipe: {OFFER_SIZES.map((s) => s.label).join(" / ")} ×{" "}
          {OFFER_CLASSES.map((id) =>
            id === "photographic"
              ? "Photographic Print (PosterFactory)"
              : id === "fine_art"
                ? "Fine Art Print (Pixel Perfect)"
                : id === "framed"
                  ? "Framed Print (PosterFactory)"
                  : "Canvas (Pixel Perfect)",
          ).join(" / ")}{" "}
          ({OFFER_COMBOS.length} SKUs). Fine art paper: {OFFER_FINE_ART_PAPER_LABEL}. Photographic and framed
          supplier costs are edited in the PosterFactory table below. Retail uses the media markup unless a
          PosterFactory retail override is set.
        </p>

        <h3 className={styles.papersHeading}>Media markup</h3>
        <div className={styles.grid}>
          <label>
            Base price (AUD)
            <input type="number" min="0" step="0.01" value={basePriceAud} onChange={(e) => setBasePriceAud(e.target.value)} />
          </label>
          <label>
            Markup × lab
            <input type="number" min="1" max="20" step="0.01" value={markupFactor} onChange={(e) => setMarkupFactor(e.target.value)} />
          </label>
        </div>

        <h3 className={styles.papersHeading}>PosterFactory products</h3>
        <p className={styles.muted}>
          Supplier cost is what PosterFactory charges (AUD incl. GST). Retail is calculated from the media markup
          unless you set a retail override. Smooth Pearl uses published A2 $32 (~8.28¢/sq in); Small/Large are A3/A1
          at that rate. Photo+Frame from $99 is published; Medium/Large framed remain estimates until confirmed. Save
          this form, then rebuild SKUs.
        </p>
        <div className={styles.papersTableWrap}>
          <table className={styles.papersTable}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Paper / SKU</th>
                <th>Size</th>
                <th>Supplier cost</th>
                <th>Retail override</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {(["photographic", "framed"] as const).flatMap((classId) => {
                const product = posterfactory[classId];
                return (["small", "medium", "large"] as const).map((sizeId, index) => {
                  const row = product.sizes[sizeId];
                  return (
                    <tr key={`${classId}-${sizeId}`}>
                      <td>{index === 0 ? product.label : ""}</td>
                      <td>{index === 0 ? `${product.paper} · ${product.productCode}` : ""}</td>
                      <td>{sizeId}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.supplierCostAud}
                          onChange={(event) =>
                            updatePosterFactorySize(classId, sizeId, {
                              supplierCostAud: Number.parseFloat(event.target.value) || 0,
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="markup"
                          value={row.retailPriceAud ?? ""}
                          onChange={(event) => {
                            const raw = event.target.value.trim();
                            updatePosterFactorySize(classId, sizeId, {
                              retailPriceAud: raw === "" ? null : Number.parseFloat(raw) || 0,
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={row.isActive}
                          onChange={(event) =>
                            updatePosterFactorySize(classId, sizeId, { isActive: event.target.checked })
                          }
                        />
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>

        <h3 className={styles.papersHeading}>Papers / media</h3>
        <p className={styles.muted}>
          Active papers with a $/sq in rate appear on the custom print page. Uncheck Active to hide a paper from buyers.
          Leave rate blank for quote-only media (no formula price). The standard shop Fine Art option uses{" "}
          {OFFER_FINE_ART_PAPER_LABEL}.
        </p>
        <div className={styles.papersTableWrap}>
          <table className={styles.papersTable}>
            <thead>
              <tr>
                <th>Label</th>
                <th>Print type</th>
                <th>$ / sq in</th>
                <th>Sort</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {papers.map((paper) => (
                <tr key={paper.id}>
                  <td>
                    <input
                      value={paper.label}
                      onChange={(event) => updatePaper(paper.id, { label: event.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={paper.printType}
                      onChange={(event) =>
                        updatePaper(paper.id, { printType: event.target.value as PrintTypeCode })
                      }
                    >
                      {PRINT_TYPES.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder="quote"
                      value={paper.ratePerSqInAud === null ? "" : String(paper.ratePerSqInAud)}
                      onChange={(event) => {
                        const raw = event.target.value.trim();
                        updatePaper(paper.id, {
                          ratePerSqInAud: raw === "" ? null : Number.parseFloat(raw),
                        });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="1"
                      value={paper.sortOrder}
                      onChange={(event) =>
                        updatePaper(paper.id, {
                          sortOrder: Number.parseInt(event.target.value || "0", 10) || 0,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={paper.isActive}
                      onChange={(event) => updatePaper(paper.id, { isActive: event.target.checked })}
                      aria-label={`Active ${paper.label}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.papersActions}>
          <button className={styles.buttonSecondary} type="button" onClick={addPaper}>
            Add paper
          </button>
          <button className={styles.button} type="button" disabled={savingPapers} onClick={() => void savePapers()}>
            {savingPapers ? "Saving…" : "Save papers"}
          </button>
        </div>

        <h3 className={styles.papersHeading}>Frame markup</h3>
        <div className={styles.grid}>
          <label>
            Frame base (AUD)
            <input
              type="number"
              min="0"
              step="0.01"
              value={frameBasePriceAud}
              onChange={(e) => setFrameBasePriceAud(e.target.value)}
            />
          </label>
          <label>
            Frame markup × lab
            <input
              type="number"
              min="1"
              max="20"
              step="0.01"
              value={frameMarkupFactor}
              onChange={(e) => setFrameMarkupFactor(e.target.value)}
            />
          </label>
        </div>

        <h3 className={styles.papersHeading}>Standard frame + Perspex (by united inches)</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>uin</th>
                <th>Standard AUD</th>
                <th>Perspex AUD</th>
              </tr>
            </thead>
            <tbody>
              {frameRates.map((band, index) => (
                <tr key={`frame-${band.uin}-${index}`}>
                  <td>
                    <input
                      type="number"
                      value={band.uin}
                      onChange={(e) => {
                        const uin = Number.parseInt(e.target.value || "0", 10) || 0;
                        setFrameRates((rows) => rows.map((row, i) => (i === index ? { ...row, uin } : row)));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={band.standardAud}
                      onChange={(e) => {
                        const standardAud = Number.parseFloat(e.target.value || "0") || 0;
                        setFrameRates((rows) => rows.map((row, i) => (i === index ? { ...row, standardAud } : row)));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={band.perspexAud}
                      onChange={(e) => {
                        const perspexAud = Number.parseFloat(e.target.value || "0") || 0;
                        setFrameRates((rows) => rows.map((row, i) => (i === index ? { ...row, perspexAud } : row)));
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className={styles.papersHeading}>Ready-to-hang canvas packages (by united inches)</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>uin</th>
                <th>Package AUD</th>
              </tr>
            </thead>
            <tbody>
              {rthRates.map((band, index) => (
                <tr key={`rth-${band.uin}-${index}`}>
                  <td>
                    <input
                      type="number"
                      value={band.uin}
                      onChange={(e) => {
                        const uin = Number.parseInt(e.target.value || "0", 10) || 0;
                        setRthRates((rows) => rows.map((row, i) => (i === index ? { ...row, uin } : row)));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={band.packageAud}
                      onChange={(e) => {
                        const packageAud = Number.parseFloat(e.target.value || "0") || 0;
                        setRthRates((rows) => rows.map((row, i) => (i === index ? { ...row, packageAud } : row)));
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.papersActions}>
          <button className={styles.button} type="button" disabled={savingPricing} onClick={() => void savePricing()}>
            {savingPricing ? "Saving…" : "Save pricing"}
          </button>
          <button
            className={styles.button}
            type="button"
            disabled={repricing || savingPricing || rebuilding}
            onClick={() => void repriceAll()}
          >
            {repricing ? "Repricing…" : "Reprice all"}
          </button>
          <button
            className={styles.button}
            type="button"
            disabled={rebuilding || savingPricing || repricing}
            onClick={() => void rebuildAll()}
          >
            {rebuilding ? "Rebuilding…" : "Rebuild all print options"}
          </button>
        </div>

        {message ? <p className={styles.success}>{message}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
      </section>

      <section className={styles.panel}>
        <h2>Optional Reference ICC Profiles</h2>
        <p className={styles.muted}>
          Pixel Perfect print files are prepared in Adobe RGB 1998. Uploaded paper profiles are retained only as
          reference/proofing metadata.
        </p>
        <form className={styles.form} onSubmit={uploadProfile}>
          <div className={styles.grid}>
            <label>
              Display name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
            <label>
              Role
              <select
                value={profileRole}
                onChange={(event) => setProfileRole(event.target.value as "source" | "destination")}
              >
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
          <button className={styles.button} type="submit" disabled={saving}>
            {saving ? "Uploading..." : "Upload Profile"}
          </button>
        </form>
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
                    <div className={styles.muted}>
                      {profile.paper_type ?? "Any paper"} / {profile.print_type ?? "Any print"}
                    </div>
                  </td>
                  <td>
                    <div>{profile.original_filename}</div>
                    <div className={styles.muted}>{formatBytes(profile.file_size_bytes)}</div>
                  </td>
                  <td>{profile.is_active ? "Active" : "Inactive"}</td>
                  <td>{formatDateTime(profile.created_at)}</td>
                  <td>
                    <button className={styles.button} type="button" onClick={() => void toggleActive(profile)}>
                      {profile.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={7}>No print profiles uploaded yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
