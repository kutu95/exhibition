"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { Gallery } from "../../lib/galleries";
import styles from "./ProductsTableClient.module.css";

type ProductListItem = {
  id: string;
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
};

type ProductsTableClientProps = {
  products: ProductListItem[];
  galleries: Gallery[];
};

const PUBLIC_FILTER = "public";
const ALL_FILTER = "all";
const THUMBNAILS_STORAGE_KEY = "admin-products-show-thumbnails";

type GalleryGroup = {
  key: string;
  title: string;
  products: ProductListItem[];
};

export function ProductsTableClient({ products, galleries }: ProductsTableClientProps) {
  const router = useRouter();
  const [filter, setFilter] = useState(ALL_FILTER);
  const [showThumbnails, setShowThumbnails] = useState(true);
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
    return result;
  }, [filteredProducts, galleries, galleryNameById]);

  const toggleAvailable = async (id: string) => {
    await fetch(`/api/admin/products/${id}/toggle-available`, { method: "PATCH" });
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
                    <th>Title</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Gallery</th>
                    <th>Variants</th>
                    <th>Featured</th>
                    <th>Available</th>
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
                      <td>{product.title}</td>
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
    </div>
  );
}
