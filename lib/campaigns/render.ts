import { interpolateMergeTokens, type EmailMergeVars } from "../emails/merge";
import { siteConfig } from "../metadata";
import type { CampaignBlock } from "./blocks";
import { prepareCampaignBlocksForEmail } from "./email-image";

const NAVY = "#0a1628";
const CREAM = "#f5f0e8";
const INK = "#1a1a1a";
const MUTED = "#4b5563";
const GOLD = "#a08650";

export const absoluteAssetUrl = (pathOrUrl: string): string => {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = siteConfig.url.replace(/\/$/, "");
  return `${base}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const nl2br = (value: string): string =>
  escapeHtml(value).replace(/\r\n|\r|\n/g, "<br />");

const LINK_PATTERN =
  /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>|\[([^\]]+)\]\(([^)\s]+)\)/gi;

export const sanitizeEmailHref = (raw: string): string | null => {
  const href = raw.trim();
  if (!href) return null;
  const lowered = href.toLowerCase();
  if (lowered.startsWith("javascript:") || lowered.startsWith("data:") || lowered.startsWith("vbscript:")) {
    return null;
  }
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href;
  if (href.startsWith("/")) return absoluteAssetUrl(href);
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(href)) return `https://${href}`;
  return null;
};

/** Escapes paragraph copy but keeps markdown `[text](url)` and simple `<a href>` links. */
export const formatInlineEmailHtml = (value: string): string => {
  const pattern = new RegExp(LINK_PATTERN.source, "gi");
  let html = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    html += nl2br(value.slice(lastIndex, match.index));
    const href = sanitizeEmailHref(match[1] ?? match[4] ?? "");
    const label = match[2] ?? match[3] ?? "";
    if (href) {
      html += `<a href="${escapeHtml(href)}" style="color:${NAVY};text-decoration:underline;">${escapeHtml(label)}</a>`;
    } else {
      html += nl2br(match[0]);
    }
    lastIndex = pattern.lastIndex;
  }
  html += nl2br(value.slice(lastIndex));
  return html;
};

const applyVars = (text: string, vars?: EmailMergeVars): string =>
  vars ? interpolateMergeTokens(text, vars) : text;

const renderBlock = (
  block: CampaignBlock,
  vars?: EmailMergeVars,
  mergeHtml?: Partial<Record<"order_summary" | "shipment_details", string>>,
): string => {
  switch (block.type) {
    case "heading":
      return `<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:${NAVY};font-weight:400;">${escapeHtml(applyVars(block.text, vars))}</h1>`;
    case "paragraph":
      return `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:${INK};">${formatInlineEmailHtml(applyVars(block.text, vars))}</p>`;
    case "image": {
      const src = absoluteAssetUrl(block.url);
      const alt = escapeHtml(block.alt || "");
      return `<div style="margin:0 0 20px;"><img src="${escapeHtml(src)}" alt="${alt}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" /></div>`;
    }
    case "product": {
      const href = absoluteAssetUrl(`/shop/${block.slug}`);
      const src = absoluteAssetUrl(block.image_url);
      const label = escapeHtml(block.cta_label || "View print");
      return `
        <div style="margin:0 0 24px;border:1px solid #e5e0d6;padding:12px;">
          <a href="${escapeHtml(href)}" style="text-decoration:none;color:${INK};">
            <img src="${escapeHtml(src)}" alt="${escapeHtml(block.title)}" width="576" style="display:block;width:100%;max-width:576px;height:auto;border:0;margin:0 0 12px;" />
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.3;color:${NAVY};margin:0 0 10px;">${escapeHtml(block.title)}</div>
          </a>
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:10px 16px;background:${NAVY};color:${CREAM};text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;">${label}</a>
        </div>`;
    }
    case "button": {
      const href = absoluteAssetUrl(applyVars(block.url, vars));
      return `<div style="margin:0 0 20px;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 18px;background:${NAVY};color:${CREAM};text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;">${escapeHtml(applyVars(block.label, vars))}</a></div>`;
    }
    case "merge": {
      const html = mergeHtml?.[block.slot];
      if (html) return html;
      const label = block.slot === "order_summary" ? "Order details" : "Shipment details";
      return `<div style="margin:0 0 16px;padding:14px;border:1px dashed #c4b89a;color:${MUTED};font-family:Arial,Helvetica,sans-serif;font-size:14px;">${escapeHtml(label)} will be filled in when the email is sent.</div>`;
    }
    default:
      return "";
  }
};

export type RenderCampaignEmailInput = {
  subject: string;
  previewText?: string | null;
  blocks: CampaignBlock[];
  unsubscribeUrl?: string | null;
  recipientFirstName?: string | null;
  /** When true, skip derivative generation (caller already prepared blocks). */
  skipImagePrepare?: boolean;
  /** Skip the automatic “Dear Name,” line when the template already greets the reader. */
  autoGreeting?: boolean;
  mergeVars?: EmailMergeVars;
  mergeHtml?: Partial<Record<"order_summary" | "shipment_details", string>>;
  footerNote?: string;
};

export const renderCampaignEmailHtml = async ({
  subject,
  previewText,
  blocks,
  unsubscribeUrl,
  recipientFirstName,
  skipImagePrepare = false,
  autoGreeting = true,
  mergeVars,
  mergeHtml,
  footerNote,
}: RenderCampaignEmailInput): Promise<string> => {
  const readyBlocks = skipImagePrepare ? blocks : await prepareCampaignBlocksForEmail(blocks);
  const greetingName = autoGreeting ? recipientFirstName?.trim().split(/\s+/)[0] || null : null;
  const greeting = greetingName
    ? `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:${INK};">Dear ${escapeHtml(greetingName)},</p>`
    : "";

  const body = readyBlocks.map((block) => renderBlock(block, mergeVars, mergeHtml)).join("\n");
  const preview = escapeHtml(applyVars((previewText || subject || "").trim(), mergeVars));
  const title = escapeHtml(applyVars(subject || siteConfig.name, mergeVars));
  const year = new Date().getFullYear();
  const unsub = unsubscribeUrl?.trim();
  const legal = footerNote
    ? escapeHtml(footerNote)
    : unsub
      ? `You are receiving this because you subscribed on the exhibition website.`
      : `You received this email because you placed an order at ${siteConfig.url.replace(/^https?:\/\//, "")}.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preview}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${CREAM};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e5e0d6;">
          <tr>
            <td style="padding:18px 24px;background:${NAVY};">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;letter-spacing:0.04em;color:${CREAM};">${escapeHtml(siteConfig.name)}</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${GOLD};margin-top:4px;">${escapeHtml(siteConfig.artist)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;">
              ${greeting}
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${MUTED};">
              <p style="margin:0 0 10px;">
                <a href="${escapeHtml(siteConfig.social.instagram)}" style="color:${MUTED};">Instagram</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(siteConfig.social.facebook)}" style="color:${MUTED};">Facebook</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(absoluteAssetUrl("/shop"))}" style="color:${MUTED};">Shop</a>
              </p>
              <p style="margin:0 0 10px;">The Georgette 150th · John Bowskill · <a href="${escapeHtml(siteConfig.url)}" style="color:${MUTED};">${escapeHtml(siteConfig.url.replace(/^https?:\/\//, ""))}</a></p>
              <p style="margin:0;font-size:12px;">
                ${legal}
                ${unsub ? ` <a href="${escapeHtml(unsub)}" style="color:${MUTED};">Unsubscribe</a> ·` : ""}
                © ${year}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
