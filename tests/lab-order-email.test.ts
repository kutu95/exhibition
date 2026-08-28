import { describe, expect, it } from "vitest";

import {
  LAB_ORDER_EMAIL,
  buildLabOrderEmail,
  formatLabInchSize,
  labPaperLabel,
  matchIsoSheet,
} from "../lib/lab-order-email";

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

describe("lab order email", () => {
  it("labels exact ISO sheets", () => {
    expect(matchIsoSheet(210, 297)).toBe("A4");
    expect(matchIsoSheet(297, 210)).toBe("A4");
    expect(formatLabInchSize(210, 297)).toBe("8.27 x 11.69 (A4)");
    expect(matchIsoSheet(420, 280)).toBeNull();
    expect(formatLabInchSize(420, 280)).toBe("16.54 x 11.02");
  });

  it("keeps paper names plain ASCII", () => {
    expect(labPaperLabel("Hahnemühle Photo Rag Pearl")).toBe("Hahnemuhle Photo Rag Pearl");
    expect(labPaperLabel(null)).toBe("Ilford Galerie Smooth Pearl");
  });

  it("addresses Blue Wren and drops the old lab's form questions", () => {
    const email = buildLabOrderEmail([itemA]);
    expect(email.to).toBe(LAB_ORDER_EMAIL);
    expect(LAB_ORDER_EMAIL).toBe("info@bluewrenframers.com");
    expect(email.body).toContain("Hello Blue Wren,");
    expect(email.html).toContain("Hello Blue Wren,");
    expect(email.body).toContain("Collecting from Blue Wren Gallery and Framers");
    expect(email.body).not.toContain("Pixel Perfect");
    expect(email.body).not.toContain("Are you a new customer?");
    expect(email.body).not.toContain("social media posts");
    expect(email.body).not.toContain("Which image options do you like?");
    expect(email.body).not.toContain("Shipping Address");
    expect(email.body).not.toContain("20 Morris Rd");
  });

  it("puts identity once in the header and lists each print without prices", () => {
    const email = buildLabOrderEmail([itemA, itemB]);
    expect(email.subject).toBe("Studio print order — 2 items (GEO-0042, GEO-0043)");
    expect(email.body).toContain("John Bowskill");
    expect(email.body.match(/Studio\n/g)?.length).toBe(1);
    expect(email.body).toContain("Print 1 of 2 — GEO-0042 — Isaac Rock No. 3");
    expect(email.body).toContain("Print 2 of 2 — GEO-0043 — Redgate");
    expect(email.body).toContain("File Name");
    expect(email.body).toContain("Google Drive Link");
    expect(email.body).toContain("GEO-0042_isaac-rock-no-3_420x297mm.tif");
    expect(email.body).toContain("https://drive.google.com/drive/folders/order43");
    expect(email.body).not.toContain("https://drive.google.com/file/d/def456/view");
    expect(email.html).toContain("href=\"https://drive.google.com/drive/folders/order43\"");
    expect(email.body).toContain("16.54 x 11.69 (A3)");
    expect(email.body).toContain("Standard frame with Perspex");
    expect(email.body).toContain("Leave untrimmed");
    expect(email.body).toContain("Trim to the ordered size");
    expect(email.body).not.toContain("Price (AUD)");
    expect(email.body.match(/Email address/g)?.length).toBe(1);
    expect(email.html.match(/<table/g)?.length).toBe(3);
    expect(email.html.match(/background:#333333/g)?.length).toBe(3);
    expect(email.html).toContain("Print 1 of 2 — GEO-0042 — Isaac Rock No. 3");
  });

  it("uses a single-print subject when there is only one item", () => {
    const email = buildLabOrderEmail([itemA]);
    expect(email.subject).toBe("Print order GEO-0042 — Isaac Rock No. 3");
    expect(email.body).toContain("Print 1 of 1 — GEO-0042 — Isaac Rock No. 3");
  });

  it("falls back to the file link when no Drive folder is stored", () => {
    const email = buildLabOrderEmail([{ ...itemA, drive_folder_url: null }]);
    expect(email.body).toContain("https://drive.google.com/file/d/abc123/view");
    expect(email.body).not.toContain("/drive/folders/");
  });
});
