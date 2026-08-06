import { siteConfig } from "../metadata";
import type { CampaignBlock } from "./blocks";

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

const renderBlock = (block: CampaignBlock): string => {
  switch (block.type) {
    case "heading":
      return `<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:${NAVY};font-weight:400;">${escapeHtml(block.text)}</h1>`;
    case "paragraph":
      return `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:${INK};">${nl2br(block.text)}</p>`;
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
      const href = absoluteAssetUrl(block.url);
      return `<div style="margin:0 0 20px;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 18px;background:${NAVY};color:${CREAM};text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;">${escapeHtml(block.label)}</a></div>`;
    }
    default:
      return "";
  }
};

export type RenderCampaignEmailInput = {
  subject: string;
  previewText?: string | null;
  blocks: CampaignBlock[];
  unsubscribeUrl: string;
  recipientFirstName?: string | null;
};

export const renderCampaignEmailHtml = ({
  subject,
  previewText,
  blocks,
  unsubscribeUrl,
  recipientFirstName,
}: RenderCampaignEmailInput): string => {
  const greetingName = recipientFirstName?.trim().split(/\s+/)[0] || null;
  const greeting = greetingName
    ? `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:${INK};">Dear ${escapeHtml(greetingName)},</p>`
    : "";

  const body = blocks.map(renderBlock).join("\n");
  const preview = escapeHtml((previewText || subject || "").trim());
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject || siteConfig.name)}</title>
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
                You are receiving this because you subscribed on the exhibition website.
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:${MUTED};">Unsubscribe</a>
                · © ${year}
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
