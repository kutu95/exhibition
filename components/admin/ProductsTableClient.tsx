"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { adminClientFetch } from "../../lib/admin-client-fetch";
import type { Gallery } from "../../lib/galleries";
import { ProductAudioCaptureModal } from "./ProductAudioCaptureModal";
import { ProductOrdersButton } from "./ProductOrdersButton";
import styles from "./ProductsTableClient.module.css";

type ProductListItem = {
  id: string;
  slug: string;
  title: string;
  product_type: string;
  location_tag: string | null;
  variants_count: number;
  is_featured: boolean;
  is_available: boolean;
  gallery_id: string | null;
  visibility?: "public" | "vault";
  image_url: string | null;
  image_alt: string | null;
  audio_url: string | null;
  audio_duration: string | null;
  audio_transcript: string | null;
};

type ProductsTableClientProps = {
  products: ProductListItem[];
  galleries: Gallery[];
};

const PUBLIC_FILTER = "public";
const ALL_FILTER = "all";
const THUMBNAILS_STORAGE_KEY = "admin-products-show-thumbnails";

type SortKey =
  | "title"
  | "product_type"
  | "location_tag"
  | "gallery"
  | "variants_count"
  | "is_featured"
  | "is_available";
type SortDir = "asc" | "desc";

type GalleryGroup = {
  key: string;
  title: string;
  products: ProductListItem[];
};

const SORT_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function galleryLabel(product: ProductListItem, galleryNameById: Map<string, string>): string {
  return product.gallery_id
    ? galleryNameById.get(product.gallery_id) ?? "Private gallery"
    : "Public gallery";
}

function compareProducts(
  a: ProductListItem,
  b: ProductListItem,
  sortKey: SortKey,
  sortDir: SortDir,
  galleryNameById: Map<string, string>,
): number {
  const direction = sortDir === "asc" ? 1 : -1;
  let result = 0;

  switch (sortKey) {
    case "title":
      result = SORT_COLLATOR.compare(a.title, b.title);
      break;
    case "product_type":
      result = SORT_COLLATOR.compare(a.product_type, b.product_type);
      break;
    case "location_tag":
      result = SORT_COLLATOR.compare(a.location_tag ?? "", b.location_tag ?? "");
      break;
    case "gallery":
      result = SORT_COLLATOR.compare(galleryLabel(a, galleryNameById), galleryLabel(b, galleryNameById));
      break;
    case "variants_count":
      result = a.variants_count - b.variants_count;
      break;
    case "is_featured":
      result = Number(a.is_featured) - Number(b.is_featured);
      break;
    case "is_available":
      result = Number(a.is_available) - Number(b.is_available);
      break;
  }

  if (result === 0 && sortKey !== "title") {
    result = SORT_COLLATOR.compare(a.title, b.title);
  }

  return result * direction;
}

