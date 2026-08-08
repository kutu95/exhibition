"use client";

import Link from "next/link";

import { CollectionsRequestForm } from "../../../components/CollectionsRequestForm";
import { usePurchasesAllowed } from "../../../components/PurchasesAccessProvider";
import { COLLECTIONS_DISABLED_MESSAGE } from "../../../lib/purchases-access";
import styles from "./page.module.css";

export function CollectionsRequestGate({ notice }: { notice: string | null }) {
  const collectionsAllowed = usePurchasesAllowed();

  if (!collectionsAllowed) {
    return (
      <p className={styles.notice}>
        {COLLECTIONS_DISABLED_MESSAGE}{" "}
        <Link href="/contact">Contact</Link>
      </p>
    );
  }

  return (
    <>
      {notice ? <p className={styles.notice}>{notice}</p> : null}
      <CollectionsRequestForm />
    </>
  );
}
