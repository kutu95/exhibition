/**
 * Blue Wren Gallery and Framers (Dunsborough) — artist print media we sell.
 * Rates from their PAPER PRICING ARTIST sheet (AUD incl. GST).
 * 1 m² = 1,550.0031 in² (ISO).
 */

export const BLUE_WREN = {
  name: "Blue Wren Gallery and Framers",
  phone: "97591100",
  email: "info@bluewrenframers.com",
  address: "UNIT 1/84 Commonage Rd, Dunsborough 6281 WA",
} as const;

/** Short label for admin tables and filters. */
export const BLUE_WREN_LABEL = "Blue Wren";

const M2_TO_IN2 = 1550.0031;

/** Stated $/m² from the artist paper sheet → $/in². */
export const blueWrenRateFromM2 = (audPerM2: number): number =>
  Math.round((audPerM2 / M2_TO_IN2) * 10000) / 10000;

export const BLUE_WREN_SMOOTH_PEARL_AUD_PER_M2 = 128;
export const BLUE_WREN_RAG_CANVAS_AUD_PER_M2 = 200;

/** Ilford Galerie Smooth Pearl (+ Metallic Gloss band on the sheet). */
export const BLUE_WREN_SMOOTH_PEARL_RATE_PER_SQ_IN = blueWrenRateFromM2(
  BLUE_WREN_SMOOTH_PEARL_AUD_PER_M2,
);

/** Canson Rag Photographique and Canson Photoart Pro Canvas (sheet). */
export const BLUE_WREN_RAG_CANVAS_RATE_PER_SQ_IN = blueWrenRateFromM2(
  BLUE_WREN_RAG_CANVAS_AUD_PER_M2,
);

/**
 * Canvas + image wrap is priced as size packages on the sheet (not pure m²).
 * Approximate from A2 $67 ÷ A2 area for custom-size quotes.
 */
export const BLUE_WREN_CANVAS_IMAGEWRAP_RATE_PER_SQ_IN =
  Math.round((67 / (0.25 * M2_TO_IN2)) * 10000) / 10000;

export const BLUE_WREN_SMOOTH_PEARL_LABEL = "Ilford Galerie Smooth Pearl";
export const BLUE_WREN_RAG_PHOTOGRAPHIQUE_LABEL = "Canson Rag Photographique";
export const BLUE_WREN_CANVAS_LABEL = "Canson Photoart Pro Canvas";
export const BLUE_WREN_CANVAS_IMAGEWRAP_LABEL = "Canson Photoart Pro Canvas + image wrap";

/**
 * Mountboard presentation multiplies the Blue Wren print lab cost
 * (print + mount treated as 2× paper until mounts are quoted separately).
 */
export const BLUE_WREN_MOUNT_LAB_MULTIPLIER = 2;
