import { requireWaiterPage } from "@/lib/waiter-session";
import { WaiterMenu } from "@/components/waiter/WaiterMenu";

export default async function WaiterMenuPage() {
  const { header, currency } = await requireWaiterPage();
  return <WaiterMenu header={header} currency={currency} />;
}
