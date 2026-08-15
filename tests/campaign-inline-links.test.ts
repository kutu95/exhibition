import { describe, expect, it } from "vitest";

import { looksLikeLinkTarget, wrapTextWithLink } from "../lib/campaigns/inline-links";
import { formatInlineEmailHtml, renderCampaignEmailHtml, sanitizeEmailHref } from "../lib/campaigns/render";
import { siteConfig } from "../lib/metadata";

describe("wrapTextWithLink", () => {
  it("wraps a selection as markdown", () => {
    expect(wrapTextWithLink("Visit the shop today.", 10, 14, "/shop")).toEqual({
      text: "Visit the [shop](/shop) today.",
      cursor: 23,
    });
  });

  it("uses an explicit label when replacing a pasted URL", () => {
    expect(wrapTextWithLink("See https://example.com now", 4, 23, "https://example.com", "the site")).toEqual({
      text: "See [the site](https://example.com) now",
      cursor: 35,
    });
  });
});

describe("looksLikeLinkTarget", () => {
  it("recognises urls, mailto, and site paths", () => {
    expect(looksLikeLinkTarget("https://example.com")).toBe(true);
    expect(looksLikeLinkTarget("mailto:john@margies.app")).toBe(true);
    expect(looksLikeLinkTarget("/shop")).toBe(true);
    expect(looksLikeLinkTarget("shop")).toBe(false);
  });
});

describe("sanitizeEmailHref", () => {
  it("allows http(s), mailto, and site paths", () => {
    expect(sanitizeEmailHref("https://example.com/a")).toBe("https://example.com/a");
    expect(sanitizeEmailHref("mailto:john@margies.app")).toBe("mailto:john@margies.app");
    expect(sanitizeEmailHref("/shop")).toBe(`${siteConfig.url.replace(/\/$/, "")}/shop`);
  });

  it("rejects script urls", () => {
    expect(sanitizeEmailHref("javascript:alert(1)")).toBeNull();
    expect(sanitizeEmailHref("data:text/html,hi")).toBeNull();
  });
});

describe("formatInlineEmailHtml", () => {
  it("turns markdown links into anchors and keeps surrounding text escaped", () => {
    const html = formatInlineEmailHtml('See the [shop](/shop) & more.');
    expect(html).toContain(`href="${siteConfig.url.replace(/\/$/, "")}/shop"`);
    expect(html).toContain(">shop</a>");
    expect(html).toContain("&amp; more.");
    expect(html).not.toContain("[shop]");
  });

  it("keeps pasted html anchors if the href is safe", () => {
    const html = formatInlineEmailHtml('Read <a href="https://example.com/visit">here</a> first.');
    expect(html).toContain('href="https://example.com/visit"');
    expect(html).toContain(">here</a>");
    expect(html).not.toContain("&lt;a");
  });

  it("escapes other html and does not keep javascript hrefs", () => {
    const html = formatInlineEmailHtml('<em>hi</em> <a href="javascript:alert(1)">x</a>');
    expect(html).toContain("&lt;em&gt;hi&lt;/em&gt;");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("&lt;a href=");
  });

  it("preserves line breaks", () => {
    expect(formatInlineEmailHtml("line one\nline two")).toBe("line one<br />line two");
  });
});

describe("campaign paragraph rendering", () => {
  it("includes paragraph links in the full email html", async () => {
    const html = await renderCampaignEmailHtml({
      subject: "Hello",
      blocks: [{ id: "p1", type: "paragraph", text: "Visit the [shop](/shop)." }],
      skipImagePrepare: true,
      autoGreeting: false,
    });
    expect(html).toContain(">shop</a>");
    expect(html).toContain("/shop");
  });
});
