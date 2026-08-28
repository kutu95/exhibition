import type { ProductWithVariantsAndImages } from "../lib/supabase/types";
import { ProductCard } from "./ProductCard";
import styles from "./ProductGrid.module.css";

type ProductGridProps = {
  products: ProductWithVariantsAndImages[];
  isAdmin?: boolean;
};

export function ProductGrid({ products, isAdmin = false }: ProductGridProps) {
  return (
    <div className={styles.grid}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} isAdmin={isAdmin} />
      ))}
    </div>
  );
}
