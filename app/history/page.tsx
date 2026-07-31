import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "../../components/JsonLd";
import { getPublishedHistoryPages } from "../../lib/history-content";
import { buildMetadata, siteConfig } from "../../lib/metadata";
import { buildBreadcrumb, buildShipEntity } from "../../lib/structured-data";
import styles from "./page.module.css";

const PAGE_TITLE = "SS Georgette — history and research";
const PAGE_DESCRIPTION =
  "Research into the SS Georgette, wrecked at Calgardup Bay on 1 December 1876: the Catalpa pursuit, the marine inquiry, and how the Grace Bussell rescue story was made. Drawn from primary records.";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    absoluteTitle: `${PAGE_TITLE} | ${siteConfig.name}`,
    description: PAGE_DESCRIPTION,
    path: "/history",
    ogImage: siteConfig.ogImage.story,
  });
}

export default async function HistoryIndexPage() {
  const pages = await getPublishedHistoryPages();

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: PAGE_TITLE,
          description: PAGE_DESCRIPTION,
          url: `${siteConfig.url}/history`,
          inLanguage: "en-AU",
          about: buildShipEntity(),
          isPartOf: { "@type": "WebSite", name: siteConfig.name, url: siteConfig.url },
          ...(pages.length
            ? {
                mainEntity: {
                  "@type": "ItemList",
                  numberOfItems: pages.length,
                  itemListElement: pages.map((page, index) => ({
                    "@type": "ListItem",
                    position: index + 1,
                    name: page.title,
                    url: `${siteConfig.url}/history/${page.slug}`,
                  })),
                },
              }
            : {}),
        }}
      />
      <JsonLd
        data={buildBreadcrumb([
          { name: "Home", path: "/" },
          { name: "History", path: "/history" },
        ])}
      />

      <section className="section container-narrow">
        <header className={styles.header}>
          <p className="eyebrow">Research</p>
          <h1 className={`heading-section ${styles.title}`}>{PAGE_TITLE}</h1>
          <p className={styles.intro}>
            The SS Georgette was an iron screw-steamer built at Dumbarton on the Clyde in 1872 and lost at Calgardup
            Bay, on the south-west coast of Western Australia, on 1 December 1876. Seven people drowned when the
            lifeboat capsized. In fewer than four years of service she became famous twice — first as the ship sent
            after the whaleship{" "}
            <em>Catalpa</em> during the Fenian escape from Fremantle, and then as the wreck on which the legend of Grace
            Bussell and Sam Isaacs was built.
          </p>
          <p className={styles.intro}>
            These pages set out what the primary records actually say: the marine inquiry transcript, contemporary
            newspaper reports, Lloyd&apos;s Register survey documents, and the letters of people who were there. Where
            the sources contradict each other — and on the Georgette they often do — the contradictions are set out
            side by side rather than resolved for the reader.
          </p>
        </header>

        {pages.length === 0 ? (
          <p className={styles.empty}>Research pages are being prepared and will appear here shortly.</p>
        ) : (
          <ul className={styles.list}>
            {pages.map((page) => (
              <li key={page.slug}>
                <Link href={`/history/${page.slug}`} className={styles.card}>
                  {page.eyebrow ? <span className={styles.cardEyebrow}>{page.eyebrow}</span> : null}
                  <span className={styles.cardTitle}>{page.title}</span>
                  <span className={styles.cardText}>{page.description}</span>
                  <span className={styles.cardMeta}>{page.readingMinutes} min read</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <aside className={styles.callout}>
          <p className={styles.calloutTitle}>The research is ongoing</p>
          <p className={styles.calloutText}>
            This work sits behind{" "}
            <Link href="/" className="text-link">
              The Georgette 150th
            </Link>
            , a photographic exhibition marking one hundred and fifty years since the wreck, and a book in preparation.
            If you have a family account, a photograph, or a document that bears on any of it,{" "}
            <Link href="/contact" className="text-link">
              I would like to hear from you
            </Link>
            .
          </p>
        </aside>

        <div className={styles.bottomLinks}>
          <Link href="/story">The wreck of the Georgette →</Link>
          <Link href="/book">Author&apos;s preface →</Link>
          <Link href="/shop">The photographs →</Link>
        </div>
      </section>
    </>
  );
}
