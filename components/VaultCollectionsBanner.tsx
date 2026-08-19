import Link from "next/link";

import styles from "./VaultCollectionsBanner.module.css";

type VaultCollectionsBannerProps = {
  galleries: Array<{ id: string; name: string }>;
};

const formatGalleryNames = (names: string[]): string => {
  if (names.length === 0) return "private collections";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
};

export function VaultCollectionsBanner({ galleries }: VaultCollectionsBannerProps) {
  const names = galleries.map((gallery) => gallery.name);
  const label = formatGalleryNames(names);

  return (
    <div className={styles.banner} role="status">
      <p>
        You have access to {label} in this browser. Other private galleries stay hidden.
      </p>
      <Link href="/collections/access?leave=1">Close private collections</Link>
    </div>
  );
}
