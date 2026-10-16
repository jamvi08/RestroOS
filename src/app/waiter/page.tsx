import { requireWaiterPage } from "@/lib/waiter-session";
import { WaiterBoard } from "@/components/waiter/WaiterBoard";

export default async function WaiterPage() {
  const { restaurantName, currency } = await requireWaiterPage();
  return <WaiterBoard restaurantName={restaurantName} currency={currency} />;
}
