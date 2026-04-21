import type { ProductWithVariantsAndImages } from "../lib/supabase/types";
import { ProductCard } from "./ProductCard";
import styles from "./ProductGrid.module.css";

type ProductGridProps = {
  products: ProductWithVariantsAndImages[];
};

export function ProductGrid({ products }: ProductGridProps) {
  return (
    <div className={styles.grid}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