export function ProductsTableClient({ products, galleries }: ProductsTableClientProps) {
  const router = useRouter();
  const [filter, setFilter] = useState(ALL_FILTER);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [audioTarget, setAudioTarget] = useState<ProductListItem | null>(null);
  const galleryNameById = useMemo(
    () => new Map(galleries.map((gallery) => [gallery.id, gallery.name])),
    [galleries],
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THUMBNAILS_STORAGE_KEY);
      if (stored === "0") setShowThumbnails(false);
      if (stored === "1") setShowThumbnails(true);
    } catch {
      // Ignore storage failures in private browsing.
    }
  }, []);

  const setThumbnailsVisible = (visible: boolean) => {
    setShowThumbnails(visible);
    try {
      window.localStorage.setItem(THUMBNAILS_STORAGE_KEY, visible ? "1" : "0");
    } catch {
      // Ignore storage failures in private browsing.
    }
  };

  const filteredProducts = useMemo(() => {
    if (filter === ALL_FILTER) return products;
    if (filter === PUBLIC_FILTER) return products.filter((product) => !product.gallery_id);
    return products.filter((product) => product.gallery_id === filter);
  }, [filter, products]);

  const groups = useMemo((): GalleryGroup[] => {
    const publicProducts: ProductListItem[] = [];
    const byGallery = new Map<string, ProductListItem[]>();

    for (const product of filteredProducts) {
      if (!product.gallery_id) {
        publicProducts.push(product);
        continue;
      }
      const current = byGallery.get(product.gallery_id) ?? [];
      current.push(product);
      byGallery.set(product.gallery_id, current);
    }

    const privateGroups = galleries
      .filter((gallery) => byGallery.has(gallery.id))
      .map((gallery) => ({
        key: gallery.id,
        title: gallery.name,
        products: byGallery.get(gallery.id) ?? [],
      }));

    const knownIds = new Set(galleries.map((gallery) => gallery.id));
    const orphanGroups = [...byGallery.entries()]
      .filter(([galleryId]) => !knownIds.has(galleryId))
      .map(([galleryId, galleryProducts]) => ({
        key: galleryId,
        title: galleryNameById.get(galleryId) ?? "Unknown gallery",
        products: galleryProducts,
      }));

    const result: GalleryGroup[] = [];
    if (publicProducts.length > 0) {
      result.push({ key: PUBLIC_FILTER, title: "Public gallery", products: publicProducts });
    }
    result.push(...privateGroups, ...orphanGroups);

    if (!sortKey) return result;

    const sortedGroups = result.map((group) => ({
      ...group,
      products: [...group.products].sort((a, b) =>
        compareProducts(a, b, sortKey, sortDir, galleryNameById),
      ),
    }));

    if (sortKey === "gallery") {
      sortedGroups.sort((a, b) => SORT_COLLATOR.compare(a.title, b.title) * (sortDir === "asc" ? 1 : -1));
    }

    return sortedGroups;
  }, [filteredProducts, galleries, galleryNameById, sortKey, sortDir]);

  const toggleSort = (column: SortKey) => {
    if (sortKey === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(column);
    setSortDir("asc");
  };

  const toggleAvailable = async (id: string) => {
    await fetch(`/api/admin/products/${id}/toggle-available`, { method: "PATCH" });
    router.refresh();
  };

  const persistProductAudio = async (fields: {
    audioUrl: string;
    audioDuration: string;
    audioTranscript: string;
  }) => {
    if (!audioTarget) return;
    const response = await adminClientFetch(`/api/admin/products/${audioTarget.id}/audio`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audio_url: fields.audioUrl,
        audio_duration: fields.audioDuration,
        audio_transcript: fields.audioTranscript,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      throw new Error(payload?.error ?? "Could not save audio.");
    }
    router.refresh();
  };

  return (
    <div>
      <div className={styles.topRow}>
        <h1>Products</h1>
        <div className={styles.topActions}>
          <Link className={styles.secondaryBtn} href="/admin/wall-qr">
            Wall QR labels
          </Link>
          <Link className={styles.addBtn} href="/admin/products/new">
            Add New Product
          </Link>
        </div>
      </div>

      <div className={styles.filters}>
        <label>
          Gallery
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value={ALL_FILTER}>All galleries</option>
            <option value={PUBLIC_FILTER}>Public gallery</option>
            {galleries.map((gallery) => (
              <option key={gallery.id} value={gallery.id}>
                {gallery.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={showThumbnails}
            onChange={(event) => setThumbnailsVisible(event.target.checked)}
          />
          Show thumbnails
        </label>
        <p className={styles.filterCount}>
          {filteredProducts.length} product{filteredProducts.length === 1 ? "" : "s"}
        </p>
      </div>

      {groups.length === 0 ? (
        <p>No products in this gallery.</p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className={styles.group}>
            <h2 className={styles.groupTitle}>
              {group.title}
              <span className={styles.groupCount}>{group.products.length}</span>
            </h2>
            <div className={styles.tableWrap}>
              <table className={showThumbnails ? `${styles.table} ${styles.tableWithThumbs}` : styles.table}>
                <thead>
                  <tr>
                    {showThumbnails ? <th className={styles.imageCol}>Image</th> : null}
                    <SortableHeader label="Title" column="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableHeader label="Type" column="product_type" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableHeader
                      label="Location"
                      column="location_tag"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    <SortableHeader label="Gallery" column="gallery" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableHeader
                      label="Variants"
                      column="variants_count"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    <SortableHeader
                      label="Featured"
                      column="is_featured"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    <SortableHeader
                      label="Available"
                      column="is_available"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.products.map((product) => (
                    <tr key={product.id}>
                      {showThumbnails ? (
                        <td className={styles.imageCol}>
                          {product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of local or remote product image
                            <img
                              className={styles.thumb}
                              src={product.image_url}
                              alt={product.image_alt || product.title}
                            />
                          ) : (
                            <div className={styles.thumbPlaceholder} aria-hidden="true">
                              No image
                            </div>
                          )}
                        </td>
                      ) : null}
                      <td>
                        <div className={styles.titleCell}>
                          <ProductOrdersButton productId={product.id} productTitle={product.title} />
                          <AudioShortcutButton product={product} onOpen={() => setAudioTarget(product)} />
                          {product.title}
                        </div>
                      </td>
                      <td>{product.product_type}</td>
                      <td>{product.location_tag ?? "—"}</td>
                      <td>
                        {product.gallery_id
                          ? galleryNameById.get(product.gallery_id) ?? "Private gallery"
                          : "Public gallery"}
                      </td>
                      <td>{product.variants_count}</td>
                      <td>{product.is_featured ? "Yes" : "No"}</td>
                      <td>{product.is_available ? "Yes" : "No"}</td>
                      <td>
                        <div className={styles.actions}>
                          <Link href={`/admin/products/${product.id}/edit`}>Edit</Link>
                          <button type="button" onClick={() => toggleAvailable(product.id)}>
                            Toggle Available
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
      <ProductAudioCaptureModal
        open={Boolean(audioTarget)}
        slug={audioTarget?.slug ?? ""}
        title={audioTarget?.title ?? ""}
        currentProductId={audioTarget?.id ?? null}
        currentAudioUrl={audioTarget?.audio_url ?? ""}
        currentAudioDuration={audioTarget?.audio_duration ?? ""}
        currentAudioTranscript={audioTarget?.audio_transcript ?? ""}
        onClose={() => setAudioTarget(null)}
        onApplied={persistProductAudio}
      />
    </div>
  );
}

function SortableHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (column: SortKey) => void;
}) {
  const active = sortKey === column;
  const nextDir = !active || sortDir === "desc" ? "ascending" : "descending";

  return (
    <th aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className={styles.sortBtn}
        onClick={() => onSort(column)}
        aria-label={`Sort by ${label}, ${nextDir}`}
      >
        {label}
        <span className={active ? styles.sortIndicatorActive : styles.sortIndicator} aria-hidden="true">
          {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

function AudioShortcutButton({
  product,
  onOpen,
}: {
  product: ProductListItem;
  onOpen: () => void;
}) {
  const hasAudio = Boolean(product.audio_url?.trim());

  return (
    <button
      type="button"
      className={hasAudio ? `${styles.audioTrigger} ${styles.audioTriggerActive}` : styles.audioTrigger}
      aria-label={hasAudio ? `Listen to audio for ${product.title}` : `Add audio for ${product.title}`}
      title={hasAudio ? "Listen to or edit audio" : "Add audio"}
      onClick={onOpen}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.audioTriggerIcon}>
        <path
          d="M4.5 9.25h3.1L12 5.8v12.4l-4.4-3.45H4.5z"
          fill={hasAudio ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M16.2 9.1a3.6 3.6 0 0 1 0 5.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {hasAudio ? (
          <path
            d="M18.4 6.8a6.4 6.4 0 0 1 0 10.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ) : null}
      </svg>
    </button>
  );
}
