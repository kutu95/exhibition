import { mmToInches } from "./print-size";

export const UNSPECIFIED_PAPER_LABEL = "Unspecified paper";

export type OrderItemPaperFields = {
  paper_type?: string | null;
  width_mm: number | null;
  height_mm: number | null;
  quantity: number;
  lab_cost_aud: number | null;
};

export type OrderItemPaperGroup<T extends OrderItemPaperFields> = {
  paperLabel: string;
  items: T[];
  areaSqIn: number;
  labCostCents: number;
};

export const paperLabelForOrderItem = (paperType: string | null | undefined): string => {
  const trimmed = paperType?.trim();
  return trimmed ? trimmed : UNSPECIFIED_PAPER_LABEL;
};

export const itemAreaSqIn = (
  widthMm: number | null,
  heightMm: number | null,
  quantity: number,
): number => {
  if (!widthMm || !heightMm || widthMm <= 0 || heightMm <= 0 || quantity <= 0) return 0;
  return mmToInches(widthMm) * mmToInches(heightMm) * quantity;
};

export const roundSqIn = (area: number): number => Math.round(area * 100) / 100;

export const formatSqIn = (area: number): string =>
  `${roundSqIn(area).toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} sq in`;

export const itemLabCostCents = (labCostAud: number | null, quantity: number): number =>
  (labCostAud ?? 0) * Math.max(0, quantity);

export const groupOrderItemsByPaper = <T extends OrderItemPaperFields>(
  items: T[],
): OrderItemPaperGroup<T>[] => {
  const groups = new Map<string, OrderItemPaperGroup<T>>();

  for (const item of items) {
    const paperLabel = paperLabelForOrderItem(item.paper_type);
    const area = itemAreaSqIn(item.width_mm, item.height_mm, item.quantity);
    const labCostCents = itemLabCostCents(item.lab_cost_aud, item.quantity);
    const existing = groups.get(paperLabel);
    if (existing) {
      existing.items.push(item);
      existing.areaSqIn += area;
      existing.labCostCents += labCostCents;
    } else {
      groups.set(paperLabel, {
        paperLabel,
        items: [item],
        areaSqIn: area,
        labCostCents,
      });
    }
  }

  return [...groups.values()]
    .map((group) => ({ ...group, areaSqIn: roundSqIn(group.areaSqIn) }))
    .sort((a, b) => {
      if (a.paperLabel === UNSPECIFIED_PAPER_LABEL) return 1;
      if (b.paperLabel === UNSPECIFIED_PAPER_LABEL) return -1;
      return a.paperLabel.localeCompare(b.paperLabel, "en");
    });
};
