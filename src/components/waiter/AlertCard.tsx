"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Footprints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BoardAlert } from "@/lib/board";
import { REQUEST_LABEL } from "./labels";
import { minutesAgo, send } from "./use-waiter-data";

/** One thing a customer is waiting for, with the buttons to deal with it. */
export function AlertCard({
  alert,
  now,
  onChange,
  showTable = true,
}: {
  alert: Pick<BoardAlert, "id" | "kind" | "type" | "status" | "createdAt" | "tableId" | "tableNumber" | "itemCount">;
  now: number;
  onChange: () => void;
  showTable?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = REQUEST_LABEL[alert.type];
  const coming = alert.status === "ACKNOWLEDGED";

  const update = async (status: "ACKNOWLEDGED" | "DONE") => {
    setBusy(true);
    setError(null);
    try {
      await send(`/api/waiter/requests/${alert.id}`, { status });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl border-2 bg-card p-4",
        alert.kind === "ORDER" ? "border-primary" : coming ? "border-border" : "border-destructive"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none" aria-hidden>
          {label.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-foreground">
            {showTable && <>Table {alert.tableNumber} · </>}
            {label.text}
            {alert.kind === "ORDER" && alert.itemCount ? ` (${alert.itemCount} items)` : ""}
          </p>
          <p className="text-[15px] text-muted-foreground">
            {minutesAgo(alert.createdAt, now)}
            {coming && <span className="font-semibold text-success"> · You said coming</span>}
          </p>
        </div>
      </div>

      {error && <p className="mt-2 text-[15px] font-medium text-destructive">{error}</p>}

      <div className="mt-3 flex gap-2">
        {alert.kind === "ORDER" ? (
          <Link
            href={`/waiter/tables/${alert.tableId}`}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground"
          >
            Check &amp; accept <ChevronRight className="size-5" />
          </Link>
        ) : (
          <>
            {!coming && (
              <Button className="flex-1" disabled={busy} onClick={() => update("ACKNOWLEDGED")}>
                <Footprints />
                Coming
              </Button>
            )}
            <Button variant={coming ? "success" : "outline"} className="flex-1" disabled={busy} onClick={() => update("DONE")}>
              <Check />
              Done
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
