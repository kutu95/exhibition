import type { ShopCatalogProduct } from "../lib/catalog-products";
import { ProductCard } from "./ProductCard";
import styles from "./ProductGrid.module.css";

type ProductGridProps = {
  products: ShopCatalogProduct[];
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
