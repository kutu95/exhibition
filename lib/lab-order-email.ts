import { BLUE_WREN, BLUE_WREN_SMOOTH_PEARL_LABEL } from "./bluewren";
import { siteContact } from "./contact";

export const LAB_ORDER_EMAIL = BLUE_WREN.email;

const ISO_SHEETS: Array<{ label: string; shortMm: number; longMm: number }> = [
  { label: "A4", shortMm: 210, longMm: 297 },
  { label: "A3", shortMm: 297, longMm: 420 },
  { label: "A2", shortMm: 420, longMm: 594 },
  { label: "A1", shortMm: 594, longMm: 841 },
  { label: "A0", shortMm: 841, longMm: 1189 },
];

export type LabOrderEmailItem = {
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

/** Plain ASCII paper names so the label survives plain-text mail clients. */
export const labPaperLabel = (paperType: string | null): string => {
  const raw = paperType?.trim() || BLUE_WREN_SMOOTH_PEARL_LABEL;
  return raw.replaceAll("ä", "a").replaceAll("ö", "o").replaceAll("ü", "u");
};

export const formatLabSizeMm = (widthMm: number, heightMm: number): string => {
  const size = `${Math.round(widthMm)} × ${Math.round(heightMm)} mm`;
  const iso = matchIsoSheet(widthMm, heightMm);
  return iso ? `${size} (${iso})` : size;
};

export const matchIsoSheet = (widthMm: number, heightMm: number): string | null => {
  const short = Math.min(widthMm, heightMm);
  const long = Math.max(widthMm, heightMm);
  const match = ISO_SHEETS.find(
    (sheet) => Math.abs(short - sheet.shortMm) <= 2 && Math.abs(long - sheet.longMm) <= 2,
  );
  return match?.label ?? null;
};

/** Variants carry the presentation in `finish` ("Tier 1 · Mountboard", "Canvas · Image wrap"). */
const presentationText = (item: LabOrderEmailItem): string =>
  `${item.finish ?? ""} ${item.paper_type ?? ""}`.toLowerCase();

const isCanvas = (item: LabOrderEmailItem): boolean => presentationText(item).includes("canvas");

const isStretchedCanvas = (item: LabOrderEmailItem): boolean => {
  const text = presentationText(item);
  return (
    isCanvas(item) &&
    (text.includes("wrap") ||
      text.includes("stretch") ||
      text.includes("ready-to-hang") ||
      text.includes("ready to hang") ||
      Boolean(item.canvas_wrap_mm))
  );
};

const isMounted = (item: LabOrderEmailItem): boolean => presentationText(item).includes("mount");

const isFramed = (item: LabOrderEmailItem): boolean =>
  item.is_framed || presentationText(item).includes("framed");

const frameLabel = (item: LabOrderEmailItem): string =>
  (item.frame_type ?? "").toLowerCase().includes("deluxe")
    ? "Deluxe frame with Perspex"
    : "Standard frame with Perspex";

const finishOption = (item: LabOrderEmailItem): string => {
  if (isStretchedCanvas(item)) {
    const wrap = item.canvas_wrap_mm
      ? ` (${item.canvas_wrap_mm} mm ${item.wrap_style || "image wrap"})`
      : "";
    return `Stretched canvas, ready to hang — image wrap over the edges${wrap}`;
  }
  if (isCanvas(item)) return "Canvas sheet — rolled, not stretched";
  if (isFramed(item)) return `Framed — ${frameLabel(item)}`;
  if (isMounted(item)) return "Mounted on board, ready to frame";
  return "Print only — unmounted and unframed";
};

const studioFields = (dpi: number): EmailField[] => [
  { label: "Studio", value: siteContact.name },
  { label: "Email address", value: siteContact.email },
  { label: "Phone Number", value: siteContact.phoneDisplay.replaceAll(" ", "") },
  {
    label: "Files",
    value: `Print ready — ${dpi}ppi, Adobe RGB 1998, sized for print`,
  },
  {
    label: "File delivery",
    value:
      "Google Drive — each photograph has its own folder holding every size ordered; filenames are in each print table below.",
  },
  { label: "Collection", value: `Collecting from ${BLUE_WREN.name}, Dunsborough` },
];

const printFields = (item: LabOrderEmailItem): EmailField[] => {
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
    { label: "Paper", value: labPaperLabel(item.paper_type) },
    { label: "Finish", value: finishOption(item) },
    { label: "Size", value: formatLabSizeMm(item.width_mm, item.height_mm) },
    {
      label: "Quantity",
      value: item.quantity > 1 ? `${item.quantity} — print ${item.quantity} copies from the one file` : "1",
    },
  ];
};

const printTitle = (item: LabOrderEmailItem, index: number, total: number): string =>
  `Print ${index + 1} of ${total} — ${item.order_number} — ${item.photo_title}`;

export const buildLabOrderEmail = (
  items: LabOrderEmailItem[],
): { to: string; subject: string; body: string; html: string } => {
  const prints = items.filter((item) => item.order_number);
  const dpi = prints[0]?.print_dpi || 300;
  const refs = [...new Set(prints.map((item) => item.order_number))];
  const subject =
    prints.length === 1
      ? `Print order ${prints[0]!.order_number} — ${prints[0]!.photo_title}`
      : `Studio print order — ${prints.length} items (${refs.join(", ")})`;

  const intro =
    "Please invoice the studio print order below. Files are print-ready on Google Drive, and I will collect the prints from the gallery.";

  const studio = studioFields(dpi);
  const printBlocks = prints.map((item, index) => ({
    title: printTitle(item, index, prints.length),
    fields: printFields(item),
  }));

  const body = [
    `To: ${LAB_ORDER_EMAIL}`,
    `Subject: ${subject}`,
    "",
    "Hello Blue Wren,",
    "",
    intro,
    "",
    tableText("Studio details", studio),
    "",
    ...printBlocks.flatMap((block) => ["", tableText(block.title, block.fields)]),
  ].join("\n");

  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.5;">`,
    `<p style="margin:0 0 8px;"><strong>To:</strong> ${escapeHtml(LAB_ORDER_EMAIL)}</p>`,
    `<p style="margin:0 0 18px;"><strong>Subject:</strong> ${escapeHtml(subject)}</p>`,
    `<p style="margin:0 0 12px;">Hello Blue Wren,</p>`,
    `<p style="margin:0 0 18px;">${escapeHtml(intro)}</p>`,
    tableHtml("Studio details", studio),
    ...printBlocks.map((block) => tableHtml(block.title, block.fields)),
    "</div>",
  ].join("");

  return { to: LAB_ORDER_EMAIL, subject, body, html };
};
