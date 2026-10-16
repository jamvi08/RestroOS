import { requireWaiterPage } from "@/lib/waiter-session";
import { WaiterTable } from "@/components/waiter/WaiterTable";

export default async function WaiterTablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { currency } = await requireWaiterPage();
  return <WaiterTable tableId={id} currency={currency} />;
}
