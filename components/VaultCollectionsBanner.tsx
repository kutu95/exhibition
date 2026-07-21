import Link from "next/link";

import styles from "./VaultCollectionsBanner.module.css";

export function VaultCollectionsBanner() {
  return (
    <div className={styles.banner} role="status">
      <p>
        Private collections are unlocked in this browser. You can browse work that is not shown in the public gallery.
      </p>
      <Link href="/collections/access?leave=1">Close private collections</Link>
    </div>
  );
}
