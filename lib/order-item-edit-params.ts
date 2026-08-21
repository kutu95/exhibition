export const ORDER_EDIT_ORDER_PARAM = "editOrder";
export const ORDER_EDIT_ITEM_PARAM = "editItem";

export const buildOrderItemEditQuery = (
  orderId: string,
  itemId: string,
  extra?: Record<string, string>,
): string => {
  const params = new URLSearchParams({
    [ORDER_EDIT_ORDER_PARAM]: orderId,
    [ORDER_EDIT_ITEM_PARAM]: itemId,
  });
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  return params.toString();
};

export const readOrderItemEditParams = (searchParams: {
  get: (key: string) => string | null;
}): { orderId: string; itemId: string } | null => {
  const orderId = searchParams.get(ORDER_EDIT_ORDER_PARAM)?.trim() ?? "";
  const itemId = searchParams.get(ORDER_EDIT_ITEM_PARAM)?.trim() ?? "";
  if (!orderId || !itemId) return null;
  return { orderId, itemId };
};
