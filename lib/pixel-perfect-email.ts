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

export type PixelPerfectEmailAddress = {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
};

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
  drive_folder_url: string | null;
  filename: string;
  canvas_wrap_mm: number | null;
  wrap_style: string | null;
};

const field = (label: string, value: string): string => `${label}\n${value}`;

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
    : "Yes, please trim to the ordered size";

const printSection = (item: PixelPerfectEmailItem, index: number, total: number): string => {
  const paper = pixelPerfectPaperLabel(item.paper_type);
  const sizeIn = formatPixelPerfectInchSize(item.width_mm, item.height_mm);
  const folder = item.drive_folder_url?.trim() || "Folder link not available yet";
  const filename = item.filename.trim() || "See Google Drive folder";

  return [
    `Print ${index + 1} of ${total} — ${item.order_number} — ${item.photo_title}`,
    "",
    field("File or Folder Name", filename),
    "",
    field("Google Drive folder", folder),
    "",
    field("Which image options do you like?", imageOptions(item)),
    "",
    field("Choose a paper", paper),
    "",
    field("How many do you want?", String(item.quantity)),
    "",
    field("What size (inches)?", sizeIn),
    "",
    field("Would you like Framing and Mounting options?", framingOption(item)),
    "",
    field("Do your prints require trimming?", trimOption(item)),
  ].join("\n");
};

const headerBlock = (dpi: number): string =>
  [
    "Hello Pixel Perfect,",
    "",
    "Please invoice the studio print order below. I am sending this instead of the website form. Files are print-ready on Google Drive. I will pay on invoice.",
    "",
    field("Full Name", siteContact.name),
    "",
    field("Email address", siteContact.email),
    "",
    field("Phone Number", siteContact.phoneDisplay.replaceAll(" ", "")),
    "",
    field("Are you a new customer?", "No"),
    "",
    field(
      "Do you give permission to use photos of your work in production, in our social media posts?",
      "No",
    ),
    "",
    field("Pick Up or Delivery", "Please deliver to my address"),
    "",
    field("Shipping Address", ["20 Morris Rd", "Forest Grove, Western Australia 6286"].join("\n")),
    "",
    field(
      "Are your files print ready?",
      `Yes, my files are print ready (${dpi}ppi, AdobeRGB 1998 & sized for print)`,
    ),
    "",
    field(
      "Are your image files already on cloud storage? (Dropbox, wetransfer, iCloud etc)",
      "Yes, I can provide a link to my files for downloading. Folder links and filenames are in each print section below.",
    ),
    "",
    `Studio address on file: ${siteConfig.exhibition.location}.`,
  ].join("\n");

export const buildPixelPerfectOrderEmail = (
  items: PixelPerfectEmailItem[],
): { to: string; subject: string; body: string } => {
  const prints = items.filter((item) => item.order_number);
  const dpi = prints[0]?.print_dpi || 300;
  const refs = [...new Set(prints.map((item) => item.order_number))];
  const subject =
    prints.length === 1
      ? `Print order ${prints[0]!.order_number} — ${prints[0]!.photo_title}`
      : `Studio print order — ${prints.length} items (${refs.join(", ")})`;

  const body = [
    headerBlock(dpi),
    "",
    ...prints.flatMap((item, index) => ["", printSection(item, index, prints.length)]),
  ].join("\n");

  return { to: PIXEL_PERFECT_ORDER_EMAIL, subject, body };
};
