"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import styles from "./ProductsTableClient.module.css";

type ProductListItem = {
  id: string;
  title: string;
  product_type: string;
  location_tag: string | null;
  variants_count: number;
  is_featured: boolean;
  is_available: boolean;
};

type ProductsTableClientProps = {
  products: ProductListItem[];
};

export function ProductsTableClient({ products }: ProductsTableClientProps) {
  const router = useRouter();

  const toggleAvailable = async (id: string) => {
    await fetch(`/api/admin/products/${id}/toggle-available`, { method: "PATCH" });
    router.refresh();
  };

  return (
    <div>
      <div className={styles.topRow}>
        <h1>Products</h1>
        <Link className={styles.addBtn} href="/admin/products/new">
          Add New Product
        </Link>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Location</th>
              <th>Variants</th>
              <th>Featured</th>
              <th>Available</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.title}</td>
                <td>{product.product_type}</td>
                <td>{product.location_tag ?? "—"}</td>
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
    </div>
  );
}
