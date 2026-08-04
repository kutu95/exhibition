import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "../../../components/JsonLd";
import { ShareButtons } from "../../../components/ShareButtons";
import { getHistoryPage, getPublishedHistoryPages } from "../../../lib/history-content";
import { buildMetadata, siteConfig } from "../../../lib/metadata";
import { buildArticle, buildBreadcrumb } from "../../../lib/structured-data";
import styles from "./page.module.css";

type PageProps = { params: Promise<{ slug: string }> };

/** Set true to show the Sources / citations panel on history articles again. */
const SHOW_HISTORY_SOURCES = false;

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Australia/Perth",
});

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getHistoryPage(slug);

  if (!page) {
    return buildMetadata({ title: "Not found", noIndex: true });
  }

  return buildMetadata({
    absoluteTitle: page.metaTitle ?? `${page.title} | ${siteConfig.name}`,
    description: page.description,
    path: `/history/${page.slug}`,
    ogImage: page.ogImage,
    ogType: "article",
  });
}

export default async function HistoryArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const [page, allPages] = await Promise.all([getHistoryPage(slug), getPublishedHistoryPages()]);

  if (!page) notFound();

  const related = allPages.filter((entry) => entry.slug !== page.slug).slice(0, 2);

  return (
    <>
      <JsonLd
        data={buildArticle({
          headline: page.title,
          description: page.description,
          path: `/history/${page.slug}`,
          image: page.ogImage,
          section: "Maritime history",
          datePublished: page.published,
          dateModified: page.updated,
        })}
      />
      <JsonLd
        data={buildBreadcrumb([
          { name: "Home", path: "/" },
          { name: "History", path: "/history" },
          { name: page.shortTitle, path: `/history/${page.slug}` },
        ])}
      />

      <article className="section container-narrow">
        <header className={styles.header}>
          {page.eyebrow ? <p className="eyebrow">{page.eyebrow}</p> : null}
          <h1 className={`heading-section ${styles.title}`}>{page.title}</h1>
          <p className={styles.standfirst}>{page.description}</p>
          <p className={styles.byline}>
            <span>{page.readingMinutes} min read</span>
            <span aria-hidden="true">·</span>
            <span>
              {page.updated !== page.published ? "Updated " : "Published "}
              <time dateTime={page.updated}>{formatDate(page.updated)}</time>
            </span>
          </p>
        </header>

        {/* Authored in-repo, not user input — see content/history. */}
        <div className={styles.prose} dangerouslySetInnerHTML={{ __html: page.html }} />

        {SHOW_HISTORY_SOURCES && page.sources.length > 0 ? (
          <section className={styles.sources} aria-labelledby="sources-heading">
            <h2 id="sources-heading" className={styles.sourcesHeading}>
              Sources
            </h2>
            <ol className={styles.sourcesList}>
              {page.sources.map((source) => (
                <li key={source.citation}>
                  {source.href ? (
                    <a href={source.href} target="_blank" rel="noopener noreferrer">
                      {source.citation}
                    </a>
                  ) : (
                    source.citation
                  )}
                </li>
              ))}
            </ol>
            <p className={styles.correctionNote}>
              This account is drawn from primary records and is revised as research continues. If you hold a document,
              photograph or family account that corrects or adds to it,{" "}
              <Link href="/contact" className="text-link">
                please get in touch
              </Link>
              .
            </p>
          </section>
        ) : null}

        <ShareButtons
          url={`${siteConfig.url}/history/${page.slug}`}
          title={`${page.title} — ${siteConfig.name}`}
          description={page.description}
        />

        {related.length > 0 ? (
          <nav className={styles.related} aria-label="More history">
            <p className={styles.relatedTitle}>Continue reading</p>
            <ul className={styles.relatedList}>
              {related.map((entry) => (
                <li key={entry.slug}>
                  <Link href={`/history/${entry.slug}`}>
                    <span className={styles.relatedLinkTitle}>{entry.title}</span>
                    <span className={styles.relatedLinkText}>{entry.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <div className={styles.bottomLinks}>
          <Link href="/history">All history research →</Link>
          <Link href="/story">The wreck of the Georgette →</Link>
          <Link href="/book">Author&apos;s preface →</Link>
        </div>
      </article>
    </>
  );
}
