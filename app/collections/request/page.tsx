import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import { CollectionsRequestForm } from "../../../components/CollectionsRequestForm";
import { buildMetadata } from "../../../lib/metadata";
import {
  areCollectionsAllowedForHost,
  COLLECTIONS_DISABLED_MESSAGE,
} from "../../../lib/purchases-access";
import styles from "./page.module.css";

export const metadata: Metadata = buildMetadata({
  title: "Further collections",
  description:
    "Request access to further photographic collections from The Georgette 150th that are not shown in the public gallery.",
  path: "/collections/request",
  noIndex: true,
});

type PageProps = {
  searchParams: Promise<{ invalid?: string; expired?: string }>;
};

export default async function CollectionsRequestPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const collectionsAllowed = areCollectionsAllowedForHost((await headers()).get("host"));
  const notice =
    params.invalid === "1"
      ? "That access link is no longer valid. You can request access below."
      : params.expired === "1"
        ? "That access link has expired. You can request access below."
        : null;

  return (
    <section className={`section container ${styles.page}`}>
      <header className={styles.intro}>
        <p className="eyebrow">Private collections</p>
        <h1 className="heading-section">Further collections</h1>
        <p className={styles.lead}>
          These collections are very limited edition. Some work is reserved for collectors, interior specialists, and
          invited guests. If you would like to see collections that are not in the public gallery, you are welcome to
          request access.
        </p>
      </header>

      {!collectionsAllowed ? (
        <p className={styles.notice}>
          {COLLECTIONS_DISABLED_MESSAGE}{" "}
          <Link href="/contact">Contact</Link>
        </p>
      ) : (
        <>
          {notice ? <p className={styles.notice}>{notice}</p> : null}
          <CollectionsRequestForm />
        </>
      )}
    </section>
  );
}
