import { siteContact } from "./contact";
import { siteConfig } from "./metadata";
import { mmToInches, roundDisplayValue } from "./print-size";

export const PIXEL_PERFECT_ORDER_EMAIL = "admin@pixelperfect.com.au";

const ISO_SHEETS: Array<{ label: string; shortMm: number; longMm: number }> = [
  { label: "A4", shortMm: 210, longMm: 297 },
  { label: "A3", shortMm: 297, longMm: 420 },
  { label: "A2", shortMm: 420, longMm: 594 },
  { label: "A1", shortMm: 594, longMm: 841 },
  { label: "A0", shortMm: 841, longMm: 1189 },
];

export type PixelPerfectEmailItem = {
  order_number: string;
  photo_title: string;
  width_mm: number;
  height_mm: number;
  paper_type: string | null;
  finish: string | null;
  is_framed: boolean;
  frame_type: string | null;
  print_dpi: number;
  quantity: number;
  drive_file_url: string | null;
  drive_folder_url?: string | null;
  filename: string;
  canvas_wrap_mm: number | null;
  wrap_style: string | null;
};

type EmailField = {
  label: string;
  value: string;
  href?: string;
};

const TABLE_STYLE =
  "border-collapse:collapse;width:100%;max-width:640px;margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#111;";
const HEADER_CELL_STYLE =
  "background:#333333;color:#ffffff;text-align:left;padding:8px 10px;font-weight:bold;";
const LABEL_CELL_STYLE =
  "border:1px solid #cccccc;padding:6px 10px;width:38%;vertical-align:top;background:#f7f7f7;";
const VALUE_CELL_STYLE = "border:1px solid #cccccc;padding:6px 10px;vertical-align:top;";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const htmlValue = (field: EmailField): string => {
  const escaped = escapeHtml(field.value).replaceAll("\n", "<br>");
  if (!field.href) return escaped;
  return `<a href="${escapeHtml(field.href)}">${escaped}</a>`;
};

const tableHtml = (title: string, fields: EmailField[]): string => {
  const rows = fields
    .map(
      (field) =>
        `<tr><td style="${LABEL_CELL_STYLE}">${escapeHtml(field.label)}</td><td style="${VALUE_CELL_STYLE}">${htmlValue(field)}</td></tr>`,
    )
    .join("");

  return [
    `<table role="presentation" cellpadding="0" cellspacing="0" style="${TABLE_STYLE}">`,
    `<thead><tr><th colspan="2" style="${HEADER_CELL_STYLE}">${escapeHtml(title)}</th></tr></thead>`,
    `<tbody>${rows}</tbody>`,
    "</table>",
  ].join("");
};

const tableText = (title: string, fields: EmailField[]): string =>
  [title, "", ...fields.flatMap((field) => [field.label, field.value, ""])].join("\n").trimEnd();

export const pixelPerfectPaperLabel = (paperType: string | null): string => {
  const raw = paperType?.trim() || "Hahnemuhle Photo Rag";
  return raw.replaceAll("ä", "a").replaceAll("ö", "o").replaceAll("ü", "u");
};

export const formatPixelPerfectInchSize = (widthMm: number, heightMm: number): string => {
  const widthIn = roundDisplayValue(mmToInches(widthMm), "in").toFixed(2);
  const heightIn = roundDisplayValue(mmToInches(heightMm), "in").toFixed(2);
  const iso = matchIsoSheet(widthMm, heightMm);
  return iso ? `${widthIn} x ${heightIn} (${iso})` : `${widthIn} x ${heightIn}`;
};

export const matchIsoSheet = (widthMm: number, heightMm: number): string | null => {
  const short = Math.min(widthMm, heightMm);
  const long = Math.max(widthMm, heightMm);
  const match = ISO_SHEETS.find(
    (sheet) => Math.abs(short - sheet.shortMm) <= 2 && Math.abs(long - sheet.longMm) <= 2,
  );
  return match?.label ?? null;
};

const imageOptions = (item: PixelPerfectEmailItem): string => {
  const finish = item.finish?.toLowerCase() ?? "";
  const paper = item.paper_type?.toLowerCase() ?? "";
  if (finish.includes("canvas") || paper.includes("canvas")) return "Canvas";
  return "Photo or Inkjet printing";
};

const framingOption = (item: PixelPerfectEmailItem): string => {
  if (item.finish?.toLowerCase().includes("canvas") || item.paper_type?.toLowerCase().includes("canvas")) {
    const wrap = item.canvas_wrap_mm
      ? `Ready to hang canvas (${item.canvas_wrap_mm} mm ${item.wrap_style || "wrap"})`
      : "Ready to hang canvas";
    return wrap;
  }
  if (!item.is_framed) return "None";
  const raw = (item.frame_type ?? "").toLowerCase();
  if (raw.includes("deluxe")) return "Deluxe frame with Perspex";
  return "Standard frame with Perspex";
};

