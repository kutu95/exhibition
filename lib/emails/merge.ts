import { formatAUD } from "../utils/currency";

export type EmailMergeVars = Record<string, string>;

export type OrderEmailLine = {
  title: string;
  variant_label: string;
  quantity: number;
  unit_price_aud: number;
  edition_number_assigned: number | null;
  edition_size: number | null;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const interpolateMergeTokens = (text: string, vars: EmailMergeVars): string =>
  text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) => vars[key.toLowerCase()] ?? "");

export const editionLine = (
  editionNumber: number | null | undefined,
  editionSize: number | null | undefined,
): string => {
  if (editionSize && editionNumber) return `Edition ${editionNumber} of ${editionSize}`;
  if (editionSize) return `Limited edition of ${editionSize}`;
  return "Open edition";
};

export const firstNameFrom = (name: string | null | undefined): string =>
  name?.trim().split(/\s+/)[0] || "";

export const renderOrderSummaryHtml = (items: OrderEmailLine[], totalAud: number): string => {
  const rows = items
    .map((item) => {
      const edition = editionLine(item.edition_number_assigned, item.edition_size);
      return `
        <li style="margin:0 0 12px;">
          <div style="font-weight:600;">${escapeHtml(item.title)}</div>
          <div style="color:#4b5563;font-size:14px;">${escapeHtml(item.variant_label)}</div>
          <div style="color:#6b7280;font-size:13px;">${escapeHtml(edition)}</div>
          <div style="font-size:14px;">${escapeHtml(formatAUD(item.unit_price_aud))} × ${item.quantity}</div>
        </li>`;
    })
    .join("");

  return `
    <div style="margin:0 0 16px;padding:14px;border:1px solid #d1d5db;">
      <ul style="margin:0;padding-left:18px;">${rows}</ul>
      <p style="font-size:16px;margin:14px 0 0;"><strong>Total:</strong> ${escapeHtml(formatAUD(totalAud))}</p>
    </div>`;
};

export const renderShipmentDetailsHtml = (input: {
  order_number: string;
  photo_title: string;
  variant_label: string;
  edition_line: string;
  tracking_number: string;
}): string => `
    <div style="margin:0 0 16px;padding:14px;border:1px solid #d1d5db;">
      <p style="margin:0 0 10px;"><strong>${escapeHtml(input.order_number)}</strong></p>
      <p style="margin:0;"><strong>${escapeHtml(input.photo_title)}</strong></p>
      <p style="margin:4px 0;color:#4b5563;">${escapeHtml(input.variant_label)}</p>
      <p style="margin:4px 0;color:#6b7280;">${escapeHtml(input.edition_line)}</p>
      <p style="margin:12px 0 0;"><strong>Tracking number:</strong> ${escapeHtml(input.tracking_number)}</p>
    </div>`;

export const sampleOrderMergeVars = (): EmailMergeVars => ({
  customer_name: "Alex Taylor",
  first_name: "Alex",
  order_number: "GEO-0042",
  total: formatAUD(45000),
  tracking_number: "ABC123456789",
  photo_title: "Isaac Rock No. 3",
  variant_label: "A3 · Hahnemühle Photo Rag",
  edition_line: "Edition 2 of 25",
  contact_email: "hello@margies.app",
});

export const sampleOrderLines = (): OrderEmailLine[] => [
  {
    title: "Isaac Rock No. 3",
    variant_label: "A3 · Hahnemühle Photo Rag",
    quantity: 1,
    unit_price_aud: 45000,
    edition_number_assigned: 2,
    edition_size: 25,
  },
];
