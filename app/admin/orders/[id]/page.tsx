import { notFound } from "next/navigation";

import { OrderDetailClient } from "../../../../components/admin/OrderDetailClient";
import { fetchAdminJson } from "../../_lib/fetch-admin";

type OrderDetailPayload = {
  order: {
    id: string;
    order_number: string;
    status: string;
    customer_name: string | null;
    customer_email: string;
    shipping_address: Record<string, unknown> | null;
    subtotal_aud: number | null;
    shipping_aud: number;
    total_aud: number | null;
    notes: string | null;
  };
  items: Array<{
    id: string;
    variant_id: string;
    quantity: number;
    unit_price_aud: number;
    edition_number_assigned: number | null;
    edition_size: number | null;
    product_title: string;
    variant_label: string;
  }>;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  let payload: OrderDetailPayload;
  try {
    payload = await fetchAdminJson<OrderDetailPayload>(`/api/admin/orders/${id}`);
  } catch {
    notFound();
  }

  return <OrderDetailClient order={payload.order} items={payload.items} />;
}
