/**
 * Shop framing styles aligned with Pixel Perfect
 * https://pixelperfect.com.au/framing/
 *
 * We only sell Standard and Deluxe (with Perspex for shipping). Box / Premium
 * are not offered online.
 */

export type ShopFrameId = "none" | "standard" | "deluxe";

export type ShopFrameOption = {
  id: ShopFrameId;
  /** Maps to custom checkout / DB frame_style where applicable. */
  customFrameStyleId: "none" | "standard_perspex" | "deluxe_perspex";
  label: string;
  /** One-line buyer summary under the label. */
  summary: string;
  /** Face width used for the virtual preview (mm). */
  faceMm: number;
  /** Moulding depth from PP (mm) — informational. */
  depthMm: number | null;
  sampleImage?: string;
};

/** Mid Standard face (PP offers 20 / 30 / 42mm). */
export const STANDARD_FRAME_FACE_MM = 30;
export const STANDARD_FRAME_DEPTH_MM = 20;
/** Deluxe is explicitly 10mm face × 25mm deep. */
export const DELUXE_FRAME_FACE_MM = 10;
export const DELUXE_FRAME_DEPTH_MM = 25;

export const SHOP_FRAME_OPTIONS: ShopFrameOption[] = [
  {
    id: "none",
    customFrameStyleId: "none",
    label: "Unframed",
    summary: "Print only — shipped flat or in a tube",
    faceMm: 0,
    depthMm: null,
  },
  {
    id: "standard",
    customFrameStyleId: "standard_perspex",
    label: "Standard frame",
    summary:
      "Wider moulding (20–42mm face, 20mm deep) with Perspex for shipping. Black, white, timber, teak or silver.",
    faceMm: STANDARD_FRAME_FACE_MM,
    depthMm: STANDARD_FRAME_DEPTH_MM,
    sampleImage: "/frames/standard-sample.jpg",
  },
  {
    id: "deluxe",
    customFrameStyleId: "deluxe_perspex",
    label: "Deluxe frame",
    summary:
      "Slimmer 10mm face, 25mm deep — cleaner, streamlined look with Perspex for shipping. Black, white, timber, dark brown or teak.",
    faceMm: DELUXE_FRAME_FACE_MM,
    depthMm: DELUXE_FRAME_DEPTH_MM,
    sampleImage: "/frames/deluxe-sample.jpg",
  },
];

export const shopFrameById = (id: ShopFrameId): ShopFrameOption =>
  SHOP_FRAME_OPTIONS.find((option) => option.id === id) ?? SHOP_FRAME_OPTIONS[0]!;

export const shopFrameByCustomStyle = (
  frameStyle: "none" | "standard_perspex" | "deluxe_perspex" | string,
): ShopFrameOption => {
  const match = SHOP_FRAME_OPTIONS.find((option) => option.customFrameStyleId === frameStyle);
  return match ?? SHOP_FRAME_OPTIONS[0]!;
};

/** Product-page “Framed” offer uses Standard + Perspex. */
export const OFFER_FRAMED_FRAME = shopFrameById("standard");
export const OFFER_FRAMED_SAMPLE_IMAGE = OFFER_FRAMED_FRAME.sampleImage!;

export const FRAME_NOTE_PERSPEX =
  "Framed prints use Perspex instead of glass so they can be shipped safely.";

/**
 * Buyer-facing glazing note. Fixed sizes are glazed with Opti-shield and custom
 * sizes with Perspex; both are acrylic, so the storefront says the one thing a
 * shopper needs to know rather than naming a different brand on each page.
 */
export const FRAME_NOTE_ACRYLIC =
  "Framed prints are glazed with acrylic instead of glass so they can be shipped safely.";
