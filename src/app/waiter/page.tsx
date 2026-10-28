import { requireWaiterPage } from "@/lib/waiter-session";
import { WaiterBoard } from "@/components/waiter/WaiterBoard";

export default async function WaiterPage() {
  const { header, currency } = await requireWaiterPage();
  return <WaiterBoard header={header} currency={currency} />;
}
