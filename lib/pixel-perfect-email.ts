import { siteContact } from "./contact";
import { siteConfig } from "./metadata";
import { estimatePixelPerfectLabCost, mmToInches, roundDisplayValue } from "./print-size";

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
  is_studio_order: boolean;
  drive_folder_url: string | null;
  filename: string;
  canvas_wrap_mm: number | null;
  wrap_style: string | null;
  shipping_address: PixelPerfectEmailAddress;
};

const field = (label: string, value: string): string => `${label}\n${value}`;

const expandState = (state: string): string => {
  const trimmed = state.trim();
  if (/^wa$/i.test(trimmed)) return "Western Australia";
  return trimmed;
};

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

const isStudioLikeAddress = (address: PixelPerfectEmailAddress): boolean => {
  const street = address.street.trim().toLowerCase();
  return street.includes("studio") || street.includes("pickup") || street.includes("exhibition");
};

const shippingLines = (item: PixelPerfectEmailItem): string => {
  if (item.is_studio_order || isStudioLikeAddress(item.shipping_address)) {
    return ["20 Morris Rd", "Forest Grove, Western Australia 6286"].join("\n");
  }
  const { street, suburb, state, postcode } = item.shipping_address;
  const locality = [suburb, expandState(state), postcode].filter(Boolean).join(", ");
  return [street, locality].filter(Boolean).join("\n");
};

const estimatedPrice = (item: PixelPerfectEmailItem): string => {
  const estimate = item.paper_type
    ? estimatePixelPerfectLabCost(item.width_mm, item.height_mm, item.paper_type)
    : null;
  if (!estimate) return "Please quote";
  const extra = item.is_framed || item.finish?.toLowerCase().includes("canvas") ? " (print only — please add framing/canvas)" : "";
  return `${estimate.labCostAud.toFixed(2)}${extra}`;
};

export const buildPixelPerfectOrderEmail = (
  item: PixelPerfectEmailItem,
): { to: string; subject: string; body: string; mailtoHref: string } => {
  const paper = pixelPerfectPaperLabel(item.paper_type);
  const sizeIn = formatPixelPerfectInchSize(item.width_mm, item.height_mm);
  const options = imageOptions(item);
  const qty = String(item.quantity);
  const dpi = item.print_dpi || 300;
  const folder = item.drive_folder_url?.trim() || "";
  const filename = item.filename.trim();

  const subject = `Print order ${item.order_number} — ${item.photo_title}`;

  const body = [
    "Hello Pixel Perfect,",
    "",
    "Please invoice the print order below. I am sending this instead of the website form. Files are print-ready on Google Drive. I will pay on invoice.",
    "",
    `Our reference: ${item.order_number} — ${item.photo_title}`,
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
    field("Shipping Address", shippingLines(item)),
    "",
    field(
      "Are your files print ready?",
      `Yes, my files are print ready (${dpi}ppi, AdobeRGB 1998 & sized for print)`,
    ),
    "",
    field(
      "Do your prints require trimming?",
      item.is_framed
        ? "No, leave my prints untrimmed (small white handling border) for framing or mounting"
        : "Yes, please trim to the ordered size",
    ),
    "",
    field("File or Folder Name", filename || folder || "See Google Drive link below"),
    "",
    field("Which image options do you like?", options),
    "",
    field("Choose a paper", paper),
    "",
    field("How many do you want?", qty),
    "",
    field("What size (inches)?", sizeIn),
    "",
    field("Would you like Framing and Mounting options?", framingOption(item)),
    "",
    field("Paper Choice", paper),
    "",
    field("Size (in)", sizeIn.replace(/ \([^)]+\)$/, "")),
    "",
    field("Image Options", options),
    "",
    field("Quantity", qty),
    "",
    field("Price (AUD)", estimatedPrice(item)),
    "",
    field("delivery", "Please deliver to my address"),
    "",
    field(
      "Are your image files already on cloud storage? (Dropbox, wetransfer, iCloud etc)",
      "Yes, I can provide a link to my files for downloading.",
    ),
    "",
    field(
      "ADD FILES : Option 1 : If your image files are already in cloud storage (Dropbox, Google Drive, Wetransfer, Apple Photos etc) you can paste the relevant link in this box.",
      folder || "Google Drive folder link will follow separately.",
    ),
    "",
    `Studio address on file: ${siteConfig.exhibition.location}.`,
  ].join("\n");

  const mailtoHref = `mailto:${PIXEL_PERFECT_ORDER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return { to: PIXEL_PERFECT_ORDER_EMAIL, subject, body, mailtoHref };
};
