import { fetchAdminJson } from "../_lib/fetch-admin";
import { OrdersTableClient } from "../../../components/admin/OrdersTableClient";

type OrderListItem = {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string;
  status: string;
  items_count: number;
  total_aud: number | null;
  created_at: string;
};

export default async function AdminOrdersPage() {
  const orders = await fetchAdminJson<OrderListItem[]>("/api/admin/orders");

  return (
    <div>
      <h1>Orders</h1>
      <OrdersTableClient orders={orders} />
    </div>
  );
}
