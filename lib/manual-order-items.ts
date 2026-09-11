export type ManualOrderLine = {
  variant_id: string;
  quantity: number;
  frame_colour: string | null;
};

type ManualOrderLinePayload = {
  items?: Array<{
    variant_id: string;
    quantity: number;
    frame_colour?: string | null;
  }>;
  variant_id?: string;
  quantity?: number;
  frame_colour?: string | null;
};

const MAX_LINES = 20;

export const resolveManualOrderLines = (
  payload: ManualOrderLinePayload,
): { ok: true; lines: ManualOrderLine[] } | { ok: false; error: string } => {
  if (payload.items && payload.items.length > 0) {
    if (payload.items.length > MAX_LINES) {
      return { ok: false, error: `Orders can include at most ${MAX_LINES} line items.` };
    }
    return {
      ok: true,
      lines: payload.items.map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
        frame_colour: item.frame_colour ?? null,
      })),
    };
  }

  if (payload.variant_id) {
    return {
      ok: true,
      lines: [
        {
          variant_id: payload.variant_id,
          quantity: payload.quantity ?? 1,
          frame_colour: payload.frame_colour ?? null,
        },
      ],
    };
  }

  return { ok: false, error: "items or variant_id is required." };
};
