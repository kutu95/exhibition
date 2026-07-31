#!/usr/bin/env node
/**
 * Forensic SEO crawl of the live site. Read-only: fetches every sitemap URL,
 * measures rendered-HTML text (excluding nav/footer/script/JSON-LD), and reports
 * duplication, boilerplate ratio, metadata, headings, images and headers.
 *
 * Usage: node scripts/seo-audit.mjs [origin]
 */

const ORIGIN = process.argv[2] || "https://exhibition.margies.app";
const UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/126 Safari/537.36";

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&[a-zA-Z]+;/g, " ");
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function words(text) {
  return text.split(/\s+/).filter((w) => /[a-zA-Z0-9]/.test(w));
}

function removeBlocks(html, tags) {
  let out = html;
  for (const tag of tags) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "gi"), " ");
  }
  return out;
}

/** Remove the outermost <nav>/<header>/<footer> regions by brace-matching tag depth. */
function removeElement(html, tagName) {
  const open = new RegExp(`<${tagName}\\b[^>]*>`, "i");
  let out = html;
  for (let guard = 0; guard < 50; guard += 1) {
    const m = open.exec(out);
    if (!m) break;
    const start = m.index;
    let depth = 0;
    const scanner = new RegExp(`<(/?)${tagName}\\b[^>]*>`, "gi");
    scanner.lastIndex = start;
    let end = -1;
    let s;
    while ((s = scanner.exec(out))) {
      depth += s[1] ? -1 : 1;
      if (depth === 0) {
        end = s.index + s[0].length;
        break;
      }
    }
    if (end === -1) break;
    out = out.slice(0, start) + " " + out.slice(end);
  }
  return out;
}

function extractAll(html, re, group = 1) {
  const out = [];
  let m;
  const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  while ((m = r.exec(html))) out.push(m[group]);
  return out;
}

function attr(tagHtml, name) {
  const m = tagHtml.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
  return m ? decodeEntities(m[1]) : null;
}

function metaContent(html, key, value) {
  const re = new RegExp(`<meta[^>]*${key}\\s*=\\s*"${value}"[^>]*>`, "i");
  const m = html.match(re);
  return m ? attr(m[0], "content") : null;
}

function shingles(text, n = 6) {
  const w = words(text.toLowerCase());
  const set = new Set();
  for (let i = 0; i + n <= w.length; i += 1) set.add(w.slice(i, i + n).join(" "));
  return set;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

async function head(url) {
  const res = await fetch(url, { method: "GET", redirect: "manual", headers: { "User-Agent": UA } });
  return res;
}

async function main() {
  const sitemapXml = await (await fetch(`${ORIGIN}/sitemap.xml`, { headers: { "User-Agent": UA } })).text();
  const urls = extractAll(sitemapXml, /<loc>([^<]+)<\/loc>/g);

  const pages = [];
  for (const url of urls) {
    const started = Date.now();
    const res = await head(url);
    const ms = Date.now() - started;
    const html = res.status >= 200 && res.status < 300 ? await res.text() : "";

    const headTag = (html.match(/<head[\s\S]*?<\/head>/i) || [""])[0];
    const bodyTag = (html.match(/<body[\s\S]*?<\/body>/i) || [""])[0];

    const jsonLdBlocks = extractAll(
      html,
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
    );

    // Visible text: body minus scripts/styles/noscript, minus nav/header/footer.
    let visibleHtml = removeBlocks(bodyTag, ["script", "style", "noscript", "svg", "template"]);
    const chromeHtml = visibleHtml;
    visibleHtml = removeElement(visibleHtml, "nav");
    visibleHtml = removeElement(visibleHtml, "footer");
    visibleHtml = removeElement(visibleHtml, "header");

    const fullBodyText = stripTags(chromeHtml);
    const visibleText = stripTags(visibleHtml);

    const imgTags = extractAll(bodyTag, /<img\b[^>]*>/gi, 0);
    const images = imgTags.map((t) => ({
      src: attr(t, "src"),
      alt: attr(t, "alt"),
      width: attr(t, "width"),
      height: attr(t, "height"),
      loading: attr(t, "loading"),
    }));

    pages.push({
      url,
      status: res.status,
      location: res.headers.get("location"),
      ms,
      bytes: html.length,
      cacheControl: res.headers.get("cache-control"),
      etag: res.headers.get("etag"),
      lastModified: res.headers.get("last-modified"),
      contentEncoding: res.headers.get("content-encoding"),
      contentType: res.headers.get("content-type"),
      xRobots: res.headers.get("x-robots-tag"),
      title: (headTag.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, null])[1],
      description: metaContent(headTag, "name", "description"),
      canonical: (() => {
        const m = headTag.match(/<link[^>]*rel="canonical"[^>]*>/i);
        return m ? attr(m[0], "href") : null;
      })(),
      robotsMeta: metaContent(headTag, "name", "robots"),
      ogImage: metaContent(headTag, "property", "og:image"),
      ogTitle: metaContent(headTag, "property", "og:title"),
      twitterCard: metaContent(headTag, "name", "twitter:card"),
      h1: extractAll(bodyTag, /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi).map(stripTags),
      h2: extractAll(bodyTag, /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi).map(stripTags),
      h3: extractAll(bodyTag, /<h3\b[^>]*>([\s\S]*?)<\/h3>/gi).map(stripTags),
      jsonLdTypes: jsonLdBlocks.flatMap((b) => {
        try {
          const parsed = JSON.parse(b.trim());
          return [].concat(parsed).map((p) => p["@type"]);
        } catch {
          return ["PARSE_ERROR"];
        }
      }),
      jsonLdBytes: jsonLdBlocks.join("").length,
      totalWords: words(fullBodyText).length,
      visibleWords: words(visibleText).length,
      visibleText,
      images,
    });
  }

  // Boilerplate: 6-word shingles appearing on >60% of pages.
  const shingleSets = pages.map((p) => shingles(p.visibleText));
  const docFreq = new Map();
  shingleSets.forEach((s) => {
    for (const sh of s) docFreq.set(sh, (docFreq.get(sh) || 0) + 1);
  });
  const threshold = Math.max(2, Math.ceil(pages.length * 0.6));
  pages.forEach((p, i) => {
    const set = shingleSets[i];
    let repeated = 0;
    for (const sh of set) if ((docFreq.get(sh) || 0) >= threshold) repeated += 1;
    p.boilerplateShare = set.size ? repeated / set.size : 0;
    p.chromeWords = p.totalWords - p.visibleWords;
    p.chromeShare = p.totalWords ? p.chromeWords / p.totalWords : 0;
  });

  // Pairwise near-duplicate detection.
  const dupes = [];
  for (let i = 0; i < pages.length; i += 1) {
    for (let j = i + 1; j < pages.length; j += 1) {
      const sim = jaccard(shingleSets[i], shingleSets[j]);
      if (sim >= 0.2) dupes.push({ a: pages[i].url, b: pages[j].url, sim });
    }
  }
  dupes.sort((x, y) => y.sim - x.sim);

  const report = {
    origin: ORIGIN,
    generatedAt: new Date().toISOString(),
    pageCount: pages.length,
    pages: pages.map(({ visibleText, ...rest }) => ({
      ...rest,
      textSample: visibleText.slice(0, 160),
    })),
    nearDuplicates: dupes,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
