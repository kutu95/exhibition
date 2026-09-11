"use client";

import { useMemo, useState } from "react";

import { buildWallProductUrl } from "../../lib/exhibition-links";
import {
  groupWallQrProductsByLocation,
  sortWallQrProducts,
  wallLabelDownloadQuery,
  wallQrLocationLabel,
  WALL_QR_LABELS_PER_PAGE,
} from "../../lib/wall-qr-label-layout";
import styles from "./WallQrLabelsClient.module.css";

export type WallQrProduct = {
  title: string;
  slug: string;
  location_tag: string | null;
  visibility: "public" | "vault";
};

type WallQrLabelsClientProps = {
  products: WallQrProduct[];
  initialSlugs?: string[];
};

export function WallQrLabelsClient({ products, initialSlugs = [] }: WallQrLabelsClientProps) {
  const [includePrivate, setIncludePrivate] = useState(true);
  const [query, setQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSlugs));

  const available = useMemo(() => {
    const filtered = includePrivate ? products : products.filter((product) => product.visibility !== "vault");
    return sortWallQrProducts(filtered);
  }, [includePrivate, products]);

  const locations = useMemo(() => {
    const names = new Set(available.map((product) => wallQrLocationLabel(product.location_tag)));
    return [...names].sort((left, right) => left.localeCompare(right, "en"));
  }, [available]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return available.filter((product) => {
      const location = wallQrLocationLabel(product.location_tag);
      if (locationFilter && location !== locationFilter) return false;
      if (!term) return true;
      return (
        product.title.toLowerCase().includes(term) ||
        product.slug.toLowerCase().includes(term) ||
        location.toLowerCase().includes(term)
      );
    });
  }, [available, locationFilter, query]);

  const selectedLabels = useMemo(
    () => available.filter((product) => selected.has(product.slug)),
    [available, selected],
  );

  const visibleGroups = useMemo(() => groupWallQrProductsByLocation(visible), [visible]);
  const privateCount = products.filter((product) => product.visibility === "vault").length;
  const sheetCount = Math.ceil(selectedLabels.length / WALL_QR_LABELS_PER_PAGE);
  const canDownload = selectedLabels.length > 0;
  const downloadQuery = wallLabelDownloadQuery({
    includeVault: includePrivate,
    slugs: selectedLabels.map((product) => product.slug),
    totalCount: available.length,
  });

  const setSlugSelected = (slug: string, isSelected: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (isSelected) next.add(slug);
      else next.delete(slug);
      return next;
    });
  };

  const setSlugsSelected = (slugs: string[], isSelected: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const slug of slugs) {
        if (isSelected) next.add(slug);
        else next.delete(slug);
      }
      return next;
    });
  };

  return (
    <div>
      <div className={styles.screenOnly}>
        <h1>Wall QR labels</h1>
        <p className={styles.lead}>
          Filter and tick the photographs you want to reprint. Download QR codes, title labels, or caption labels for
          that selection only — or select all for a full set.
        </p>
        <p className={styles.hint}>
          Download the QR PDF and print at <strong>100% / Actual size</strong> (turn off “fit to page”). Each square is
          exactly 5&nbsp;cm. The title under the square is only for matching — trim it off if you want the QR alone on
          the wall. Title labels are a separate PDF: title only, cut on the crop marks. Caption labels are full A4
          width, with title, description, and transcript where there is one — cut on the dashed lines.
        </p>

        <div className={styles.filters}>
          <label className={styles.field}>
            Filter
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Title, location, or slug"
            />
          </label>
          <label className={styles.field}>
            Location
            <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={includePrivate}
              onChange={(event) => setIncludePrivate(event.target.checked)}
            />
            Include private collection ({privateCount})
          </label>
        </div>

        <div className={styles.actions}>
          {canDownload ? (
            <a className={styles.primary} href={`/api/admin/wall-qr-labels${downloadQuery}`}>
              Download QR PDF ({selectedLabels.length})
            </a>
          ) : (
            <span className={`${styles.primary} ${styles.disabled}`} aria-disabled="true">
              Download QR PDF
            </span>
          )}
          {canDownload ? (
            <a className={styles.secondary} href={`/api/admin/wall-title-labels${downloadQuery}`}>
              Download title labels ({selectedLabels.length})
            </a>
          ) : (
            <span className={`${styles.secondary} ${styles.disabled}`} aria-disabled="true">
              Download title labels
            </span>
          )}
          {canDownload ? (
            <a className={styles.secondary} href={`/api/admin/wall-caption-labels${downloadQuery}`}>
              Download caption labels ({selectedLabels.length})
            </a>
          ) : (
            <span className={`${styles.secondary} ${styles.disabled}`} aria-disabled="true">
              Download caption labels
            </span>
          )}
          <button className={styles.secondary} type="button" onClick={() => window.print()} disabled={!canDownload}>
            Print this page
          </button>
        </div>

        <p className={styles.count}>
          {selectedLabels.length} selected of {available.length} photograph{available.length === 1 ? "" : "s"}
          {query.trim() || locationFilter ? ` · ${visible.length} shown` : ""}
          {canDownload ? ` · ${sheetCount} A4 sheet${sheetCount === 1 ? "" : "s"} of QR labels (12 per page)` : ""}
        </p>

        <div className={styles.selectActions}>
          <button className={styles.secondary} type="button" onClick={() => setSlugsSelected(available.map((product) => product.slug), true)}>
            Select all
          </button>
          <button
            className={styles.secondary}
            type="button"
            onClick={() => setSlugsSelected(visible.map((product) => product.slug), true)}
            disabled={visible.length === 0}
          >
            Select matching
          </button>
          <button className={styles.secondary} type="button" onClick={() => setSelected(new Set())} disabled={selectedLabels.length === 0}>
            Clear
          </button>
        </div>

        {visible.length === 0 ? (
          <p className={styles.empty}>No photographs match that filter.</p>
        ) : (
          <div className={styles.picker}>
            {visibleGroups.map((group) => {
              const groupSlugs = group.products.map((product) => product.slug);
              const selectedInGroup = groupSlugs.filter((slug) => selected.has(slug)).length;
              const allInGroupSelected = selectedInGroup === groupSlugs.length;
              return (
                <section key={group.location} className={styles.pickerGroup}>
                  <label className={styles.pickerGroupTitle}>
                    <input
                      type="checkbox"
                      checked={allInGroupSelected}
                      onChange={(event) => setSlugsSelected(groupSlugs, event.target.checked)}
                    />
                    {group.location}
                    <span className={styles.groupCount}>
                      {selectedInGroup}/{group.products.length}
                    </span>
                  </label>
                  <ul className={styles.pickerList}>
                    {group.products.map((product) => (
                      <li key={product.slug}>
                        <label className={styles.pickerItem}>
                          <input
                            type="checkbox"
                            checked={selected.has(product.slug)}
                            onChange={(event) => setSlugSelected(product.slug, event.target.checked)}
                          />
                          <span>
                            {product.title}
                            {product.visibility === "vault" ? " · private" : ""}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {canDownload ? (
        <section className={styles.sheets} aria-label="Printable QR labels">
          {Array.from({ length: sheetCount }, (_, sheet) => {
            const slice = selectedLabels.slice(sheet * WALL_QR_LABELS_PER_PAGE, (sheet + 1) * WALL_QR_LABELS_PER_PAGE);
            return (
              <article key={sheet} className={styles.sheet}>
                {slice.map((product, indexOnPage) => {
                  const wallUrl = buildWallProductUrl(product.slug);
                  const qrSrc = `/api/qr?size=512&data=${encodeURIComponent(wallUrl)}`;
                  const number = sheet * WALL_QR_LABELS_PER_PAGE + indexOnPage + 1;
                  return (
                    <figure key={product.slug} className={styles.cell}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className={styles.qr} src={qrSrc} alt={`QR code for ${product.title}`} />
                      <figcaption>
                        <span className={styles.title}>
                          {number}. {product.title}
                          {product.visibility === "vault" ? " · private" : ""}
                        </span>
                        <span className={styles.meta}>{wallQrLocationLabel(product.location_tag)}</span>
                      </figcaption>
                    </figure>
                  );
                })}
              </article>
            );
          })}
        </section>
      ) : (
        <p className={`${styles.empty} ${styles.screenOnly}`}>Select photographs to preview and reprint their labels.</p>
      )}
    </div>
  );
}
