import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import { Marked } from "marked";
import { cache } from "react";

const CONTENT_DIR = path.join(process.cwd(), "content", "history");

/** Support files that live alongside the pages but are never routes. */
const NON_PAGE_FILES = new Set(["README.md", "index.md"]);

export type HistorySource = {
  citation: string;
  href?: string;
};

export type HistoryPageMeta = {
  slug: string;
  /** <h1> on the page. */
  title: string;
  /** Nav labels and hub cards, where the full title is too long. */
  shortTitle: string;
  /** Meta description and hub card summary. */
  description: string;
  /** Kicker above the <h1> — usually a date and place. */
  eyebrow?: string;
  /** Full <title>. Falls back to "<title> | <site name>" when absent. */
  metaTitle?: string;
  ogImage?: string;
  published: string;
  updated: string;
  sitemapPriority: number;
  sources: HistorySource[];
};

export type HistoryPage = HistoryPageMeta & {
  html: string;
  wordCount: number;
  readingMinutes: number;
};

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A fresh instance per render keeps heading-id state from leaking between
 * pages — the shared `marked` singleton would carry duplicates across requests.
 */
function createRenderer() {
  const md = new Marked({ gfm: true, breaks: false });
  const seen = new Map<string, number>();

  md.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const base = slugifyHeading(text) || `section-${seen.size + 1}`;
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        const id = count === 0 ? base : `${base}-${count + 1}`;
        // The page title owns the h1, so a stray "#" is demoted rather than
        // competing with it.
        const level = depth === 1 ? 2 : Math.min(depth, 6);
        return `<h${level} id="${id}">${text}</h${level}>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const isExternal = /^https?:\/\//i.test(href);
        const attrs = [
          `href="${href}"`,
          title ? `title="${title}"` : "",
          isExternal ? 'target="_blank" rel="noopener noreferrer"' : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<a ${attrs}>${text}</a>`;
      },
    },
  });

  return md;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function parseSources(value: unknown): HistorySource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): HistorySource[] => {
    if (typeof entry === "string" && entry.trim()) {
      return [{ citation: entry.trim() }];
    }
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const citation = asString(record.citation);
      if (!citation) return [];
      const href = asString(record.href);
      return [{ citation, ...(href ? { href } : {}) }];
    }
    return [];
  });
}

async function readPageFile(slug: string): Promise<HistoryPage | null> {
  let raw: string;
  try {
    raw = await readFile(path.join(CONTENT_DIR, `${slug}.md`), "utf8");
  } catch {
    return null;
  }

  const { data, content } = matter(raw);

  // Anything not explicitly published is a working draft. The existing
  // research drafts carry no frontmatter at all, so they stay unroutable.
  if (asString(data.status) !== "published") return null;

  const title = asString(data.title);
  const description = asString(data.description);
  if (!title || !description) {
    console.warn(`[history] "${slug}" is published but missing title or description — skipping.`);
    return null;
  }

  const html = await createRenderer().parse(content);
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const published = asString(data.published, "2026-07-31");

  return {
    slug,
    title,
    shortTitle: asString(data.shortTitle, title),
    description,
    eyebrow: asString(data.eyebrow) || undefined,
    metaTitle: asString(data.metaTitle) || undefined,
    ogImage: asString(data.ogImage) || undefined,
    published,
    updated: asString(data.updated, published),
    sitemapPriority: typeof data.sitemapPriority === "number" ? data.sitemapPriority : 0.8,
    sources: parseSources(data.sources),
    html,
    wordCount,
    readingMinutes: Math.max(1, Math.round(wordCount / 220)),
  };
}

export const getHistoryPage = cache(
  async (slug: string): Promise<HistoryPage | null> => readPageFile(slug),
);

/** Newest first, so the hub leads with whatever was published most recently. */
export const getPublishedHistoryPages = cache(async (): Promise<HistoryPage[]> => {
  let files: string[];
  try {
    files = await readdir(CONTENT_DIR);
  } catch {
    return [];
  }

  const slugs = files
    .filter((file) => file.endsWith(".md") && !NON_PAGE_FILES.has(file))
    .map((file) => file.replace(/\.md$/, ""));

  const pages = await Promise.all(slugs.map((slug) => readPageFile(slug)));

  return pages
    .filter((page): page is HistoryPage => page !== null)
    .sort((a, b) => b.published.localeCompare(a.published) || a.title.localeCompare(b.title));
});
