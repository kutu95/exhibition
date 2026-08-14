import { describe, expect, it } from "vitest";

import {
  PIXEL_PERFECT_ORDER_EMAIL,
  buildPixelPerfectOrderEmail,
  formatPixelPerfectInchSize,
  matchIsoSheet,
  pixelPerfectPaperLabel,
} from "../lib/pixel-perfect-email";

const baseItem = {
  order_number: "GEO-0042",
  photo_title: "Isaac Rock No. 3",
  width_mm: 420,
  height_mm: 297,
  paper_type: "Hahnemühle Photo Rag 308gsm",
  finish: "archival_matte",
  is_framed: false,
  frame_type: null,
  print_dpi: 300,
  quantity: 1,
  is_studio_order: true,
  drive_folder_url: "https://drive.google.com/drive/folders/abc123",
  filename: "GEO-0042_isaac-rock-no-3_420x297mm.tif",
  canvas_wrap_mm: null,
  wrap_style: null,
  shipping_address: {
    street: "Studio pickup",
    suburb: "Margaret River",
    state: "WA",
    postcode: "6285",
  },
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

  it("builds a confirmation-style email for a studio order", () => {
    const email = buildPixelPerfectOrderEmail(baseItem);
    expect(email.to).toBe(PIXEL_PERFECT_ORDER_EMAIL);
    expect(email.subject).toBe("Print order GEO-0042 — Isaac Rock No. 3");
    expect(email.body).toContain("John Bowskill");
    expect(email.body).toContain("john@streamtime.com.au");
    expect(email.body).toContain("Please deliver to my address");
    expect(email.body).toContain("20 Morris Rd");
    expect(email.body).toContain("Forest Grove, Western Australia 6286");
    expect(email.body).toContain("GEO-0042_isaac-rock-no-3_420x297mm.tif");
    expect(email.body).toContain("https://drive.google.com/drive/folders/abc123");
    expect(email.body).toContain("Hahnemuhle Photo Rag 308gsm");
    expect(email.body).toContain("16.54 x 11.69 (A3)");
    expect(email.body).toContain("Photo or Inkjet printing");
    expect(email.body).toContain("Would you like Framing and Mounting options?\nNone");
    expect(email.mailtoHref.startsWith(`mailto:${PIXEL_PERFECT_ORDER_EMAIL}?`)).toBe(true);
  });

  it("asks for untrimmed prints when framing is included", () => {
    const email = buildPixelPerfectOrderEmail({
      ...baseItem,
      is_framed: true,
      frame_type: "standard_perspex",
    });
    expect(email.body).toContain("leave my prints untrimmed");
    expect(email.body).toContain("Standard frame with Perspex");
  });
});
