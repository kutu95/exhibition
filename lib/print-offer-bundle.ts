import {
  getFramePricingSettings,
  getFrameRates,
  getRthCanvasRates,
  type FramePricingSettings,
  type FrameRateBand,
  type RthCanvasRateBand,
} from "./print-frame-pricing";
import { getPrintPricingSettings, type PrintPricingSettings } from "./print-markup";
import { getPrintPapers } from "./print-papers";
import type { ManagedPaper } from "./print-catalogue";

export type OfferPricingBundle = PrintPricingSettings & {
  papers: ManagedPaper[];
  frameMarkupFactor: number;
  frameBasePriceAud: number;
  frameRates: FrameRateBand[];
  rthCanvasRates: RthCanvasRateBand[];
};

export const getOfferPricingBundle = async (): Promise<OfferPricingBundle> => {
  const [media, frame, frameRates, rthCanvasRates, papers] = await Promise.all([
    getPrintPricingSettings(),
    getFramePricingSettings(),
    getFrameRates(),
    getRthCanvasRates(),
    getPrintPapers(),
  ]);

  return {
    ...media,
    papers,
    frameMarkupFactor: frame.markupFactor,
    frameBasePriceAud: frame.basePriceAud,
    frameRates,
    rthCanvasRates,
  };
};

export type { FramePricingSettings };
