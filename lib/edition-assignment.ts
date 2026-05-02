import type { DatabaseError } from "pg";

import { withTransaction } from "./postgres";

type OrderItemRow = {
  id: string;
  variant_id: string;
  edition_number_assigned: number | null;
};

type VariantRow = {
  edition_size: number | null;
};

type EditionLockRow = {
  edition_number: number;
};

export type AssignedEdition = {
  order_item_id: string;
  variant_id: string;
  edition_number: number;
};

export const isDatabaseError = (error: unknown): error is DatabaseError =>
  Boolean(error && typeof error === "object" && "code" in error);

const assignEditionsOnce = async (orderId: string): Promise<AssignedEdition[]> =>
  withTransaction(
    async (client) => {
      const { rows: orderItems } = await client.query<OrderItemRow>(
        `
          select id, variant_id, edition_number_assigned
          from exhibition.order_items
          where order_id = $1
          order by id asc
          for update
        `,
        [orderId],
      );

      if (orderItems.length === 0) {
        throw new Error("ORDER_NOT_FOUND_OR_EMPTY");
      }

      const assigned: AssignedEdition[] = [];

      for (const item of orderItems) {
        if (item.edition_number_assigned) {
          assigned.push({
            order_item_id: item.id,
            variant_id: item.variant_id,
            edition_number: item.edition_number_assigned,
          });
          continue;
        }

        const { rows: variantRows } = await client.query<VariantRow>(
          `
            select edition_size
            from exhibition.product_variants
            where id = $1
            for update
          `,
          [item.variant_id],
        );

        const variant = variantRows[0];
        if (!variant) {
          throw new Error("VARIANT_NOT_FOUND");
        }

        let editionNumber: number | null = null;

        for (let attempt = 0; attempt < 2; attempt += 1) {
          const { rows: nextRows } = await client.query<{ edition_number: number }>(
            `
              select coalesce(max(edition_number), 0)::integer + 1 as edition_number
              from exhibition.edition_locks
              where variant_id = $1
            `,
            [item.variant_id],
          );

          const nextEditionNumber = nextRows[0]?.edition_number ?? 1;
          if (variant.edition_size && nextEditionNumber > variant.edition_size) {
            throw new Error("EDITION_SOLD_OUT");
          }

          const { rows: lockRows } = await client.query<EditionLockRow>(
            `
              insert into exhibition.edition_locks (variant_id, edition_number, order_item_id)
              values ($1, $2, $3)
              on conflict (variant_id, edition_number) do nothing
              returning edition_number
            `,
            [item.variant_id, nextEditionNumber, item.id],
          );

          if (lockRows[0]) {
            editionNumber = lockRows[0].edition_number;
            break;
          }
        }

        if (!editionNumber) {
          throw new Error("EDITION_LOCK_RETRY_FAILED");
        }

        await client.query(
          `
            update exhibition.order_items
            set edition_number_assigned = $1
            where id = $2
          `,
          [editionNumber, item.id],
        );

        if (variant.edition_size && editionNumber === variant.edition_size) {
          await client.query(
            `
              update exhibition.product_variants
              set is_active = false,
                  stock_quantity = 0
              where id = $1
            `,
            [item.variant_id],
          );
        }

        assigned.push({
          order_item_id: item.id,
          variant_id: item.variant_id,
          edition_number: editionNumber,
        });
      }

      return assigned;
    },
    { isolationLevel: "serializable" },
  );

export const assignEditionsToOrder = async (orderId: string): Promise<AssignedEdition[]> => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await assignEditionsOnce(orderId);
    } catch (error) {
      if (isDatabaseError(error) && error.code === "40001" && attempt === 0) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("EDITION_ASSIGNMENT_RETRY_FAILED");
};
