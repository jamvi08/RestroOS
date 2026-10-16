import { requireWaiterPage } from "@/lib/waiter-session";
import { WaiterMenu } from "@/components/waiter/WaiterMenu";

export default async function WaiterMenuPage() {
  const { restaurantName, currency } = await requireWaiterPage();
  return <WaiterMenu restaurantName={restaurantName} currency={currency} />;
}
