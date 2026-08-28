import { describe, expect, it } from "vitest";

import {
  PIXEL_PERFECT_ORDER_EMAIL,
  buildPixelPerfectOrderEmail,
  formatPixelPerfectInchSize,
  matchIsoSheet,
  pixelPerfectPaperLabel,
} from "../lib/pixel-perfect-email";

const rag = {
  paper_type: "Hahnemühle Photo Rag 308gsm",
  finish: "archival_matte",
  is_framed: false,
  frame_type: null,
  print_dpi: 300,
  quantity: 1,
  canvas_wrap_mm: null,
  wrap_style: null,
};

const itemA = {
  ...rag,
  order_number: "GEO-0042",
  photo_title: "Isaac Rock No. 3",
  width_mm: 420,
  height_mm: 297,
  drive_file_url: "https://drive.google.com/file/d/abc123/view",
  drive_folder_url: "https://drive.google.com/drive/folders/order42",
  filename: "GEO-0042_isaac-rock-no-3_420x297mm.tif",
};

const itemB = {
  ...rag,
  order_number: "GEO-0043",
  photo_title: "Redgate",
  width_mm: 594,
  height_mm: 396,
  is_framed: true,
  frame_type: "standard_perspex",
  drive_file_url: "https://drive.google.com/file/d/def456/view",
  drive_folder_url: "https://drive.google.com/drive/folders/order43",
  filename: "GEO-0043_redgate_594x396mm.tif",
};

describe("pixel Perfect order email", () => {
  it("labels exact ISO sheets the way Pixel Perfect does", () => {
    expect(matchIsoSheet(210, 297)).toBe("A4");
    expect(matchIsoSheet(297, 210)).toBe("A4");
    expect(formatPixelPerfectInchSize(210, 297)).toBe("8.27 x 11.69 (A4)");
    expect(matchIsoSheet(420, 280)).toBeNull();
    expect(formatPixelPerfectInchSize(420, 280)).toBe("16.54 x 11.02");
  });

  it("strips umlauts to match Pixel Perfect paper names", () => {
    expect(pixelPerfectPaperLabel("Hahnemühle Photo Rag Pearl")).toBe("Hahnemuhle Photo Rag Pearl");
  });

  it("puts identity once in the header and lists each print without prices", () => {
    const email = buildPixelPerfectOrderEmail([itemA, itemB]);
    expect(email.to).toBe(PIXEL_PERFECT_ORDER_EMAIL);
    expect(email.subject).toBe("Studio print order — 2 items (GEO-0042, GEO-0043)");
    expect(email.body).toContain("John Bowskill");
    expect(email.body).toContain("20 Morris Rd");
    expect(email.body.match(/Full Name/g)?.length).toBe(1);
    expect(email.body.match(/Shipping Address/g)?.length).toBe(1);
    expect(email.body).toContain("Print 1 of 2 — GEO-0042 — Isaac Rock No. 3");
    expect(email.body).toContain("Print 2 of 2 — GEO-0043 — Redgate");
    expect(email.body).toContain("File Name");
    expect(email.body).not.toContain("File or Folder Name");
    expect(email.body).toContain("Google Drive Link");
    expect(email.body).toContain("GEO-0042_isaac-rock-no-3_420x297mm.tif");
    expect(email.body).toContain("https://drive.google.com/drive/folders/order43");
    expect(email.body).not.toContain("https://drive.google.com/file/d/def456/view");
    expect(email.html).toContain("href=\"https://drive.google.com/drive/folders/order43\"");
    expect(email.body).toContain("16.54 x 11.69 (A3)");
    expect(email.body).toContain("Standard frame with Perspex");
    expect(email.body).toContain("leave my prints untrimmed");
    expect(email.body).toContain("Not beyond the ordered size");
    expect(email.body).not.toContain("Price (AUD)");
    expect(email.body.match(/Email address/g)?.length).toBe(1);
    expect(email.html.match(/<table/g)?.length).toBe(3);
    expect(email.html.match(/background:#333333/g)?.length).toBe(3);
    expect(email.html).toContain("Print 1 of 2 — GEO-0042 — Isaac Rock No. 3");
    expect(email.html).toContain("href=\"https://drive.google.com/drive/folders/order43\"");
  });

  it("uses a single-print subject when there is only one item", () => {
    const email = buildPixelPerfectOrderEmail([itemA]);
    expect(email.subject).toBe("Print order GEO-0042 — Isaac Rock No. 3");
    expect(email.body).toContain("Print 1 of 1 — GEO-0042 — Isaac Rock No. 3");
  });

  it("falls back to the file link when no Drive folder is stored", () => {
    const email = buildPixelPerfectOrderEmail([{ ...itemA, drive_folder_url: null }]);
    expect(email.body).toContain("https://drive.google.com/file/d/abc123/view");
    expect(email.body).not.toContain("/drive/folders/");
  });
});
