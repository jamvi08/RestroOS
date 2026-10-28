import { requireManagerPage } from "@/lib/dashboard-session";
import { LiveOrders } from "@/components/dashboard/LiveOrders";

export default async function LiveOrdersPage() {
  const { currency } = await requireManagerPage();
  return <LiveOrders currency={currency} />;
}