const trimOption = (item: PixelPerfectEmailItem): string =>
  item.is_framed
    ? "No, leave my prints untrimmed (small white handling border) for framing or mounting"
    : "Not beyond the ordered size";

const studioFields = (dpi: number): EmailField[] => [
  { label: "Full Name", value: siteContact.name },
  { label: "Email address", value: siteContact.email },
  { label: "Phone Number", value: siteContact.phoneDisplay.replaceAll(" ", "") },
  { label: "Are you a new customer?", value: "No" },
  {
    label: "Do you give permission to use photos of your work in production, in our social media posts?",
    value: "No",
  },
  { label: "Pick Up or Delivery", value: "Please deliver to my address" },
  { label: "Shipping Address", value: ["20 Morris Rd", "Forest Grove, Western Australia 6286"].join("\n") },
  {
    label: "Are your files print ready?",
    value: `Yes, my files are print ready (${dpi}ppi, AdobeRGB 1998 & sized for print)`,
  },
  {
    label: "Are your image files already on cloud storage? (Dropbox, wetransfer, iCloud etc)",
    value:
      "Yes, I can provide a link to my files for downloading. Each photograph has its own Google Drive folder holding every size ordered; filenames are in each print table below.",
  },
  { label: "Studio address on file", value: siteConfig.exhibition.location },
];

const printFields = (item: PixelPerfectEmailItem): EmailField[] => {
  const folderUrl = item.drive_folder_url?.trim() || "";
  const fileUrl = item.drive_file_url?.trim() || "";
  const driveUrl = folderUrl || fileUrl || "File link not available yet";
  const filename = item.filename.trim() || "See Google Drive link";
  return [
    { label: "File Name", value: filename },
    {
      label: "Google Drive Link",
      value: driveUrl,
      href: driveUrl.startsWith("http") ? driveUrl : undefined,
    },
    { label: "Which image options do you like?", value: imageOptions(item) },
    { label: "Choose a paper", value: pixelPerfectPaperLabel(item.paper_type) },
    { label: "How many do you want?", value: String(item.quantity) },
    { label: "What size (inches)?", value: formatPixelPerfectInchSize(item.width_mm, item.height_mm) },
    { label: "Would you like Framing and Mounting options?", value: framingOption(item) },
    { label: "Do your prints require trimming?", value: trimOption(item) },
  ];
};

const printTitle = (item: PixelPerfectEmailItem, index: number, total: number): string =>
  `Print ${index + 1} of ${total} — ${item.order_number} — ${item.photo_title}`;

export const buildPixelPerfectOrderEmail = (
  items: PixelPerfectEmailItem[],
): { to: string; subject: string; body: string; html: string } => {
  const prints = items.filter((item) => item.order_number);
  const dpi = prints[0]?.print_dpi || 300;
  const refs = [...new Set(prints.map((item) => item.order_number))];
  const subject =
    prints.length === 1
      ? `Print order ${prints[0]!.order_number} — ${prints[0]!.photo_title}`
      : `Studio print order — ${prints.length} items (${refs.join(", ")})`;

  const studio = studioFields(dpi);
  const printBlocks = prints.map((item, index) => ({
    title: printTitle(item, index, prints.length),
    fields: printFields(item),
  }));

  const body = [
    `To: ${PIXEL_PERFECT_ORDER_EMAIL}`,
    `Subject: ${subject}`,
    "",
    "Hello Pixel Perfect,",
    "",
    "Please invoice the studio print order below. I am sending this instead of the website form. Files are print-ready on Google Drive. I will pay on invoice.",
    "",
    tableText("Studio details", studio),
    "",
    ...printBlocks.flatMap((block) => ["", tableText(block.title, block.fields)]),
  ].join("\n");

  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.5;">`,
    `<p style="margin:0 0 8px;"><strong>To:</strong> ${escapeHtml(PIXEL_PERFECT_ORDER_EMAIL)}</p>`,
    `<p style="margin:0 0 18px;"><strong>Subject:</strong> ${escapeHtml(subject)}</p>`,
    `<p style="margin:0 0 12px;">Hello Pixel Perfect,</p>`,
    `<p style="margin:0 0 18px;">Please invoice the studio print order below. I am sending this instead of the website form. Files are print-ready on Google Drive. I will pay on invoice.</p>`,
    tableHtml("Studio details", studio),
    ...printBlocks.map((block) => tableHtml(block.title, block.fields)),
    "</div>",
  ].join("");

  return { to: PIXEL_PERFECT_ORDER_EMAIL, subject, body, html };
};
